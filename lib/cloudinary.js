import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const execFileAsync = promisify(execFile);

// Environment credentials as configured in .env
const cloudName =
  process.env.CLOUDINARY_CLOUD_NAME ||
  process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ||
  "dgozr0fbn";

const apiKey =
  process.env.CLOUDINARY_API_KEY ||
  "557574999962594";

const apiSecret =
  process.env.CLOUDINARY_API_SECRET ||
  "amMdpms8t3WSRqT68DmF0qhskLk";

const uploadPreset =
  process.env.CLOUDINARY_Upload_Presets ||
  process.env.CLOUDINARY_UPLOAD_PRESET ||
  process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ||
  "BlackHousse";

export { cloudName, apiKey, uploadPreset };

/**
 * Returns safe public configuration for client-side components
 */
export function getClientConfig() {
  return {
    cloudName,
    uploadPreset,
  };
}

/**
 * Executes curl to communicate reliably with Cloudinary API
 * This bypasses Node's outbound firewall/IPv6 timeout quirks on Windows
 */
async function runCurl(args) {
  const isWin = process.platform === "win32";
  const bin = isWin ? "curl.exe" : "curl";

  try {
    const { stdout, stderr } = await execFileAsync(bin, ["-s", ...args], {
      maxBuffer: 50 * 1024 * 1024,
      timeout: 60000,
    });

    if (!stdout || !stdout.trim()) {
      throw new Error(stderr || "Empty response from Cloudinary");
    }

    const data = JSON.parse(stdout);
    if (data.error) {
      throw new Error(data.error.message || JSON.stringify(data.error));
    }
    return data;
  } catch (err) {
    console.error("[cloudinary] curl error:", err.message);
    throw err;
  }
}

/**
 * Retrieve all images stored in Cloudinary
 * @param {object} params - { max_results, next_cursor, prefix }
 */
export async function getAllImages({ max_results = 50, next_cursor, prefix } = {}) {
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary credentials are not fully configured in .env");
  }

  const queryParams = new URLSearchParams({
    max_results: String(Math.min(Number(max_results) || 50, 100)),
  });

  if (next_cursor) queryParams.set("next_cursor", next_cursor);
  if (prefix) queryParams.set("prefix", prefix);

  const url = `https://api.cloudinary.com/v1_1/${cloudName}/resources/image?${queryParams.toString()}`;
  const auth = `${apiKey}:${apiSecret}`;

  const data = await runCurl(["-u", auth, url]);

  const images = (data.resources || []).map((res) => ({
    public_id: res.public_id,
    url: res.secure_url || res.url,
    secure_url: res.secure_url,
    format: res.format,
    width: res.width,
    height: res.height,
    bytes: res.bytes,
    created_at: res.created_at,
  }));

  return {
    images,
    next_cursor: data.next_cursor || null,
    total_count: data.total_count ?? images.length,
  };
}

/**
 * Upload an image to Cloudinary (from base64 Data URI, remote URL, Buffer, or local file path)
 * @param {string|Buffer} fileInput
 * @param {object} options - { folder, upload_preset, public_id }
 */
export async function uploadImage(fileInput, options = {}) {
  if (!cloudName) {
    throw new Error("Cloudinary cloud name is not configured in .env");
  }

  const folder = options.folder || "blackhousse";
  const preset = options.upload_preset || uploadPreset;
  const url = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

  let tempFilePath = null;
  const curlArgs = [];

  try {
    // 1. If it's a URL (http/https)
    if (typeof fileInput === "string" && /^https?:\/\//i.test(fileInput)) {
      curlArgs.push("-F", `file=${fileInput}`);
    }
    // 2. If it's a base64 Data URI
    else if (typeof fileInput === "string" && fileInput.startsWith("data:")) {
      const match = fileInput.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        const ext = match[1].split("/")[1] || "png";
        const buffer = Buffer.from(match[2], "base64");
        tempFilePath = path.join(os.tmpdir(), `cld_${Date.now()}_${Math.random().toString(36).substring(2)}.${ext}`);
        await fs.writeFile(tempFilePath, buffer);
        curlArgs.push("-F", `file=@${tempFilePath}`);
      } else {
        throw new Error("Invalid base64 data URI format");
      }
    }
    // 3. If it's a Buffer
    else if (Buffer.isBuffer(fileInput)) {
      tempFilePath = path.join(os.tmpdir(), `cld_${Date.now()}_${Math.random().toString(36).substring(2)}.png`);
      await fs.writeFile(tempFilePath, fileInput);
      curlArgs.push("-F", `file=@${tempFilePath}`);
    }
    // 4. If it's a local file path
    else if (typeof fileInput === "string") {
      const resolved = path.resolve(fileInput);
      curlArgs.push("-F", `file=@${resolved}`);
    } else {
      throw new Error("Unsupported image input format");
    }

    if (preset) {
      curlArgs.push("-F", `upload_preset=${preset}`);
    }
    if (folder) {
      curlArgs.push("-F", `folder=${folder}`);
    }
    if (options.public_id) {
      curlArgs.push("-F", `public_id=${options.public_id}`);
    }

    curlArgs.push(url);

    const result = await runCurl(curlArgs);

    return {
      success: true,
      url: result.secure_url || result.url,
      secure_url: result.secure_url,
      public_id: result.public_id,
      format: result.format,
      width: result.width,
      height: result.height,
      bytes: result.bytes,
      created_at: result.created_at,
    };
  } finally {
    if (tempFilePath) {
      await fs.unlink(tempFilePath).catch(() => {});
    }
  }
}

/**
 * Delete an image by its public_id from Cloudinary
 * @param {string} publicId
 */
export async function deleteImage(publicId) {
  if (!publicId) throw new Error("Public ID is required");
  const auth = `${apiKey}:${apiSecret}`;
  const url = `https://api.cloudinary.com/v1_1/${cloudName}/resources/image/upload?public_ids[]=${encodeURIComponent(publicId)}`;

  const result = await runCurl(["-X", "DELETE", "-u", auth, url]);
  const status = result.deleted?.[publicId];
  return {
    success: status === "deleted",
    status,
    result,
  };
}

/**
 * Helper to generate optimized Cloudinary URL with transformations
 */
export function getOptimizedImageUrl(urlOrPublicId, { width, height, crop = "fill", quality = "auto", format = "auto" } = {}) {
  if (!urlOrPublicId) return "";

  const transforms = [];
  if (width) transforms.push(`w_${width}`);
  if (height) transforms.push(`h_${height}`);
  if (crop) transforms.push(`c_${crop}`);
  if (quality) transforms.push(`q_${quality}`);
  if (format) transforms.push(`f_${format}`);
  const transStr = transforms.join(",");

  if (urlOrPublicId.includes("res.cloudinary.com")) {
    if (!transStr) return urlOrPublicId;
    return urlOrPublicId.replace("/upload/", `/upload/${transStr}/`);
  }

  return `https://res.cloudinary.com/${cloudName}/image/upload/${transStr ? transStr + "/" : ""}${urlOrPublicId}`;
}


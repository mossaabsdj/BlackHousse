import { NextResponse } from "next/server";
import { uploadImage, getAllImages, deleteImage, getClientConfig } from "@/lib/cloudinary";

export const dynamic = "force-dynamic";

/**
 * GET /api/cloudinary
 * Retrieves all stored images from Cloudinary with optional pagination
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    // If client asks for client config only
    if (searchParams.get("config") === "true") {
      return NextResponse.json(getClientConfig());
    }

    const maxResults = searchParams.get("max_results") || 50;
    const nextCursor = searchParams.get("next_cursor") || undefined;
    const prefix = searchParams.get("prefix") || undefined;

    const data = await getAllImages({
      max_results: maxResults,
      next_cursor: nextCursor,
      prefix,
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error("[api/cloudinary GET] error:", error);
    return NextResponse.json(
      { code: "CLOUDINARY_FETCH_ERROR", message: error.message || "Failed to get images" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cloudinary
 * Uploads an image to Cloudinary (supports FormData or JSON base64 / URL)
 */
export async function POST(request) {
  try {
    const contentType = request.headers.get("content-type") || "";

    let fileToUpload = null;
    let folder = "blackhousse";
    let uploadPreset = undefined;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") || formData.get("image");

      if (!file) {
        return NextResponse.json(
          { code: "MISSING_FILE", message: "Aucun fichier image fourni" },
          { status: 400 }
        );
      }

      if (formData.get("folder")) folder = formData.get("folder");
      if (formData.get("upload_preset")) uploadPreset = formData.get("upload_preset");

      if (typeof file === "string") {
        fileToUpload = file;
      } else {
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const mimeType = file.type || "image/jpeg";
        fileToUpload = `data:${mimeType};base64,${buffer.toString("base64")}`;
      }
    } else {
      const body = await request.json().catch(() => ({}));
      fileToUpload = body.file || body.image || body.url;
      if (body.folder) folder = body.folder;
      if (body.upload_preset) uploadPreset = body.upload_preset;

      if (!fileToUpload) {
        return NextResponse.json(
          { code: "MISSING_FILE", message: "Image base64 ou URL requise" },
          { status: 400 }
        );
      }
    }

    const result = await uploadImage(fileToUpload, {
      folder,
      ...(uploadPreset ? { upload_preset: uploadPreset } : {}),
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("[api/cloudinary POST] error:", error);
    return NextResponse.json(
      { code: "CLOUDINARY_UPLOAD_ERROR", message: error.message || "Failed to upload image" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/cloudinary
 * Deletes an image by public_id
 */
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    let publicId = searchParams.get("public_id");

    if (!publicId) {
      const body = await request.json().catch(() => ({}));
      publicId = body.public_id;
    }

    if (!publicId) {
      return NextResponse.json(
        { code: "MISSING_PUBLIC_ID", message: "public_id requis" },
        { status: 400 }
      );
    }

    const result = await deleteImage(publicId);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[api/cloudinary DELETE] error:", error);
    return NextResponse.json(
      { code: "CLOUDINARY_DELETE_ERROR", message: error.message || "Failed to delete image" },
      { status: 500 }
    );
  }
}


import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

export async function POST(req) {
  try {
    const body = await req.json();
    const {
      fullName,
      email,
      phone,
      country,
      password,
      confirmPassword,
      otp, // <-- user entered code
    } = body;

    // Basic validation
    if (!fullName || !email || !password || !confirmPassword || !otp) {
      return new Response(JSON.stringify({ message: "Missing fields" }), {
        status: 400,
      });
    }

    if (password !== confirmPassword) {
      return new Response(
        JSON.stringify({ message: "Passwords do not match" }),
        {
          status: 400,
        }
      );
    }

    // Check if email already exists
    const existingUser = await prisma.compte.findUnique({ where: { email } });
    if (existingUser) {
      return new Response(
        JSON.stringify({ message: "Email already registered" }),
        {
          status: 400,
        }
      );
    }

    // 1️⃣ Fetch OTP from database
    const otpRecord = await prisma.verificationToken.findFirst({
      where: { email },
      orderBy: {
        createdAt: "desc", // take newest token
      },
    });

    if (!otpRecord) {
      return new Response(JSON.stringify({ message: "OTP not found" }), {
        status: 400,
      });
    }

    // 2️⃣ Check expiration
    if (otpRecord.expiresAt < new Date()) {
      return new Response(JSON.stringify({ message: "OTP expired" }), {
        status: 400,
      });
    }

    // 3️⃣ Compare OTP using bcrypt
    const isValidOTP = await bcrypt.compare(otp, otpRecord.tokenHash);

    if (!isValidOTP) {
      return new Response(JSON.stringify({ message: "Invalid OTP" }), {
        status: 400,
      });
    }

    // 4️⃣ Create the user if OTP matches
    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.compte.create({
      data: {
        fullName,
        email,
        phone,
        country,
        Password: hashedPassword,
      },
    });

    // 5️⃣ Delete OTP after successful verification
    await prisma.verificationToken.delete({
      where: { id: otpRecord.id },
    });

    return new Response(
      JSON.stringify({ message: "Account created successfully" }),
      { status: 201 }
    );
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ message: "Server error" }), {
      status: 500,
    });
  }
}

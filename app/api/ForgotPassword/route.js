import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

export async function POST(req) {
  try {
    const { email, otp, newPassword } = await req.json();

    if (!email || !otp || !newPassword) {
      return new Response(JSON.stringify({ message: "Missing fields" }), {
        status: 400,
      });
    }

    // Check user exists
    const user = await prisma.compte.findUnique({ where: { email } });
    if (!user) {
      return new Response(JSON.stringify({ message: "No user found" }), {
        status: 404,
      });
    }

    // Get last OTP
    const otpRecord = await prisma.verificationToken.findFirst({
      where: { email },
      orderBy: { createdAt: "desc" },
    });

    if (!otpRecord) {
      return new Response(JSON.stringify({ message: "OTP not found" }), {
        status: 400,
      });
    }

    // Check expiration
    if (otpRecord.expiresAt < new Date()) {
      return new Response(JSON.stringify({ message: "OTP expired" }), {
        status: 400,
      });
    }

    // Compare OTP
    const isValidOTP = await bcrypt.compare(otp, otpRecord.tokenHash);
    if (!isValidOTP) {
      return new Response(JSON.stringify({ message: "Invalid OTP" }), {
        status: 400,
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // UPDATE PASSWORD
    await prisma.compte.update({
      where: { email },
      data: { Password: hashedPassword },
    });

    // Delete OTP after success
    await prisma.verificationToken.delete({
      where: { id: otpRecord.id },
    });

    return new Response(
      JSON.stringify({
        message: "Password updated successfully",
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ message: "Server error" }), {
      status: 500,
    });
  }
}

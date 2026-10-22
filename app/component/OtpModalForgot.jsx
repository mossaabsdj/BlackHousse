"use client";
import React, { useState, useEffect } from "react";
import Swal from "sweetalert2";

export default function OtpModal({ email, onExit }) {
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Timer state
  const [counter, setCounter] = useState(30);
  const [canResend, setCanResend] = useState(true); // <-- OTP allowed initially

  // Countdown effect
  useEffect(() => {
    if (!canResend && counter <= 0) {
      setCanResend(true);
      return;
    }

    if (!canResend) {
      const timer = setTimeout(() => setCounter(counter - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [counter, canResend]);

  // --- Verify OTP + Reset Password ---
  const handleVerify = async () => {
    if (!otp) {
      Swal.fire({
        icon: "warning",
        title: "Enter OTP",
        text: "Please enter the verification code sent to your email.",
      });
      return;
    }

    if (!newPassword || !confirmNewPassword) {
      Swal.fire({
        icon: "warning",
        title: "Missing Password",
        text: "Please enter and confirm your new password.",
      });
      return;
    }

    if (newPassword.length < 6) {
      Swal.fire({
        icon: "warning",
        title: "Weak Password",
        text: "Password must be at least 6 characters.",
      });
      return;
    }

    if (newPassword !== confirmNewPassword) {
      Swal.fire({
        icon: "error",
        title: "Password Mismatch",
        text: "The two passwords do not match.",
      });
      return;
    }

    setLoading(true);

    const res = await fetch("/api/ForgotPassword", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        otp,
        newPassword,
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (res.ok) {
      Swal.fire({
        icon: "success",
        title: "Password Updated",
        text: "Your password has been successfully reset.",
        timer: 2000,
        showConfirmButton: false,
      });

      onExit?.(); // Close modal
    } else {
      Swal.fire({
        icon: "error",
        title: "Verification Failed",
        text: data.message || "Invalid OTP or password error.",
      });
    }
  };

  // --- Send / Resend OTP ---
  const handleResend = async () => {
    setCanResend(false);
    setCounter(30);

    const resend = await fetch("/api/register/otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    if (resend.ok) {
      Swal.fire({
        icon: "success",
        title: "OTP Sent!",
        text: "A verification code has been sent.",
        timer: 1500,
        showConfirmButton: false,
      });
    } else {
      Swal.fire({
        icon: "error",
        title: "Send Failed",
        text: "Could not send the verification code.",
      });

      // allow resend again immediately
      setCanResend(true);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-50">
      <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-sm relative">
        {/* EXIT BUTTON */}
        <button
          onClick={onExit}
          className="absolute top-2 right-3 text-gray-500 hover:text-red-600 text-xl font-bold"
        >
          ✕
        </button>

        <h2 className="text-xl font-bold text-gray-800 text-center">
          Reset Password
        </h2>

        {/* NEW PASSWORD */}
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="mt-3 w-full border border-gray-300 rounded-lg p-3"
          placeholder="New Password"
        />

        {/* CONFIRM PASSWORD */}
        <input
          type="password"
          value={confirmNewPassword}
          onChange={(e) => setConfirmNewPassword(e.target.value)}
          className="mt-3 w-full border border-gray-300 rounded-lg p-3"
          placeholder="Confirm New Password"
        />

        <p className="text-gray-600 text-center mt-3">
          Enter the OTP sent to <b>{email}</b>
        </p>
        {/* OTP INPUT */}
        <input
          type="text"
          value={otp}
          onChange={(e) =>
            setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
          }
          className="mt-4 w-full border border-gray-300 rounded-lg p-3 text-lg tracking-widest text-center"
          placeholder="123456"
        />
        {/* SEND/RESEND OTP TEXT BUTTON */}
        <div className="text-center mt-2">
          <button
            onClick={handleResend}
            className={`text-sm font-medium underline ${
              canResend
                ? "text-blue-600 hover:text-blue-700 cursor-pointer"
                : "text-gray-400 cursor-not-allowed"
            }`}
            disabled={!canResend}
          >
            {canResend ? "Send OTP" : `Resend available in ${counter}s`}
          </button>
        </div>

        {/* VERIFY BUTTON */}
        <button
          onClick={handleVerify}
          className="w-full mt-4 bg-emerald-500 hover:bg-emerald-600 text-white py-3 rounded-lg font-semibold"
          disabled={loading}
        >
          {loading ? "Processing..." : "Confirm Reset"}
        </button>
      </div>
    </div>
  );
}

"use client";
import React, { useState, useEffect } from "react";
import Swal from "sweetalert2";

export default function OtpModal({ email, onVerify, onExit }) {
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  // Timer state
  const [counter, setCounter] = useState(30); // 30 sec before resend
  const [canResend, setCanResend] = useState(false);

  // Countdown effect
  useEffect(() => {
    if (counter <= 0) {
      setCanResend(true);
      return;
    }

    const timer = setTimeout(() => setCounter(counter - 1), 1000);

    return () => clearTimeout(timer);
  }, [counter]);

  // --- Verify OTP ---
  const handleVerify = async () => {
    if (!otp) {
      Swal.fire({
        icon: "warning",
        title: "Enter OTP",
        text: "Please enter the verification code sent to your email.",
      });
      return;
    }

    setLoading(true);

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...onVerify.userData, otp }),
    });

    const data = await res.json();
    setLoading(false);

    if (res.ok) {
      Swal.fire({
        icon: "success",
        title: "Account Created!",
        text: "Your account has been successfully verified.",
        timer: 2000,
        showConfirmButton: false,
      });

      onVerify.success();
    } else {
      Swal.fire({
        icon: "error",
        title: data.message,
      });
    }
  };

  // --- Resend OTP ---
  const handleResend = async () => {
    setCanResend(false);
    setCounter(30); // reset timer to 30s

    const resend = await fetch("/api/register/otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    if (resend.ok) {
      Swal.fire({
        icon: "success",
        title: "OTP Resent!",
        text: "A new verification code has been sent.",
        timer: 1500,
        showConfirmButton: false,
      });
    } else {
      Swal.fire({
        icon: "error",
        title: "Resend Failed",
        text: "Could not resend the verification code.",
      });
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
          Verify OTP
        </h2>
        <p className="text-gray-600 text-center mt-1">
          Enter the 6-digit code sent to <b>{email}</b>
        </p>

        <input
          type="text"
          value={otp}
          onChange={(e) =>
            setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
          }
          className="mt-4 w-full border border-gray-300 rounded-lg p-3 text-lg tracking-widest text-center"
          placeholder="123456"
        />

        {/* VERIFY BUTTON */}
        <button
          onClick={handleVerify}
          className="w-full mt-4 bg-emerald-500 hover:bg-emerald-600 text-white py-3 rounded-lg font-semibold"
          disabled={loading}
        >
          {loading ? "Verifying..." : "Verify Code"}
        </button>

        {/* RESEND OTP SECTION */}
        <div className="text-center mt-4">
          {!canResend ? (
            <p className="text-gray-500 text-sm">
              You can resend OTP in <b>{counter}s</b>
            </p>
          ) : (
            <button
              onClick={handleResend}
              className="text-emerald-600 font-semibold hover:underline"
            >
              Resend OTP
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

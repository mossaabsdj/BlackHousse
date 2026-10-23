"use client";
import React, { useState, useEffect } from "react";
import Swal from "sweetalert2";
import { useI18n } from "@/lib/i18n/I18nContext";

export default function OtpModal({ email, onVerify, onExit }) {
  const { t } = useI18n();
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
        title: t("Auth.enterOtp"),
        text: t("Auth.otpSent", { email }),
        confirmButtonColor: "#000000",
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
        title: t("Auth.registerSuccess"),
        timer: 2000,
        showConfirmButton: false,
      });

      onVerify.success();
    } else {
      Swal.fire({
        icon: "error",
        title: data.message || t("Auth.invalidOtp"),
        confirmButtonColor: "#000000",
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
        title: t("Auth.otpResent"),
        text: t("Auth.otpResentDesc"),
        timer: 1500,
        showConfirmButton: false,
      });
    } else {
      Swal.fire({
        icon: "error",
        title: t("Auth.otpSendFailed"),
        confirmButtonColor: "#000000",
      });
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-50 p-4">
      <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-sm relative">
        {/* EXIT BUTTON */}
        <button
          onClick={onExit}
          className="absolute top-3 end-3 text-gray-400 hover:text-red-600 text-lg font-bold p-1 rounded-lg"
          aria-label={t("Auth.cancelBtn")}
        >
          ✕
        </button>

        <h2 className="text-xl font-bold text-gray-900 text-center">
          {t("Auth.enterOtp")}
        </h2>
        <p className="text-gray-600 text-center mt-1 text-sm leading-relaxed">
          {t("Auth.otpSent", { email })}
        </p>

        <input
          type="text"
          value={otp}
          onChange={(e) =>
            setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
          }
          className="mt-4 w-full border border-gray-300 rounded-xl p-3 text-lg tracking-widest text-center font-mono focus:border-black focus:ring-1 focus:ring-black outline-none"
          placeholder="123456"
          autoFocus
        />

        {/* VERIFY BUTTON */}
        <button
          onClick={handleVerify}
          className="w-full mt-4 bg-black hover:bg-neutral-800 text-white py-3.5 rounded-xl font-bold text-sm shadow-md transition disabled:opacity-60"
          disabled={loading}
        >
          {loading ? t("Auth.verifying") : t("Auth.verifyBtn")}
        </button>

        {/* RESEND OTP SECTION */}
        <div className="text-center mt-4 text-xs">
          {!canResend ? (
            <p className="text-gray-500">
              {t("Auth.resendIn", { seconds: counter })}
            </p>
          ) : (
            <button
              onClick={handleResend}
              className="text-orange-600 font-bold hover:underline"
            >
              {t("Auth.resend")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

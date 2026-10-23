"use client";
import React, { useState, useEffect } from "react";
import Swal from "sweetalert2";
import { useI18n } from "@/lib/i18n/I18nContext";

export default function OtpModal({ email, onExit }) {
  const { t } = useI18n();
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
        title: t("Auth.enterOtp"),
        text: t("Auth.otpSent", { email }),
        confirmButtonColor: "#000000",
      });
      return;
    }

    if (!newPassword || !confirmNewPassword) {
      Swal.fire({
        icon: "warning",
        title: t("Auth.missingFields"),
        text: t("Auth.missingFieldsDesc"),
        confirmButtonColor: "#000000",
      });
      return;
    }

    if (newPassword.length < 6) {
      Swal.fire({
        icon: "warning",
        title: t("Auth.weakPassword"),
        text: t("Auth.weakPassword6Desc"),
        confirmButtonColor: "#000000",
      });
      return;
    }

    if (newPassword !== confirmNewPassword) {
      Swal.fire({
        icon: "error",
        title: t("Auth.passwordMismatch"),
        text: t("Auth.passwordMismatchDesc"),
        confirmButtonColor: "#000000",
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
        title: t("Auth.resetSuccess"),
        text: t("Auth.resetSuccessDesc"),
        timer: 2000,
        showConfirmButton: false,
      });

      onExit?.(); // Close modal
    } else {
      Swal.fire({
        icon: "error",
        title: t("Auth.invalidOtp"),
        text: data.message || t("Auth.invalidOtp"),
        confirmButtonColor: "#000000",
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

      // allow resend again immediately
      setCanResend(true);
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
          {t("Auth.resetPasswordTitle")}
        </h2>

        {/* NEW PASSWORD */}
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="mt-4 w-full border border-gray-300 rounded-xl p-3 text-sm focus:border-black focus:ring-1 focus:ring-black outline-none"
          placeholder={t("Auth.newPassword")}
        />

        {/* CONFIRM PASSWORD */}
        <input
          type="password"
          value={confirmNewPassword}
          onChange={(e) => setConfirmNewPassword(e.target.value)}
          className="mt-3 w-full border border-gray-300 rounded-xl p-3 text-sm focus:border-black focus:ring-1 focus:ring-black outline-none"
          placeholder={t("Auth.confirmNewPassword")}
        />

        <p className="text-gray-600 text-center mt-3 text-sm leading-relaxed">
          {t("Auth.otpSent", { email })}
        </p>
        {/* OTP INPUT */}
        <input
          type="text"
          value={otp}
          onChange={(e) =>
            setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
          }
          className="mt-3 w-full border border-gray-300 rounded-xl p-3 text-lg tracking-widest text-center font-mono focus:border-black focus:ring-1 focus:ring-black outline-none"
          placeholder="123456"
        />
        {/* SEND/RESEND OTP TEXT BUTTON */}
        <div className="text-center mt-2 text-xs">
          <button
            onClick={handleResend}
            className={`font-semibold underline ${
              canResend
                ? "text-orange-600 hover:text-orange-700 cursor-pointer"
                : "text-gray-400 cursor-not-allowed"
            }`}
            disabled={!canResend}
          >
            {canResend ? t("Auth.resend") : t("Auth.resendIn", { seconds: counter })}
          </button>
        </div>

        {/* VERIFY BUTTON */}
        <button
          onClick={handleVerify}
          className="w-full mt-4 bg-black hover:bg-neutral-800 text-white py-3.5 rounded-xl font-bold text-sm shadow-md transition disabled:opacity-60"
          disabled={loading}
        >
          {loading ? t("Auth.verifying") : t("Auth.verifyBtn")}
        </button>
      </div>
    </div>
  );
}

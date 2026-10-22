"use client";

import React, { useState } from "react";
import { FaFacebookF, FaTwitter, FaInstagram } from "react-icons/fa";
import Image from "next/image";
import Swal from "sweetalert2";
import { signIn } from "next-auth/react";
import Progression from "@/app/component/Proogression/page";

//import Header from "@/app/component/navbar/page";
//import Footer from "@/app/component/Home/Footer/page";
// === Text Constants ===
const TEXTS = {
  loginTitle: "Log In",
  socialLoginText: "I have an account",
  usernamePlaceholder: "Username",
  passwordPlaceholder: "Password",
  buttonText: "Log In",
  welcomeTitle: "Welcome to our site!",
  welcomeSubtitle: "Please log in to continue.",
  alerts: {
    requiredTitle: "Required Fields",
    requiredMessage: "Please fill in all fields.",
    successTitle: "Login Successful",
    successMessage: "Welcome to the dashboard!",
    errorTitle: "Login Failed",
    errorMessage: "Incorrect username or password.",
  },
};

// === Color/Style Constants ===
const COLORS = {
  warning: "#F59E0B",
  success: "#10B981",
  error: "#EF4444",
  formRing: "ring-green-500",
  buttonBg: "bg-emerald-500",
  buttonHover: "hover:bg-emerald-600",
  socialBg: "bg-green-200",
  socialText: "text-blue-600",
  rightPaneBg: "bg-green-200",
};

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = React.useState(false);

  const handleSubmit = async (e) => {
    setIsLoading(true);
    e.preventDefault();
    const res = await signIn("credentials", {
      username,
      password,
      redirect: false,
      callbackUrl: "/DashBoard",
    });
    setIsLoading(false);

    if (res?.ok) {
      // ✅ Success - redirect manually
      Swal.fire({
        icon: "success",
        title: "Login Successful",
        showConfirmButton: false,
        customClass: {
          popup: "shadow-lg rounded-lg", // optional for soft edges and shadow
        },
        timer: 1500,
      }).then(() => {
        setIsLoading(true);
        window.location.href = res.url;
      });
    } else {
      // ❌ Error - show alert
      Swal.fire({
        icon: "error",
        title: "Login Failed",
        text: "Invalid username or password.",
        confirmButtonColor: "#d32f2f", // red confirm button
        customClass: {
          popup: "shadow-lg rounded-lg", // optional for soft edges and shadow
        },
      });
    }
  };

  return (
    <>
      {isLoading && <Progression isVisible={true} />}

      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="flex flex-col md:flex-row rounded-xl shadow-2xl overflow-hidden w-full max-w-4xl h-[540px]">
          {/* Left: Login form */}
          <div className="w-full md:w-1/2 bg-white p-10 flex flex-col items-center justify-center">
            <h2 className="text-3xl font-bold mb-4">{TEXTS.loginTitle}</h2>

            <div className="flex gap-4 mb-6">
              {[FaFacebookF, FaTwitter, FaInstagram].map((Icon, idx) => (
                <div
                  key={idx}
                  className={`${COLORS.socialBg} ${COLORS.socialText} p-3 rounded-full shadow-md hover:scale-105 transition`}
                >
                  <Icon />
                </div>
              ))}
            </div>

            <h3 className="text-xl font-semibold mb-4">
              {TEXTS.socialLoginText}
            </h3>

            <input
              type="text"
              placeholder={TEXTS.usernamePlaceholder}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={`w-full max-w-xs h-14 mb-5 px-4 rounded-lg bg-white ring-2 ${COLORS.formRing} text-gray-800 text-base outline-none focus:ring-2 transition`}
            />

            <input
              type="password"
              placeholder={TEXTS.passwordPlaceholder}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`w-full max-w-xs h-14 mb-5 px-4 rounded-lg bg-white ring-2 ${COLORS.formRing} text-gray-800 text-base outline-none focus:ring-2 focus:${COLORS.formRing} transition`}
            />

            <button
              onClick={handleSubmit}
              className={`w-full max-w-xs h-14 ${COLORS.buttonBg} text-white rounded-full font-bold shadow-md ${COLORS.buttonHover} hover:scale-105 transition-all duration-200`}
            >
              {TEXTS.buttonText}
            </button>
          </div>

          {/* Right: Welcome Text (hidden on small screens) */}
          <div
            className={`hidden md:flex w-full md:w-1/2 ${COLORS.rightPaneBg} p-10 flex-col justify-center items-center text-center`}
          >
            <Image
              src="/images/logo.png"
              alt="Logo"
              width={150}
              height={200}
              className="mb-4 bg-black rounded-4xl shadow-2xl shadow-black"
            />
            <h2 className="text-3xl font-bold text-slate-900 mb-2">
              {TEXTS.welcomeTitle}
            </h2>
            <p className="text-lg text-slate-800">{TEXTS.welcomeSubtitle}</p>
          </div>
        </div>
      </div>
    </>
  );
}

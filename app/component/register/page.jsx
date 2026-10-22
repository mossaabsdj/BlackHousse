"use client";
import React, { useState } from "react";
import { FaFacebookF, FaTwitter, FaInstagram } from "react-icons/fa";
import Image from "next/image";
import Swal from "sweetalert2";
import Progression from "@/app/component/Proogression/page";

// ============================================
// CONSTANTS
// ============================================

const TEXTS = {
  registerTitle: "Create Account",
  subtitle: "Join us and start your journey today.",
  firstName: "First Name",
  lastName: "Last Name",
  email: "Email Address",
  password: "Password",
  confirmPassword: "Confirm Password",
  button: "Sign Up",
  haveAccount: "Already have an account?",
  loginLink: "Log In",
  welcomeTitle: "Welcome to Our Site!",
  welcomeDescription:
    "Manage your orders, explore new products, and connect with your favorite farms — all from one place.",
  alerts: {
    required: "Please fill in all fields.",
    mismatch: "Passwords do not match.",
    success: "Account created successfully!",
    error: "Something went wrong. Please try again.",
    registrationFailed: "Registration Failed",
  },
};

const COLORS = {
  formBorder: "border-green-500",
  formFocus: "focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500",
  buttonBg: "bg-emerald-500",
  buttonHover: "hover:bg-emerald-600",
  socialBg: "bg-green-100",
  rightPaneBg: "bg-emerald-500",
};

const SOCIAL_ICONS = [
  { Icon: FaFacebookF, label: "Facebook" },
  { Icon: FaTwitter, label: "Twitter" },
  { Icon: FaInstagram, label: "Instagram" },
];

// ============================================
// COMPONENTS
// ============================================

const WelcomeSection = () => (
  <div
    className={`hidden md:flex w-full md:w-1/2 ${COLORS.rightPaneBg} text-white flex-col justify-center items-center text-center p-10`}
  >
    <Image
      src="/images/logo.png"
      alt="Logo"
      width={150}
      height={200}
      className="mb-4 bg-black rounded-4xl shadow-2xl shadow-black"
    />
    <h2 className="text-3xl font-bold mb-2">{TEXTS.welcomeTitle}</h2>
    <p className="text-lg opacity-90 max-w-sm">{TEXTS.welcomeDescription}</p>
  </div>
);

const FormInput = ({ type, placeholder, value, onChange, className = "" }) => (
  <input
    type={type}
    placeholder={placeholder}
    value={value}
    onChange={onChange}
    className={`h-15 px-4 rounded-lg border-2 ${COLORS.formBorder} ${COLORS.formFocus} text-gray-800 outline-none transition ${className}`}
    required
  />
);

const SocialButtons = () => (
  <div className="flex gap-4 mt-6">
    {SOCIAL_ICONS.map(({ Icon, label }, idx) => (
      <button
        key={idx}
        type="button"
        className={`${COLORS.socialBg} p-3 rounded-full shadow-md hover:scale-110 cursor-pointer transition ${COLORS.formFocus}`}
        aria-label={label}
      >
        <Icon className="text-emerald-600" />
      </button>
    ))}
  </div>
);

// ============================================
// MAIN COMPONENT
// ============================================

export default function RegisterPage({ setopen }) {
  // State management
  const [formData, setFormData] = useState({
    prenom: "",
    nom: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [isLoading, setIsLoading] = useState(false);

  // Handle input changes
  const handleInputChange = (field) => (e) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
  };

  // Form validation
  const validateForm = () => {
    const { prenom, nom, email, password, confirmPassword } = formData;

    if (!prenom || !nom || !email || !password || !confirmPassword) {
      Swal.fire("Missing Fields", TEXTS.alerts.required, "warning");
      return false;
    }

    if (password !== confirmPassword) {
      Swal.fire("Password Mismatch", TEXTS.alerts.mismatch, "error");
      return false;
    }

    return true;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsLoading(true);

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nom: formData.nom,
          prenom: formData.prenom,
          email: formData.email,
          password: formData.password,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        await Swal.fire({
          icon: "success",
          title: "Success",
          text: TEXTS.alerts.success,
          timer: 1500,
          showConfirmButton: false,
        });
        window.location.href = "/Login";
      } else {
        Swal.fire(
          TEXTS.alerts.registrationFailed,
          data.message || TEXTS.alerts.error,
          "error"
        );
      }
    } catch (error) {
      Swal.fire("Error", TEXTS.alerts.error, "error");
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <>
      {isLoading && <Progression isVisible={true} />}

      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="flex flex-col md:flex-row bg-white rounded-3xl shadow-2xl overflow-hidden w-full max-w-5xl">
          {/* Welcome Section */}
          <WelcomeSection />

          {/* Form Section */}
          <div className="w-full md:w-1/2 p-10 flex flex-col justify-center items-center">
            <h2 className="text-4xl font-extrabold text-gray-800 mb-2">
              {TEXTS.registerTitle}
            </h2>
            <p className="text-gray-500 mb-8">{TEXTS.subtitle}</p>

            <form
              onSubmit={handleSubmit}
              className="w-full flex flex-col items-center space-y-4"
            >
              {/* Name Inputs */}
              <div className="flex gap-3 w-full max-w-sm">
                <FormInput
                  type="text"
                  placeholder={TEXTS.firstName}
                  value={formData.prenom}
                  onChange={handleInputChange("prenom")}
                  className="flex-1 min-w-0"
                />
                <FormInput
                  type="text"
                  placeholder={TEXTS.lastName}
                  value={formData.nom}
                  onChange={handleInputChange("nom")}
                  className="flex-1 min-w-0"
                />
              </div>

              {/* Email Input */}
              <FormInput
                type="email"
                placeholder={TEXTS.email}
                value={formData.email}
                onChange={handleInputChange("email")}
                className="w-full max-w-sm"
              />

              {/* Password Input */}
              <FormInput
                type="password"
                placeholder={TEXTS.password}
                value={formData.password}
                onChange={handleInputChange("password")}
                className="w-full max-w-sm"
              />

              {/* Confirm Password Input */}
              <FormInput
                type="password"
                placeholder={TEXTS.confirmPassword}
                value={formData.confirmPassword}
                onChange={handleInputChange("confirmPassword")}
                className="w-full max-w-sm"
              />

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full max-w-sm h-12 ${COLORS.buttonBg} text-white font-bold rounded-full shadow-md ${COLORS.buttonHover} hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isLoading ? "Creating Account..." : TEXTS.button}
              </button>

              {/* Login Link */}
              <p className="text-gray-700 text-sm mt-3">
                {TEXTS.haveAccount}{" "}
                <button
                  onClick={() => setopen(false)}
                  className={`text-emerald-600 font-semibold hover:underline ${COLORS.formFocus} rounded px-1`}
                >
                  {TEXTS.loginLink}
                </button>
              </p>

              {/* Social Media Buttons */}
              <SocialButtons />
            </form>
          </div>
        </div>
      </div>
    </>
  );
}

"use client";
import { Eye, EyeOff, Mail, Lock, User, Phone, ArrowLeft } from "lucide-react";

import React, { useState } from "react";
import Link from "next/link";
import {
  FaFacebookF,
  FaTwitter,
  FaInstagram,
  FaFacebookSquare,
  FaTwitterSquare,
  FaLinkedin,
} from "react-icons/fa";
import { countries } from "@/data/countries";
import Swal from "sweetalert2";
import { signIn } from "next-auth/react";
import OtpModal from "@/app/component/OtpModal";
import ForgotOtpModal from "@/app/component/OtpModalForgot";
import Progression from "@/app/component/Proogression/page";

// White & black theme
const COLORS = {
  formBorder: "border-gray-300",
  formFocus: "focus:ring-2 focus:ring-black/20 focus:border-black",
  buttonBg: "bg-black",
  buttonHover: "hover:bg-neutral-800",
  socialBg: "bg-gray-100",
  rightPaneBg: "bg-black",
};

// Smooth S-shaped wave (viewBox 0 0 40 600). White area = the form side.
const WAVE_PATH = "M0 0H10C34 180 34 300 20 360S2 540 12 600H0Z";

// Mobile header: dark area (top-left) cut by a flowing wave (viewBox 0 0 400 280)
const MOBILE_WAVE_LINE = "M0 258C50 240 70 150 140 140S250 150 290 90S330 20 345 0";
const MOBILE_WAVE_FILL = `M0 0V258C50 240 70 150 140 140S250 150 290 90S330 20 345 0Z`;

const SOCIAL_ICONS = [
  { Icon: FaFacebookF, label: "Facebook" },
  { Icon: FaTwitter, label: "Twitter" },
  { Icon: FaInstagram, label: "Instagram" },
];

const FormInput = ({
  type,
  placeholder,
  value,
  onChange,
  className = "",
  icon: Icon,
}) => (
  <div className="relative w-full">
    {Icon && (
      <Icon
        size={18}
        className="md:hidden absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
      />
    )}
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      className={`h-14 px-4 ${
        Icon ? "pl-11 md:pl-4" : ""
      } rounded-lg border md:border-2 bg-transparent md:bg-white ${COLORS.formBorder} ${COLORS.formFocus} text-gray-800 outline-none transition ${className}`}
      required
    />
  </div>
);

const SocialButtons = ({ label }) => (
  <div className="w-full flex flex-col items-center">
    {/* Mobile: label + plain square icons */}
    <p className="md:hidden text-xs text-gray-500 mt-2">{label}</p>
    <div className="md:hidden flex gap-5 mt-3">
      {[
        { Icon: FaFacebookSquare, name: "Facebook" },
        { Icon: FaTwitterSquare, name: "Twitter" },
        { Icon: FaLinkedin, name: "LinkedIn" },
      ].map(({ Icon, name }) => (
        <button key={name} type="button" aria-label={name} className="text-black active:scale-90 transition">
          <Icon size={28} />
        </button>
      ))}
    </div>

    {/* Desktop: round buttons */}
    <div className="hidden md:flex gap-4 mt-4">
      {SOCIAL_ICONS.map(({ Icon, label }, idx) => (
        <button
          key={idx}
          type="button"
          className={`${COLORS.socialBg} p-3 rounded-full shadow-md hover:scale-110 hover:bg-black hover:text-white cursor-pointer transition ${COLORS.formFocus}`}
          aria-label={label}
        >
          <Icon />
        </button>
      ))}
    </div>
  </div>
);

const WelcomeSection = ({ title, description, isRight }) => (
  <div
    className={`hidden md:flex relative w-full md:w-1/2 ${
      COLORS.rightPaneBg
    } text-white flex-col justify-center items-center text-center p-10 ${
      isRight ? "pl-16 order-2" : "pr-16 order-1"
    }`}
    style={{ minHeight: "600px" }}
  >
    {/* Wavy edge facing the form (mirrored when the pane is on the left) */}
    <svg
      aria-hidden="true"
      viewBox="0 0 40 600"
      preserveAspectRatio="none"
      className={`pointer-events-none absolute inset-y-0 h-full w-12 ${
        isRight ? "left-0 -ml-px" : "right-0 -mr-px scale-x-[-1]"
      }`}
    >
      <path d={WAVE_PATH} className="fill-white" />
    </svg>

    <Link href="/" title="Retour au site" className="inline-block hover:opacity-85 transition">
      <img
        src="/images/logo.png"
        alt="Logo"
        className="w-32 h-32 mb-6 object-cover"
      />
    </Link>
    <h2 className="text-3xl font-bold mb-4">{title}</h2>
    <p className="text-lg opacity-90 max-w-sm">{description}</p>
  </div>
);

const MobileHeader = () => (
  <div className="md:hidden relative h-30 shrink-0 bg-stone-100">
    <svg
      aria-hidden="true"
      viewBox="0 0 400 280"
      preserveAspectRatio="none"
      className="absolute inset-0 h-full w-full"
    >
      <path d={MOBILE_WAVE_FILL} className="fill-black" />
      {/* thin outline following the wave */}
      <path
        d={MOBILE_WAVE_LINE}
        transform="translate(8 10)"
        fill="none"
        stroke="rgba(0,0,0,0.25)"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
    <Link href="/" title="Retour au site" className="relative z-10 inline-block m-6 mt-2 ml-2 w-18 h-18">
      <img
        src="/images/logo.png"
        alt="Logo"
        className="w-18 h-18 rounded-sm object-cover"
      />
    </Link>
  </div>
);

export default function FlipAuthPages() {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [showForogtOtpModal, setShowForogtOtpModal] = useState(false);

  const [pendingUser, setPendingUser] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  const [resetEmail, setResetEmail] = useState("");

  const [showConfirm, setShowConfirm] = useState(false);
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [registerData, setRegisterData] = useState({
    fullName: "",
    email: "",
    phone: "",
    country: "",
    password: "",
    confirmPassword: "",
  });
  const handleLoginChange = (field) => (e) => {
    setLoginData((prev) => ({ ...prev, [field]: e.target.value }));
  };
  const handleForgotPassword = () => {
    // Ex: ouvrir une modal, naviguer vers une page, afficher un formulaire, etc.
    setShowResetPassword(true);
  };

  const handleRegisterChange = (field) => (e) => {
    let value = e.target.value;
    if (field === "phone") {
      // ✅ Allow only digits and plus sign
      value = value.replace(/[^\d+]/g, ""); // remove everything except digits and +

      // ✅ Only allow one "+" and only at the beginning
      if (value.includes("+")) {
        value = "+" + value.replace(/\+/g, ""); // keep + only at start
      }

      // ✅ Optional: limit total length (e.g., 13 characters for +countrycode)
      if (value.length > 13) value = value.slice(0, 13);
    }
    setRegisterData((prev) => {
      const updated = { ...prev, [field]: value };

      // Update phone number prefix when country changes
      if (field === "country") {
        const selectedCountry = countries.find((c) => c.name === value);
        if (selectedCountry) {
          updated.phone = selectedCountry.code + " ";
        }
      }

      return updated;
    });
  };
  const handleLoginSubmit = async (e) => {
    setIsLoading(true);
    e.preventDefault();
    const { email, password } = loginData;
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl: "/Admin",
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
        text: "Invalid email or password.",
        confirmButtonColor: "#000000", // black confirm button
        customClass: {
          popup: "shadow-lg rounded-lg", // optional for soft edges and shadow
        },
      });
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    const { fullName, email, phone, country, password, confirmPassword } =
      registerData;

    // ✅ 1. Check for empty fields
    if (
      !fullName ||
      !email ||
      !phone ||
      !country ||
      !password ||
      !confirmPassword
    ) {
      Swal.fire({
        icon: "warning",
        title: "Missing Fields",
        text: "Please fill in all required fields.",
        confirmButtonColor: "#000000",
      });
      return;
    }

    // ✅ 2. Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Swal.fire({
        icon: "error",
        title: "Invalid Email",
        text: "Please enter a valid email address.",
        confirmButtonColor: "#000000",
      });
      return;
    }

    // ✅ 3. Validate phone number (digits only, optional +)
    const phoneRegex = /^\+?\d{8,13}$/;
    if (!phoneRegex.test(phone)) {
      Swal.fire({
        icon: "error",
        title: "Invalid Phone Number",
        text: "Phone number must contain only digits (and an optional +), between 8 and 13 digits.",
        confirmButtonColor: "#000000",
      });
      return;
    }

    // ✅ 4. Validate password length
    if (password.length < 8) {
      Swal.fire({
        icon: "error",
        title: "Weak Password",
        text: "Password must be at least 8 characters long.",
        confirmButtonColor: "#000000",
      });
      return;
    }

    // ✅ 5. Validate password match
    if (password !== confirmPassword) {
      Swal.fire({
        icon: "error",
        title: "Passwords Do Not Match",
        text: "Please make sure both passwords are identical.",
        confirmButtonColor: "#000000",
      });
      return;
    }
    setIsLoading(true);
    // 1️⃣ Send OTP first
    const otpRes = await fetch("/api/register/otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setIsLoading(false);

    if (!otpRes.ok) {
      Swal.fire({
        icon: "error",
        title: "Failed to send OTP",
        confirmButtonColor: "#000000",
      });
      return;
    }
    // 2️⃣ Store user data locally
    setPendingUser({
      fullName,
      email,
      phone,
      country,
      password,
      confirmPassword,
    });

    // 3️⃣ Show OTP Modal
    setShowOtpModal(true);
  };
  const handleResetPassword = () => {
    setShowResetPassword(false);
    setShowForogtOtpModal(true);
  };
  return (
    <>
      {" "}
      {showResetPassword && (
        <div className="fixed inset-0 z-[1000] bg-black/40 backdrop-blur-md flex justify-center items-center">
          <div className="bg-white p-10 rounded-3xl w-[90%] max-w-xl shadow-2xl transform scale-105">
            <h3 className="text-3xl font-extrabold text-center mb-6 text-black">
              Reset Password
            </h3>

            <p className="text-gray-600 text-base mb-6 text-center">
              Enter your email and we will send you a reset link.
            </p>

            <FormInput
              type="email"
              placeholder="Email"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              className="text-lg w-full"
            />

            <button
              onClick={handleResetPassword}
              className="w-full mt-6 py-4 bg-black hover:bg-neutral-800 text-white text-lg font-bold rounded-full shadow-md transition-colors"
            >
              Next
            </button>

            <button
              className="w-full mt-3 text-gray-600 hover:text-black underline text-base transition-colors"
              onClick={() => setShowResetPassword(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {isLoading && <Progression isVisible={true} />}
      {showOtpModal && (
        <OtpModal
          email={pendingUser?.email || resetEmail}
          onExit={() => setShowOtpModal(false)}
          onVerify={{
            userData: pendingUser || resetEmail,
            success: () => {
              setShowOtpModal(false);
              setIsFlipped(false); // go back to login scene
            },
          }}
        />
      )}
      {showForogtOtpModal && (
        <ForgotOtpModal
          email={resetEmail}
          onExit={() => setShowForogtOtpModal(false)}
        />
      )}
      <div className="min-h-screen flex items-start md:items-center justify-center bg-stone-100 md:bg-gray-100 p-0 md:p-4">
        <div className="w-full max-w-6xl md:[perspective:2000px]">
          <div
            className={`relative w-full md:min-h-[600px] transition-transform duration-700 md:[transform-style:preserve-3d] ${
              isFlipped ? "md:[transform:rotateY(180deg)]" : ""
            }`}
          >
            {/* LOGIN PAGE (Front) */}
            <div
              className={`w-full md:absolute md:[backface-visibility:hidden] md:[transform:rotateY(0deg)] ${
                isFlipped ? "hidden md:block" : "block"
              }`}
            >
              <div className="flex flex-col md:flex-row min-h-screen md:min-h-0 bg-stone-100 md:bg-white rounded-none md:rounded-3xl shadow-none md:shadow-2xl border-0 md:border border-gray-200 overflow-hidden">
                <MobileHeader />

                {/* Login Form */}
                <div className="w-full md:w-1/2 px-6 py-8 md:p-8 flex flex-col justify-start md:justify-center items-center order-1">
                  <div className="w-full max-w-sm">
                    <h2 className="text-3xl md:text-5xl font-semibold md:font-extrabold text-black mb-1 md:mb-2 text-left md:text-center">
                      Log In
                    </h2>
                    <p className="text-gray-500 text-xs md:text-base mb-6 text-left md:text-center">
                      Welcome back! Please login to your account.
                    </p>

                    <div className="w-full flex flex-col gap-4">
                      <div className="order-1">
                        <FormInput
                          type="email"
                          placeholder="Email"
                          value={loginData.email}
                          onChange={handleLoginChange("email")}
                          className="w-full"
                          icon={Mail}
                        />
                      </div>

                      <div className="order-2 relative w-full">
                        <FormInput
                          type={showLoginPassword ? "text" : "password"}
                          placeholder="Password"
                          value={loginData.password}
                          onChange={handleLoginChange("password")}
                          className="w-full pr-12"
                          icon={Lock}
                        />
                        <button
                          type="button"
                          onClick={() => setShowLoginPassword((v) => !v)}
                          aria-label={showLoginPassword ? "Hide password" : "Show password"}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-black"
                        >
                          {showLoginPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                      </div>

                      <button
                        onClick={handleLoginSubmit}
                        className={`order-4 md:order-3 w-full h-14 text-base md:text-xl font-semibold md:font-bold ${COLORS.buttonBg} text-white rounded-lg md:rounded-full shadow-md ${COLORS.buttonHover} md:hover:scale-105 transition-all duration-200 mt-2`}
                      >
                        Log In
                      </button>

                      <p className="order-3 md:order-4 text-xs md:text-sm text-right md:text-center md:pt-2 -mb-1 md:mb-0">
                        <button
                          type="button"
                          onClick={handleForgotPassword}
                          className="text-gray-600 md:text-black font-medium md:font-semibold hover:underline"
                        >
                          Forgot Password?
                        </button>
                      </p>

                      <p className="order-6 md:order-5 text-gray-500 md:text-gray-700 text-xs md:text-sm text-center pt-4 md:pt-2">
                        Don't have an account?{" "}
                        <button
                          type="button"
                          onClick={() => setIsFlipped(true)}
                          className="text-gray-700 md:text-black font-semibold underline md:no-underline md:hover:underline"
                        >
                          <span className="md:hidden">Sign Up</span>
                          <span className="hidden md:inline">Create Account</span>
                        </button>
                      </p>

                      <div className="order-5 md:order-6 flex justify-center">
                        <SocialButtons label="Log in with" />
                      </div>

                      <div className="order-7 text-center pt-1">
                        <Link
                          href="/"
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-black transition"
                        >
                          <ArrowLeft size={14} />
                          <span>Retour au site BlackHousse</span>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Welcome Section - Right */}
                <WelcomeSection
                  title="Welcome Back!"
                  description="Manage your orders, explore new products, and connect with your favorite farms — all from one place."
                  isRight={true}
                />
              </div>
            </div>

            {/* REGISTER PAGE (Back) */}
            <div
              className={`w-full md:absolute md:[backface-visibility:hidden] md:[transform:rotateY(180deg)] ${
                isFlipped ? "block" : "hidden md:block"
              }`}
            >
              <div className="flex flex-col md:flex-row min-h-screen md:min-h-0 bg-stone-100 md:bg-white rounded-none md:rounded-3xl shadow-none md:shadow-2xl border-0 md:border border-gray-200 overflow-hidden">
                <MobileHeader />

                {/* Welcome Section - Left */}
                <WelcomeSection
                  title="Join Our Community!"
                  description="Create an account to access exclusive features, track your orders, and connect with local farms."
                  isRight={false}
                />

                {/* Register Form */}
                <div className="w-full md:w-1/2 px-6 py-8 md:p-8 flex flex-col justify-start md:justify-center items-center order-2">
                  <div className="w-full max-w-2xl">
                    <h2 className="text-3xl md:text-5xl font-semibold md:font-extrabold text-black mb-1 md:mb-2 text-left md:text-center">
                      Sign Up
                    </h2>
                    <p className="text-gray-500 text-xs md:text-base mb-6 text-left md:text-center">
                      Create your account to get started.
                    </p>

                    <div className="w-full flex flex-col">
                      <div className="order-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormInput
                          type="text"
                          placeholder="Full Name"
                          value={registerData.fullName}
                          onChange={handleRegisterChange("fullName")}
                          className="w-full"
                          icon={User}
                        />
                        <FormInput
                          type="email"
                          placeholder="Email"
                          value={registerData.email}
                          onChange={handleRegisterChange("email")}
                          className="w-full"
                          icon={Mail}
                        />
                        <select
                          value={registerData.country}
                          onChange={handleRegisterChange("country")}
                          className={`h-14 px-4 rounded-lg border md:border-2 bg-transparent md:bg-white ${COLORS.formBorder} ${COLORS.formFocus} text-gray-800 outline-none transition w-full`}
                          required
                        >
                          <option value="">Select Country</option>
                          {countries.map((country, idx) => (
                            <option key={idx} value={country.name}>
                              {country.name} ({country.code})
                            </option>
                          ))}
                        </select>
                        <FormInput
                          type="tel"
                          placeholder="Phone Number"
                          value={registerData.phone}
                          onChange={handleRegisterChange("phone")}
                          className="w-full"
                          icon={Phone}
                          maxLength={12} // 👈 limits input to 10 characters
                        />

                        <div className="relative w-full">
                          <FormInput
                            type={showPassword ? "text" : "password"}
                            placeholder="Password"
                            value={registerData.password}
                            onChange={handleRegisterChange("password")}
                            className="w-full pr-10"
                            icon={Lock}
                          />
                          <button
                            type="button"
                            onMouseDown={() => setShowPassword(true)}
                            onMouseUp={() => setShowPassword(false)}
                            onMouseLeave={() => setShowPassword(false)}
                            onTouchStart={() => setShowPassword(true)}
                            onTouchEnd={() => setShowPassword(false)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-black"
                          >
                            {showPassword ? (
                              <EyeOff size={20} />
                            ) : (
                              <Eye size={20} />
                            )}
                          </button>
                        </div>
                        <div className="relative w-full">
                          <FormInput
                            type={showConfirmPassword ? "text" : "password"}
                            placeholder="Confirm Password"
                            value={registerData.confirmPassword}
                            onChange={handleRegisterChange("confirmPassword")}
                            className="w-full pr-10"
                            icon={Lock}
                          />
                          <button
                            type="button"
                            onMouseDown={() => setShowConfirmPassword(true)}
                            onMouseUp={() => setShowConfirmPassword(false)}
                            onMouseLeave={() => setShowConfirmPassword(false)}
                            onTouchStart={() => setShowConfirmPassword(true)}
                            onTouchEnd={() => setShowConfirmPassword(false)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-black"
                          >
                            {showConfirmPassword ? (
                              <EyeOff size={20} />
                            ) : (
                              <Eye size={20} />
                            )}
                          </button>
                        </div>
                      </div>

                      <button
                        onClick={handleRegisterSubmit}
                        className={`order-2 w-full h-14 text-base md:text-xl font-semibold md:font-bold ${COLORS.buttonBg} text-white rounded-lg md:rounded-full shadow-md ${COLORS.buttonHover} md:hover:scale-105 transition-all duration-200 mt-6`}
                      >
                        Create Account
                      </button>

                      <div className="order-3 md:order-4 flex justify-center">
                        <SocialButtons label="Sign up with" />
                      </div>

                      <p className="order-4 md:order-3 text-gray-500 md:text-gray-700 text-xs md:text-sm text-center pt-4">
                        Already have an account?{" "}
                        <button
                          type="button"
                          onClick={() => setIsFlipped(false)}
                          className="text-gray-700 md:text-black font-semibold underline md:no-underline md:hover:underline"
                        >
                          Log In
                        </button>
                      </p>

                      <div className="order-5 text-center pt-1">
                        <Link
                          href="/"
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-black transition"
                        >
                          <ArrowLeft size={14} />
                          <span>Retour au site BlackHousse</span>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
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

import { useI18n } from "@/lib/i18n/I18nContext";
import LanguageSwitcher from "@/app/component/LanguageSwitcher";

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
        className="md:hidden absolute start-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
      />
    )}
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      className={`h-14 px-4 ${
        Icon ? "ps-11 md:ps-4" : ""
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

const WelcomeSection = ({ title, description, isRight, backTitle }) => (
  <div
    className={`hidden md:flex relative w-full md:w-1/2 ${
      COLORS.rightPaneBg
    } text-white flex-col justify-center items-center text-center p-10 ${
      isRight ? "ps-16 order-2" : "pe-16 order-1"
    }`}
    style={{ minHeight: "600px" }}
  >
    {/* Wavy edge facing the form (mirrored when the pane is on the left) */}
    <svg
      aria-hidden="true"
      viewBox="0 0 40 600"
      preserveAspectRatio="none"
      className={`pointer-events-none absolute inset-y-0 h-full w-12 ${
        isRight ? "start-0 -ms-px" : "end-0 -me-px scale-x-[-1]"
      }`}
    >
      <path d={WAVE_PATH} className="fill-white" />
    </svg>

    <Link href="/" title={backTitle || "Retour au site"} className="inline-block hover:opacity-85 transition">
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

const MobileHeader = ({ backTitle }) => (
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
    <div className="absolute top-3 end-4 z-20">
      <LanguageSwitcher variant="navbar" />
    </div>
    <Link href="/" title={backTitle || "Retour au site"} className="relative z-10 inline-block m-6 mt-2 ms-2 w-18 h-18">
      <img
        src="/images/logo.png"
        alt="Logo"
        className="w-18 h-18 rounded-sm object-cover"
      />
    </Link>
  </div>
);

export default function FlipAuthPages() {
  const { t } = useI18n();
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
    setShowResetPassword(true);
  };

  const handleRegisterChange = (field) => (e) => {
    let value = e.target.value;
    if (field === "phone") {
      value = value.replace(/[^\d+]/g, "");
      if (value.includes("+")) {
        value = "+" + value.replace(/\+/g, "");
      }
      if (value.length > 13) value = value.slice(0, 13);
    }
    setRegisterData((prev) => {
      const updated = { ...prev, [field]: value };
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
      Swal.fire({
        icon: "success",
        title: t("Auth.loginSuccess"),
        showConfirmButton: false,
        customClass: {
          popup: "shadow-lg rounded-lg",
        },
        timer: 1500,
      }).then(() => {
        setIsLoading(true);
        window.location.href = res.url;
      });
    } else {
      Swal.fire({
        icon: "error",
        title: t("Auth.loginFailed"),
        text: t("Auth.invalidCredentials"),
        confirmButtonColor: "#000000",
        customClass: {
          popup: "shadow-lg rounded-lg",
        },
      });
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    const { fullName, email, phone, country, password, confirmPassword } =
      registerData;

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
        title: t("Auth.missingFields"),
        text: t("Auth.missingFieldsDesc"),
        confirmButtonColor: "#000000",
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Swal.fire({
        icon: "error",
        title: t("Auth.invalidEmail"),
        text: t("Auth.invalidEmailDesc"),
        confirmButtonColor: "#000000",
      });
      return;
    }

    const phoneRegex = /^\+?\d{8,13}$/;
    if (!phoneRegex.test(phone)) {
      Swal.fire({
        icon: "error",
        title: t("Auth.invalidPhone"),
        text: t("Auth.invalidPhoneDesc"),
        confirmButtonColor: "#000000",
      });
      return;
    }

    if (password.length < 8) {
      Swal.fire({
        icon: "error",
        title: t("Auth.weakPassword"),
        text: t("Auth.weakPasswordDesc"),
        confirmButtonColor: "#000000",
      });
      return;
    }

    if (password !== confirmPassword) {
      Swal.fire({
        icon: "error",
        title: t("Auth.passwordMismatch"),
        text: t("Auth.passwordMismatchDesc"),
        confirmButtonColor: "#000000",
      });
      return;
    }
    setIsLoading(true);
    const otpRes = await fetch("/api/register/otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setIsLoading(false);

    if (!otpRes.ok) {
      Swal.fire({
        icon: "error",
        title: t("Auth.otpSendFailed"),
        confirmButtonColor: "#000000",
      });
      return;
    }
    setPendingUser({
      fullName,
      email,
      phone,
      country,
      password,
      confirmPassword,
    });

    setShowOtpModal(true);
  };

  const handleResetPassword = () => {
    setShowResetPassword(false);
    setShowForogtOtpModal(true);
  };

  return (
    <>
      <div className="fixed top-6 end-6 z-50 hidden md:block">
        <LanguageSwitcher variant="navbar" />
      </div>

      {showResetPassword && (
        <div className="fixed inset-0 z-[1000] bg-black/40 backdrop-blur-md flex justify-center items-center p-4">
          <div className="bg-white p-8 md:p-10 rounded-3xl w-full max-w-xl shadow-2xl">
            <h3 className="text-2xl md:text-3xl font-extrabold text-center mb-4 text-black">
              {t("Auth.resetPasswordTitle")}
            </h3>

            <p className="text-gray-600 text-sm md:text-base mb-6 text-center leading-relaxed">
              {t("Auth.resetPasswordDesc")}
            </p>

            <FormInput
              type="email"
              placeholder={t("Auth.email")}
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              className="text-base md:text-lg w-full"
            />

            <button
              onClick={handleResetPassword}
              className="w-full mt-6 py-4 bg-black hover:bg-neutral-800 text-white text-base md:text-lg font-bold rounded-full shadow-md transition-colors"
            >
              {t("Auth.nextBtn")}
            </button>

            <button
              className="w-full mt-3 text-gray-600 hover:text-black underline text-sm md:text-base transition-colors"
              onClick={() => setShowResetPassword(false)}
            >
              {t("Auth.cancelBtn")}
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
                <MobileHeader backTitle={t("Auth.backToHome")} />

                {/* Login Form */}
                <div className="w-full md:w-1/2 px-6 py-8 md:p-8 flex flex-col justify-start md:justify-center items-center order-1">
                  <div className="w-full max-w-sm">
                    <h2 className="text-3xl md:text-5xl font-semibold md:font-extrabold text-black mb-1 md:mb-2 text-start md:text-center">
                      {t("Auth.login")}
                    </h2>
                    <p className="text-gray-500 text-xs md:text-base mb-6 text-start md:text-center">
                      {t("Auth.welcomeBackSubtitle")}
                    </p>

                    <div className="w-full flex flex-col gap-4">
                      <div className="order-1">
                        <FormInput
                          type="email"
                          placeholder={t("Auth.email")}
                          value={loginData.email}
                          onChange={handleLoginChange("email")}
                          className="w-full"
                          icon={Mail}
                        />
                      </div>

                      <div className="order-2 relative w-full">
                        <FormInput
                          type={showLoginPassword ? "text" : "password"}
                          placeholder={t("Auth.password")}
                          value={loginData.password}
                          onChange={handleLoginChange("password")}
                          className="w-full pe-12"
                          icon={Lock}
                        />
                        <button
                          type="button"
                          onClick={() => setShowLoginPassword((v) => !v)}
                          aria-label={showLoginPassword ? "Hide password" : "Show password"}
                          className="absolute end-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-black"
                        >
                          {showLoginPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                      </div>

                      <button
                        onClick={handleLoginSubmit}
                        className={`order-4 md:order-3 w-full h-14 text-base md:text-xl font-semibold md:font-bold ${COLORS.buttonBg} text-white rounded-lg md:rounded-full shadow-md ${COLORS.buttonHover} md:hover:scale-105 transition-all duration-200 mt-2`}
                      >
                        {t("Auth.signInBtn")}
                      </button>

                      <p className="order-3 md:order-4 text-xs md:text-sm text-end md:text-center md:pt-2 -mb-1 md:mb-0">
                        <button
                          type="button"
                          onClick={handleForgotPassword}
                          className="text-gray-600 md:text-black font-medium md:font-semibold hover:underline"
                        >
                          {t("Auth.forgotPassword")}
                        </button>
                      </p>

                      <p className="order-6 md:order-5 text-gray-500 md:text-gray-700 text-xs md:text-sm text-center pt-4 md:pt-2">
                        {t("Auth.noAccount")}{" "}
                        <button
                          type="button"
                          onClick={() => setIsFlipped(true)}
                          className="text-gray-700 md:text-black font-semibold underline md:no-underline md:hover:underline"
                        >
                          {t("Auth.signUpBtn")}
                        </button>
                      </p>

                      <div className="order-5 md:order-6 flex justify-center">
                        <SocialButtons label={t("Auth.loginWith")} />
                      </div>

                      <div className="order-7 text-center pt-1">
                        <Link
                          href="/"
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-black transition"
                        >
                          <ArrowLeft size={14} className="rtl-flip" />
                          <span>{t("Auth.backToHome")}</span>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Welcome Section - Right */}
                <WelcomeSection
                  title={t("Auth.welcomeBackTitle")}
                  description={t("Auth.welcomeBackDesc")}
                  backTitle={t("Auth.backToHome")}
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
                <MobileHeader backTitle={t("Auth.backToHome")} />

                {/* Welcome Section - Left */}
                <WelcomeSection
                  title={t("Auth.joinCommunityTitle")}
                  description={t("Auth.joinCommunityDesc")}
                  backTitle={t("Auth.backToHome")}
                  isRight={false}
                />

                {/* Register Form */}
                <div className="w-full md:w-1/2 px-6 py-8 md:p-8 flex flex-col justify-start md:justify-center items-center order-2">
                  <div className="w-full max-w-2xl">
                    <h2 className="text-3xl md:text-5xl font-semibold md:font-extrabold text-black mb-1 md:mb-2 text-start md:text-center">
                      {t("Auth.register")}
                    </h2>
                    <p className="text-gray-500 text-xs md:text-base mb-6 text-start md:text-center">
                      {t("Auth.joinCommunitySubtitle")}
                    </p>

                    <div className="w-full flex flex-col">
                      <div className="order-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormInput
                          type="text"
                          placeholder={t("Auth.fullName")}
                          value={registerData.fullName}
                          onChange={handleRegisterChange("fullName")}
                          className="w-full"
                          icon={User}
                        />
                        <FormInput
                          type="email"
                          placeholder={t("Auth.email")}
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
                          <option value="">{t("Auth.selectCountry")}</option>
                          {countries.map((country, idx) => (
                            <option key={idx} value={country.name}>
                              {country.name} ({country.code})
                            </option>
                          ))}
                        </select>
                        <FormInput
                          type="tel"
                          placeholder={t("Auth.phone")}
                          value={registerData.phone}
                          onChange={handleRegisterChange("phone")}
                          className="w-full"
                          icon={Phone}
                          maxLength={12}
                        />

                        <div className="relative w-full">
                          <FormInput
                            type={showPassword ? "text" : "password"}
                            placeholder={t("Auth.password")}
                            value={registerData.password}
                            onChange={handleRegisterChange("password")}
                            className="w-full pe-10"
                            icon={Lock}
                          />
                          <button
                            type="button"
                            onMouseDown={() => setShowPassword(true)}
                            onMouseUp={() => setShowPassword(false)}
                            onMouseLeave={() => setShowPassword(false)}
                            onTouchStart={() => setShowPassword(true)}
                            onTouchEnd={() => setShowPassword(false)}
                            className="absolute end-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-black"
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
                            placeholder={t("Auth.confirmPassword")}
                            value={registerData.confirmPassword}
                            onChange={handleRegisterChange("confirmPassword")}
                            className="w-full pe-10"
                            icon={Lock}
                          />
                          <button
                            type="button"
                            onMouseDown={() => setShowConfirmPassword(true)}
                            onMouseUp={() => setShowConfirmPassword(false)}
                            onMouseLeave={() => setShowConfirmPassword(false)}
                            onTouchStart={() => setShowConfirmPassword(true)}
                            onTouchEnd={() => setShowConfirmPassword(false)}
                            className="absolute end-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-black"
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
                        {t("Auth.signUpBtn")}
                      </button>

                      <div className="order-3 md:order-4 flex justify-center">
                        <SocialButtons label={t("Auth.signUpWith")} />
                      </div>

                      <p className="order-4 md:order-3 text-gray-500 md:text-gray-700 text-xs md:text-sm text-center pt-4">
                        {t("Auth.hasAccount")}{" "}
                        <button
                          type="button"
                          onClick={() => setIsFlipped(false)}
                          className="text-gray-700 md:text-black font-semibold underline md:no-underline md:hover:underline"
                        >
                          {t("Auth.signInBtn")}
                        </button>
                      </p>

                      <div className="order-5 text-center pt-1">
                        <Link
                          href="/"
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-black transition"
                        >
                          <ArrowLeft size={14} className="rtl-flip" />
                          <span>{t("Auth.backToHome")}</span>
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
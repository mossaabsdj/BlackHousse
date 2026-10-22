const { heroui } = require("@heroui/theme");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@heroui/theme/dist/components/(image|navbar).js"
  ],
  theme: {
    extend: {
      colors: {
        primary: "#178154",
        "text-dark": "#1F1F1F",
        "text-muted": "#6B7280",
        "border-light": "#E5E7EB",
        background: "#FFFFFF",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
    },
  },
  darkMode: "class",
  plugins: [heroui()],
};

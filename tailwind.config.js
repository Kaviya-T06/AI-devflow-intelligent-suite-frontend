/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      colors: {
        // Primary brand palette — deep indigo/violet
        primary: {
          50:  "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
          950: "#1e1b4b",
        },
        // Accent — electric cyan
        accent: {
          50:  "#ecfeff",
          100: "#cffafe",
          200: "#a5f3fc",
          300: "#67e8f9",
          400: "#22d3ee",
          500: "#06b6d4",
          600: "#0891b2",
          700: "#0e7490",
          800: "#155e75",
          900: "#164e63",
        },
        // Surface grays
        surface: {
          50:  "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#334155",
          800: "#1e293b",
          850: "#172032",
          900: "#0f172a",
          950: "#090e1a",
        },
        // Status colors
        success: { 400: "#4ade80", 500: "#22c55e", 600: "#16a34a" },
        warning: { 400: "#fb923c", 500: "#f97316", 600: "#ea580c" },
        danger:  { 400: "#f87171", 500: "#ef4444", 600: "#dc2626" },
      },
      backgroundImage: {
        "gradient-primary": "linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)",
        "gradient-dark":    "linear-gradient(180deg, #0f172a 0%, #090e1a 100%)",
        "gradient-card":    "linear-gradient(145deg, rgba(99,102,241,0.08) 0%, rgba(6,182,212,0.04) 100%)",
      },
      animation: {
        "fade-in":    "fadeIn 0.3s ease-out",
        "slide-in":   "slideIn 0.3s ease-out",
        "pulse-slow": "pulse 3s cubic-bezier(0.4,0,0.6,1) infinite",
        "float":      "float 6s ease-in-out infinite",
      },
      keyframes: {
        fadeIn:  { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        slideIn: { from: { opacity: "0", transform: "translateX(-12px)" }, to: { opacity: "1", transform: "translateX(0)" } },
        float:   { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-10px)" } },
      },
      boxShadow: {
        "glow":        "0 0 20px rgba(99,102,241,0.3)",
        "glow-accent": "0 0 20px rgba(6,182,212,0.3)",
        "glass":       "0 8px 32px rgba(0,0,0,0.4)",
        "card":        "0 4px 24px rgba(0,0,0,0.25)",
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
}

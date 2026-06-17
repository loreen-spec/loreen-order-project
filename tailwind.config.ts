import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-plus-jakarta)", "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          50: "#f0f4ff",
          100: "#e0eaff",
          200: "#c7d7fe",
          300: "#a5bcfd",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
        },
        surface: {
          0: "#ffffff",
          50: "#f8f9fb",
          100: "#f1f3f7",
          200: "#e8ebf2",
        },
      },
      boxShadow: {
        card: "0 1px 3px 0 rgba(0,0,0,0.04), 0 1px 2px -1px rgba(0,0,0,0.04)",
        "card-hover": "0 4px 12px 0 rgba(0,0,0,0.08)",
        float: "0 8px 30px rgba(0,0,0,0.12)",
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
    },
  },
  plugins: [],
};

export default config;

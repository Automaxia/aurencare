import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#6A4EC8",
          50: "#F4F1FB",
          100: "#E7E0F5",
          200: "#CFC2EB",
          300: "#B0A0DF",
          400: "#8E76D3",
          500: "#6A4EC8",
          600: "#553EA0",
          700: "#402F78",
          800: "#2B1F50",
        },
        secondary: {
          DEFAULT: "#5C9D88",
          50: "#EEF6F3",
          100: "#D8EBE3",
          200: "#B2D6C7",
          300: "#8BC2AC",
          400: "#74B098",
          500: "#5C9D88",
          600: "#4A7E6D",
        },
        background: "#F9F8F5",
        sidebar: "#EFECF7",
        ink: {
          DEFAULT: "#2A2640",
          muted: "#6B6883",
        },
      },
      fontFamily: {
        display: ["var(--font-cormorant)", "ui-serif", "Georgia", "serif"],
        sans: ["var(--font-dm-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(42, 38, 64, 0.04), 0 4px 16px rgba(42, 38, 64, 0.04)",
      },
    },
  },
  plugins: [],
};

export default config;

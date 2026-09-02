import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        a: { DEFAULT: "#FF6B8A", light: "#FFE1E8" },
        b: { DEFAULT: "#2EC4B6", light: "#DFF7F4" },
        bg: "#FFF9F0",
        accent: "#FFB84D",
        ink: "#3A3A3A",
        soft: "#8A8A8A",
      },
      borderRadius: {
        card: "22px",
        btn: "16px",
      },
      boxShadow: {
        card: "0 6px 18px rgba(0,0,0,0.08)",
      },
    },
  },
  plugins: [],
};

export default config;

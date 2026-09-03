import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        a: { DEFAULT: "#FF6B8A", light: "#FFE1E8", tile: "oklch(0.94 0.055 18)" },
        b: { DEFAULT: "#2EC4B6", light: "#DFF7F4", tile: "oklch(0.94 0.05 190)" },
        butter: "oklch(0.93 0.06 85)",
        sage: "oklch(0.94 0.05 140)",
        lilac: "oklch(0.93 0.045 300)",
        bg: "#FFF9F0",
        accent: "#FFB84D",
        ink: "#1A1A1A",
        soft: "#8A8A8A",
      },
      fontFamily: {
        display: ["'Jua'", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "22px",
        btn: "16px",
      },
      boxShadow: {
        card: "0 3px 10px rgba(20,20,20,0.05)",
      },
    },
  },
  plugins: [],
};

export default config;

import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#E8650A",
          dark: "#C4540A",
          light: "#FFF1E2",
        },
        sidebar: "#0A0A0A",
        "ib-bg": "#F4F6F9",
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "8px",
      },
      boxShadow: {
        card: "0 1px 3px rgba(16,24,40,0.05)",
        "card-hover": "0 4px 12px rgba(16,24,40,0.10)",
        primary: "0 2px 8px rgba(232,101,10,0.32)",
      },
    },
  },
  plugins: [],
};

export default config;

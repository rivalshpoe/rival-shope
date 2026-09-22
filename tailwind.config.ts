import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0b0a09",
        ivory: "#f7f2e9",
        sand: "#d9c4aa",
        champagne: "#c7a478",
        taupe: "#847465",
      },
      fontFamily: {
        sans: ["var(--font-arabic)", "Arial", "sans-serif"],
        display: ["var(--font-display)", "var(--font-arabic)", "serif"],
      },
      boxShadow: {
        luxury: "0 24px 70px rgba(17, 13, 9, .12)",
      },
      keyframes: {
        shimmer: { "100%": { transform: "translateX(-100%)" } },
        nudge: {
          "0%, 100%": { transform: "translateX(0)" },
          "40%": { transform: "translateX(3px)" },
          "70%": { transform: "translateX(-2px)" },
        },
      },
      animation: {
        shimmer: "shimmer 1.8s infinite",
        nudge: "nudge .35s ease-in-out",
      },
    },
  },
  plugins: [],
};

export default config;

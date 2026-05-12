import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0a0a0b",
        "bg-2": "#101012",
        fg: "#f5f5f6",
        "fg-2": "#b4b4b8",
        "fg-3": "#76767c",
        "fg-4": "#4a4a50",
        line: "rgba(255,255,255,0.07)",
        "line-strong": "rgba(255,255,255,0.12)",
        accent: "#c2f970",
        "accent-dim": "#8aac4a",
        danger: "#ff6b6b",
        warn: "#f5c14a",
      },
      fontFamily: {
        sans: [
          "Geist",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "sans-serif",
        ],
        mono: [
          "Geist Mono",
          "ui-monospace",
          "SF Mono",
          "Menlo",
          "monospace",
        ],
      },
      maxWidth: {
        shell: "1200px",
      },
      keyframes: {
        rise: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "none" },
        },
        pulse: {
          "0%": { boxShadow: "0 0 0 0 rgba(194,249,112,0.55)" },
          "70%": { boxShadow: "0 0 0 8px rgba(194,249,112,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(194,249,112,0)" },
        },
      },
      animation: {
        rise: "rise 0.6s cubic-bezier(.2,.7,.2,1) both",
        "pulse-dot": "pulse 1.6s ease-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;

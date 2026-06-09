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
        // fg-3 carries real reading text (side notes, table cells, footer).
        // #76767c on #0a0a0b sat around 4.3:1, under the WCAG AA 4.5:1
        // floor for body sizes. #8a8a90 clears it with margin. fg-4 stays
        // a decorative/meta tier but gets the same one-notch lift.
        "fg-3": "#8a8a90",
        "fg-4": "#5c5c63",
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

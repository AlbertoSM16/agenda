import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        slate: { 850: "#151e2e", 900: "#0f172a", 950: "#090d16" },
      },
    },
  },
  plugins: [],
} satisfies Config;

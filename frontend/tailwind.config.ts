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
        obsidian: {
          DEFAULT: "#07090E",
          dark: "#07090E",
          card: "#0B0F17",
          border: "#111827",
        },
        accent: {
          emerald: "#10B981",
          cyan: "#06B6D4",
          purple: "#8B5CF6",
          indigo: "#6366F1",
        },
      },
    },
  },
  plugins: [],
};
export default config;

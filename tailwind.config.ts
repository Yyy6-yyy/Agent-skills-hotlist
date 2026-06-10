import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#111827",
        paper: "#f7f7f4",
        coral: "#e25f4b",
        teal: "#0f766e",
        plum: "#6d3c74",
        saffron: "#d9a21b"
      },
      boxShadow: {
        soft: "0 18px 60px rgba(17, 24, 39, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;

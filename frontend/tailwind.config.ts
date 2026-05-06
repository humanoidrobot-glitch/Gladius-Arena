import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // The arena: dark warm-undertone surfaces.
        night: {
          900: "#0a0807",
          800: "#0f0c09",
          700: "#14110d",
          600: "#1a1612",
          500: "#221c17",
        },
        // Imperial gold — weathered, not shiny.
        gold: {
          DEFAULT: "#c9a84c",
          50: "#f5edd0",
          100: "#ead6a3",
          200: "#dec07a",
          300: "#d3b25f",
          400: "#c9a84c",
          500: "#b59137",
          600: "#8a7233",
          700: "#5e4e25",
          800: "#3a3119",
        },
        // Blood red — losses, danger.
        blood: {
          DEFAULT: "#a0312f",
          400: "#c63d3a",
          500: "#a0312f",
          600: "#7a2422",
        },
        // Muted emerald — gains.
        emerald: {
          DEFAULT: "#5d8a4d",
          400: "#7caa68",
          500: "#5d8a4d",
          600: "#476937",
        },
        stone: {
          50: "#e8e4dc",
          100: "#cec8bc",
          200: "#a8a294",
          300: "#8a8478",
          400: "#6a6458",
          500: "#5a554c",
          600: "#3a352d",
          700: "#2a241c",
        },
      },
      fontFamily: {
        display: ['"Cinzel"', "Georgia", "serif"],
        body: ['"Cormorant Garamond"', "Georgia", "serif"],
        mono: ['"JetBrains Mono"', '"Fira Code"', "monospace"],
      },
      letterSpacing: {
        imperial: "0.18em",
        carved: "0.28em",
      },
      boxShadow: {
        "gold-glow":
          "0 0 24px -4px rgba(201, 168, 76, 0.25), 0 2px 0 0 rgba(201, 168, 76, 0.15) inset",
        "gold-rim":
          "0 0 0 1px rgba(201, 168, 76, 0.18), 0 12px 32px -16px rgba(0, 0, 0, 0.9)",
        chiseled:
          "inset 0 1px 0 0 rgba(201, 168, 76, 0.08), inset 0 -1px 0 0 rgba(0, 0, 0, 0.6), 0 16px 32px -24px #000",
      },
      backgroundImage: {
        "stone-grain":
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.07  0 0 0 0 0.06  0 0 0 0 0.05  0 0 0 0.5 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/></svg>\")",
        "ember-glow":
          "radial-gradient(ellipse 80% 50% at 50% 100%, rgba(201, 168, 76, 0.12), transparent 60%)",
        "torch-light":
          "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(201, 168, 76, 0.08), transparent 70%)",
      },
      keyframes: {
        "gold-flicker": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.85" },
        },
        "ember-rise": {
          "0%": { transform: "translateY(0) scale(1)", opacity: "0" },
          "20%": { opacity: "0.8" },
          "100%": { transform: "translateY(-100vh) scale(0.4)", opacity: "0" },
        },
      },
      animation: {
        "gold-flicker": "gold-flicker 4s ease-in-out infinite",
        "ember-rise": "ember-rise 8s linear infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;

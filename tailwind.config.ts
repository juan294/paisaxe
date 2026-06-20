import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        // Brand tokens — standardised accent is Tailwind green-500 (#22c55e).
        // Use `paisaxe-green` / `paisaxe-green-hover` on conversion surfaces
        // instead of raw green-500/green-400 utilities.
        paisaxe: {
          green: "#22c55e",       // = Tailwind green-500
          "green-hover": "#4ade80", // = Tailwind green-400
          blue: "#0077b6",
          sand: "#e9c46a",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        soundbar: {
          "0%, 100%": { transform: "scaleY(1)" },
          "50%": { transform: "scaleY(0.6)" },
        },
        "gradient-shift": {
          "0%, 100%": { transform: "translate(0%, 0%) rotate(0deg)" },
          "25%": { transform: "translate(5%, 5%) rotate(1deg)" },
          "50%": { transform: "translate(0%, 10%) rotate(0deg)" },
          "75%": { transform: "translate(-5%, 5%) rotate(-1deg)" },
        },
        "gradient-shift-reverse": {
          "0%, 100%": { transform: "translate(0%, 0%) rotate(0deg)" },
          "25%": { transform: "translate(-5%, -5%) rotate(-1deg)" },
          "50%": { transform: "translate(0%, -10%) rotate(0deg)" },
          "75%": { transform: "translate(5%, -5%) rotate(1deg)" },
        },
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "cursor-blink": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
      },
      animation: {
        soundbar: "soundbar 0.8s ease-in-out infinite",
        "gradient-shift": "gradient-shift 20s ease-in-out infinite",
        "gradient-shift-reverse": "gradient-shift-reverse 25s ease-in-out infinite",
        "fade-in-up": "fade-in-up 0.8s ease-out forwards",
        "fade-in-up-delay-1": "fade-in-up 0.8s ease-out 0.1s forwards",
        "fade-in-up-delay-2": "fade-in-up 0.8s ease-out 0.2s forwards",
        "fade-in-up-delay-3": "fade-in-up 0.8s ease-out 0.4s forwards",
        "cursor-blink": "cursor-blink 1.06s step-end infinite",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
} satisfies Config;

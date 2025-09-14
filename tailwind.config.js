/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'brand-primary': '#4338ca', // Indigo 700
        'brand-secondary': '#10b981', // Emerald 500
        'background': '#111827', // Slate 900
        'surface': '#1f2937', // Slate 800
        'primary-text': '#f3f4f6', // Slate 100
        'secondary-text': '#9ca3af', // Slate 400
      }
    },
  },
  plugins: [],
}

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./{components,src}/**/*.{js,ts,jsx,tsx}",
    "./App.tsx",
    "./index.tsx",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}


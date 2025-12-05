/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // <--- THIS IS MISSING! ADD THIS LINE.
  theme: {
    extend: {},
  },
  plugins: [],
}
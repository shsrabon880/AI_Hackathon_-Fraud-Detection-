/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        obsidian: "#070b14",
        navyCard: "#0d1322",
        navyBorder: "#1d2842",
        sidebarBg: "#120f24",
        sidebarActive: "#2e2259",
        sidebarAccent: "#a78bfa",
      },
    },
  },
  plugins: [],
};

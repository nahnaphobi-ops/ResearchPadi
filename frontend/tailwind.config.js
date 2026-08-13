/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#0E1B4D',
          deep: '#091236',
          hover: '#16245F',
          mid: '#24356F',
          soft: '#E8EFFF',
          mist: '#F5F7FF',
        },
        brand: {
          DEFAULT: '#3B6EFF',
          hover: '#2F5CE8',
          deep: '#1E4ED8',
          soft: '#E8EFFF',
          mist: '#F5F7FF',
        },
        gold: '#F5C400',
        alert: '#FF4B4B',
        ink: '#0E1B4D',
        muted: '#6B7C93',
        rule: '#E6EAF4',
        paper: '#FFFFFF',
        teal: {
          DEFAULT: '#3B6EFF',
          hover: '#2F5CE8',
          deep: '#1E4ED8',
          soft: '#E8EFFF',
          mist: '#F5F7FF',
        },
      },
      fontFamily: {
        sans: ['Poppins', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        card: '0 16px 40px rgba(14, 27, 77, 0.08)',
        soft: '0 10px 28px rgba(14, 27, 77, 0.06)',
      },
    },
  },
  plugins: [],
}

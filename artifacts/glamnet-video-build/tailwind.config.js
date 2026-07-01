/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fdf8f6',
          100: '#f2e8e5',
          200: '#eaddd8',
          300: '#e0cec7',
          400: '#d2bab0',
          500: '#c09f92',
          600: '#ab8173',
          700: '#8e6255',
          800: '#755146',
          900: '#61443b',
          950: '#34231d',
        },
        accent: {
          50: '#fff0f1',
          100: '#ffe3e5',
          200: '#ffcdd0',
          300: '#ffabb1',
          400: '#ff7b84',
          500: '#ff4d58',
          600: '#ed2c39',
          700: '#c81c27',
          800: '#a51b24',
          900: '#881b24',
          950: '#4b090f',
        }
      },
      fontFamily: {
        display: ['"Playfair Display"', 'serif'],
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
      }
    },
  },
  plugins: [],
}

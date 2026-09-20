/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        luxury: {
          white: "#FFFFFF",
          black: "#111111",
          text: "#111111",
          border: "#EAEAEA",
          muted: "#767676",
          subtle: "#F7F7F7",
          cardBg: "#FAFAFA"
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        editorial: ['"Cormorant Garamond"', 'Didot', '"Bodoni MT"', 'serif'],
      },
      letterSpacing: {
        'luxury': '0.15em',
        'luxury-wide': '0.25em',
        'luxury-widest': '0.35em',
      },
      transitionTimingFunction: {
        'luxury': 'cubic-bezier(0.16, 1, 0.3, 1)',
      }
    },
  },
  plugins: [],
}

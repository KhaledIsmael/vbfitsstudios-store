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
        },
        spec: {
          text: "#2D2D2D",
          muted: "#6B6B6B",
          light: "#8E8E8E",
          inactive: "#ADADAD",
          border: "#DDDDDD",
          borderLight: "#E0DEDB",
          btnPrimary: "#4D4D4D",
          btnHover: "#000000",
          badgeNew: "#E4E4E4",
          badgeRestock: "#CDCCCC",
          badgeSale: "#C60C0C",
          scrim: "rgba(0, 0, 0, 0.5)",
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        editorial: ['"Cormorant Garamond"', 'Didot', '"Bodoni MT"', 'serif'],
        spec: ['Helvetica', 'Arial', 'sans-serif'],
      },
      letterSpacing: {
        'luxury': '0.15em',
        'luxury-wide': '0.25em',
        'luxury-widest': '0.35em',
        'spec': '-0.5px',
        'spec-wide': '1px',
      },
      spacing: {
        'spec-gap': '8px',
        'spec-grid': '16px',
        'gutter-mobile': '16px',
        'gutter-desk': '32px',
      },
      maxWidth: {
        'site': '1900px',
        'site-big': '1900px',
        'hero': '3840px',
        'post': '850px',
      },
      borderRadius: {
        'spec': '0px',
        'spec-button': '0px',
      },
      zIndex: {
        'header': '40',
        'whatsapp': '45',
        'scrim': '49',
        'drawer': '50',
        'toast': '60',
        'modal': '70',
      },
      transitionTimingFunction: {
        'luxury': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'drawer': 'cubic-bezier(0.12, 0.67, 0.53, 1)',
        'slow-out': 'cubic-bezier(0, 0, 0.3, 1)',
      },
      transitionDuration: {
        'short': '100ms',
        'default': '200ms',
        'announcement': '250ms',
        'medium': '300ms',
        'long': '500ms',
        'extra-long': '600ms',
        'zoom': '1500ms',
        'extended': '3000ms',
      }
    },
  },
  plugins: [],
}

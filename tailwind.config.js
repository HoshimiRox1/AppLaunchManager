/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: {
          bg: '#FDFBF7',
          surface: '#F5F0E8',
          hover: '#EDE4D3',
          border: '#E2D9CC',
          accent: '#C9A96E',
          danger: '#D97B6C',
          textPrimary: '#3D3530',
          textSecondary: '#9C8F85',
          textDisabled: '#C4BAB3',
        },
      },
      boxShadow: {
        card: '0 2px 8px rgba(61,53,48,0.07)',
        hover: '0 4px 16px rgba(61,53,48,0.10)',
        modal: '0 8px 32px rgba(61,53,48,0.14)',
      },
      borderRadius: {
        card: '16px',
        panel: '16px',
      },
      transitionTimingFunction: {
        warm: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

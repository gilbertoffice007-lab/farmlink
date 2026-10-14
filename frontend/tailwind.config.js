/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        forest: '#163D2B',
        pine: '#0E2A1E',
        farm: { DEFAULT: '#28784A', dark: '#1d5c38', light: '#e6f2ea' },
        leaf: '#75A85B',
        lime: '#B9D97A',
        cream: '#F8F7F0',
        sand: '#EFEAD9',
        charcoal: '#202923',
        muted: '#66736A',
        line: '#E4E9E1',
        gold: '#C9A227'
      },
      fontFamily: {
        sans: ['Inter', 'Manrope', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'serif']
      },
      boxShadow: {
        card: '0 1px 2px rgba(22,61,43,.06), 0 4px 16px rgba(22,61,43,.07)',
        lift: '0 8px 30px rgba(22,61,43,.14)',
        glow: '0 0 0 4px rgba(40,120,74,.15)'
      },
      borderRadius: { xl2: '1.1rem' },
      keyframes: {
        marquee: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
        floaty: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } },
        shimmer: { from: { backgroundPosition: '200% 0' }, to: { backgroundPosition: '-200% 0' } }
      },
      animation: {
        marquee: 'marquee 28s linear infinite',
        floaty: 'floaty 5s ease-in-out infinite',
        shimmer: 'shimmer 1.6s linear infinite'
      }
    }
  },
  plugins: []
}

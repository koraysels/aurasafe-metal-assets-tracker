import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: ['./src/app/**/*.{ts,tsx}', './src/components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#0ea5e9' },
      },
    },
  },
  plugins: [],
} satisfies Config;

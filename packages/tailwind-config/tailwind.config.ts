import type { Config } from 'tailwindcss/types/config';

export default {
  theme: {
    extend: {
      fontFamily: {
        sans: ['Aeonik', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} as Omit<Config, 'content'>;

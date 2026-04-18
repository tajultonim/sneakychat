/** @type {import('tailwindcss').Config} */

export default {
  content: ['./index.html', './src/**/*.{svelte,ts}', './src/**/*.{html,js,ts,jsx,tsx,svelte}'],
  theme: {
    extend: {
      colors: {
        fox: '#FF6B35',
        'fox-dark': '#C94B12',
        berry: '#7C3AED',
        'berry-lt': '#A78BFA',
        forest: '#0F1A0F',
        'forest-md': '#1A2E1A',
        leaf: '#4A7C59',
        'leaf-lt': '#6BAE82',
        cream: '#FFF8F0',
        muted: '#6B8F72',
        green: '#00e5a0',
      },
      fontFamily: {
        fredoka: ['"Fredoka One"', 'cursive'],
        nunito: ['Nunito', 'sans-serif'],
      },
      borderRadius: {
        card: '18px',
      },
      keyframes: {
        bobble: {
          '0%,100%': { transform: 'translateY(0) rotate(-2deg)' },
          '50%': { transform: 'translateY(-7px) rotate(2deg)' },
        },
        sneak: {
          from: { transform: 'translateX(-10px) scaleX(1)' },
          to: { transform: 'translateX(10px) scaleX(-1)' },
        },
        dpulse: {
          '0%,100%': { transform: 'scale(1)', opacity: '0.4' },
          '50%': { transform: 'scale(1.5)', opacity: '1' },
        },
        popin: {
          from: { transform: 'scale(0.85)', opacity: '0' },
          to: { transform: 'scale(1)', opacity: '1' },
        },
        blink: {
          '0%,100%': { opacity: '1' },
          '50%': { opacity: '0.35' },
        },
        float: {
          '0%': { transform: 'translate(0,0)', opacity: '0' },
          '10%': { opacity: '0.8' },
          '90%': { opacity: '0.5' },
          '100%': { transform: 'translate(var(--tw-tx),var(--tw-ty))', opacity: '0' },
        },
        modalin: {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        toastin: {
          from: { transform: 'translateY(20px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        fly: {
          '0%': {
            transform: 'translateX(0) translateY(0) rotate(-45deg)',
            opacity: '1',
          },

          // flies away to right
          '49%': {
            transform: 'translateX(20px) translateY(-20px) rotate(-45deg)',
            opacity: '0',
          },

          // instantly reappear on left (hidden)
          '50%': {
            transform: 'translateX(-20px) translateY(20px) rotate(-45deg)',
            opacity: '0',
          },

          // come back into view
          '100%': {
            transform: 'translateX(0) translateY(0) rotate(-45deg)',
            opacity: '1',
          },
        },
      },
      opacityof: {
        from: { opacity: '0', transform: 'scale(0.95)' },
        to: { opacity: '1', transform: 'scale(1)' },
      },
      animation: {
        opacityof: 'opacityof 0.5s ease-out',
        bobble: 'bobble 3s ease-in-out infinite',
        sneak: 'sneak 1.2s ease-in-out infinite alternate',
        dpulse: 'dpulse 1.2s ease-in-out infinite',
        popin: 'popin 0.2s cubic-bezier(0.34,1.56,0.64,1)',
        blink: 'blink 0.8s ease-in-out infinite',
        float: 'float linear infinite',
        modalin: 'modalin 0.3s cubic-bezier(0.34,1.56,0.64,1)',
        toastin: 'toastin 0.3s cubic-bezier(0.34,1.56,0.64,1)',
        fly: 'fly 0.3s ease-in-out',
      },
    },
  },
  plugins: [],
};

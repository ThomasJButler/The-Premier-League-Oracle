/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1e40af',
          light: '#3b82f6',
          dark: '#1e3a8a',
          900: '#1e3a8a',
          800: '#1e40af',
          700: '#2563eb',
          600: '#3b82f6',
          500: '#60a5fa',
          400: '#93c5fd',
          300: '#bfdbfe',
          200: '#dbeafe',
          100: '#eff6ff',
          50: '#f8fafc'
        },
        secondary: {
          DEFAULT: '#4f46e5',
          light: '#6366f1',
          dark: '#4338ca',
          900: '#312e81',
          800: '#3730a3',
          700: '#4338ca',
          600: '#4f46e5',
          500: '#6366f1',
          400: '#818cf8',
          300: '#a5b4fc',
          200: '#c7d2fe',
          100: '#e0e7ff',
          50: '#eef2ff'
        },
        accent: {
          DEFAULT: '#7c3aed',
          light: '#8b5cf6',
          dark: '#6d28d9',
          900: '#581c87',
          800: '#6b21a8',
          700: '#7e22ce',
          600: '#9333ea',
          500: '#a855f7',
          400: '#c084fc',
          300: '#d8b4fe',
          200: '#e9d5ff',
          100: '#f3e8ff',
          50: '#faf5ff'
        },
        dark: {
          bg: '#0f172a',
          card: '#1e293b',
          border: '#334155',
          text: '#e2e8f0',
          'text-muted': '#94a3b8'
        }
      },
      backgroundSize: {
        '300%': '300%'
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-slow': 'bounce 3s infinite',
        'gradient': 'gradient 15s ease infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'float': 'float 6s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite'
      },
      keyframes: {
        gradient: {
          '0%, 100%': {
            'background-size': '300%',
            'background-position': 'left center'
          },
          '50%': {
            'background-size': '300%',
            'background-position': 'right center'
          }
        },
        shimmer: {
          '0%': {
            'background-position': '-1000px 0'
          },
          '100%': {
            'background-position': '1000px 0'
          }
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        glow: {
          '0%, 100%': { boxShadow: '0 0 5px rgba(59, 130, 246, 0.5)' },
          '50%': { boxShadow: '0 0 20px rgba(59, 130, 246, 0.8)' }
        }
      }
    }
  },
  plugins: [
    require('@tailwindcss/forms')
  ]
}
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  corePlugins: {
    // Évite de casser les styles globaux de Scriptor (thème sombre existant)
    preflight: false,
  },
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
}

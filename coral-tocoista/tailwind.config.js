import forms from '@tailwindcss/forms';

/** Identidade visual: rocha em equilíbrio numa colina verde; branco das vestes; Estrela da Alva. */
/** @type {import('tailwindcss').Config} */
export default {
    content: [
        './storage/framework/views/*.php',
        './resources/**/*.blade.php',
        './resources/**/*.js',
    ],
    theme: {
        extend: {
            colors: {
                granite: { DEFAULT: '#2f3330', 700: '#3d423e', 600: '#555b56', 400: '#8a908b' },
                hill: { DEFAULT: '#4f7a34', 700: '#3f6229', 600: '#456c2d', 100: '#e6efdf', 50: '#f3f7ef' },
                stone: { DEFAULT: '#e4e6e1', 50: '#f6f7f4', 200: '#d3d6cf', 300: '#bfc3ba' },
                rust: { DEFAULT: '#b8481a', 700: '#963a14', 100: '#f6e3da' },
            },
            fontFamily: {
                sans: ['"Segoe UI"', 'Roboto', '"Noto Sans"', 'Ubuntu', 'system-ui', 'sans-serif'],
                serif: ['Georgia', '"Times New Roman"', 'serif'],
            },
        },
    },
    plugins: [forms],
};

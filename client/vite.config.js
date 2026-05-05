// הגדרת Vite - בונה הפיתוח והבנייה של ה-Frontend
//
// פרוקסי /api → http://localhost:3001 (השרת שלנו) כך שלא נצטרך להתעסק עם CORS
// בזמן פיתוח. בפרודקשן ה-Frontend וה-Backend ירוצו על אותו דומיין.

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});

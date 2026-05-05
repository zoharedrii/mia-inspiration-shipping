/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      // צבעי המערכת - מותאמים לסטטוסי משלוחים לפי האפיון בעבודה
      colors: {
        status: {
          sent: '#3B82F6',      // כחול - "נשלח"
          received: '#10B981',  // ירוק - "התקבל"
          mismatch: '#F59E0B',  // כתום - "אי-התאמה"
          error: '#EF4444',     // אדום - שגיאה
        },
      },
      fontFamily: {
        // גופן ברירת מחדל לעברית - יותר נעים לעין מאשר Arial
        sans: ['Heebo', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

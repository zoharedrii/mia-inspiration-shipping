// הקומפוננט הראשי של ה-Frontend
//
// מגדיר את הניווט בין המסכים. כרגע יש רק מסך אחד (HomePage)
// אבל המבנה הזה מאפשר להוסיף בקלות /login, /shipments וכו'.

import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
    </Routes>
  );
}

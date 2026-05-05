// Layout - מבנה כללי לכל המסכים הפנימיים: Header למעלה, תוכן באמצע

import Header from './Header.jsx';

export default function Layout({ children }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">{children}</main>
    </div>
  );
}

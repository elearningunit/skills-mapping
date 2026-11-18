import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { installFonts } from '../fonts';
import { AdminApp } from './AdminApp';
import css from './admin.css?inline';

// העיצוב נארז בתוך קובץ ה-JS, כדי שממשק הרשות ייטען מקובץ אחד בלבד
const style = document.createElement('style');
style.textContent = css;
document.head.appendChild(style);

document.documentElement.lang = 'he';
document.documentElement.dir = 'rtl';
installFonts();
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AdminApp />
  </StrictMode>,
);

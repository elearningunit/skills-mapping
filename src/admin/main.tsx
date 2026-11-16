import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { installFonts } from '../fonts';
import { AdminApp } from './AdminApp';
import './admin.css';

document.documentElement.lang = 'he';
document.documentElement.dir = 'rtl';
installFonts();
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AdminApp />
  </StrictMode>,
);

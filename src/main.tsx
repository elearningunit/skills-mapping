import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { installFonts } from './fonts';
import './styles.css';

document.documentElement.lang = 'he';
document.documentElement.dir = 'rtl';
installFonts();
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

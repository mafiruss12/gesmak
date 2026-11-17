import { initTheme } from '@/lib/theme';
initTheme();
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initNativeApp, isNative } from './lib/mobile';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Capacitor (app native Android)
initNativeApp().catch(() => {});


// Service Worker uniquement sur le web (pas dans la WebView native)
if ('serviceWorker' in navigator && !isNative) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'GESMAK_SW_UPDATED') {
      // Nouvelle version déployée : recharger une fois pour prendre les nouveaux chunks
      const k = 'gesmak_sw_reload_' + String(event.data.cache || '');
      try {
        if (!sessionStorage.getItem(k)) {
          sessionStorage.setItem(k, '1');
          window.location.reload();
        }
      } catch {
        window.location.reload();
      }
    }
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

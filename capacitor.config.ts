import type { CapacitorConfig } from '@capacitor/cli';

/**
 * P3 mobile :
 * - server.url = site live (mises à jour sans rebuild APK)
 * - dist embarqué sert de secours au splash ; données métier via IndexedDB (offline.ts)
 * - Pour build 100 % embarqué hors-ligne total : retirer `server.url` et builder avec VITE_BASE=./
 */
const config: CapacitorConfig = {
  appId: 'com.maquismanager.app',
  appName: 'Stock Manager AI',
  webDir: 'dist',
  server: {
    url: 'https://stock-manager-ktp.vercel.app',
    cleartext: false,
    androidScheme: 'https',
    iosScheme: 'https',
    allowNavigation: [
      'stock-manager-ktp.vercel.app',
      '*.vercel.app',
      '*.supabase.co',
      'stock-manager-ai.pages.dev',
    ],
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#0c0a09',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1800,
      backgroundColor: '#0c0a09',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0c0a09',
    },
  },
};

export default config;

import type { CapacitorConfig } from '@capacitor/cli';

/**
 * GESMAK mobile (Capacitor)
 * - server.url = site live (màj sans rebuild APK)
 * - Deux APK : terrain (appId com.gesmak.app) et admin (com.gesmak.admin) via productFlavors Gradle
 */
const config: CapacitorConfig = {
  appId: 'com.gesmak.app',
  appName: 'GESMAK',
  webDir: 'dist',
  server: {
    url: 'https://gesmak.vercel.app',
    cleartext: false,
    androidScheme: 'https',
    iosScheme: 'https',
    allowNavigation: [
      'gesmak.vercel.app',
      '*.vercel.app',
      '*.supabase.co',
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

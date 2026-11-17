import type { CapacitorConfig } from '@capacitor/cli';

/**
 * GESMAK mobile (Capacitor)
 * - server.url = site live
 * - Deux APK : com.gesmak.app et com.gesmak.plus (même libellé GESMAK)
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
    backgroundColor: '#0f172a',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 300,
      launchAutoHide: true,
      backgroundColor: '#0f172a',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0f172a',
    },
  },
};

export default config;

/**
 * Intégration Capacitor (app native Android / iOS)
 */
export const isNative =
  typeof window !== 'undefined' &&
  !!(window as any).Capacitor?.isNativePlatform?.();

export const platform: string =
  typeof window !== 'undefined' && (window as any).Capacitor?.getPlatform
    ? (window as any).Capacitor.getPlatform()
    : 'web';

export async function initNativeApp(): Promise<void> {
  if (!isNative) return;
  try {
    const core = await import('@capacitor/core');
    if (!core.Capacitor.isNativePlatform()) return;
  } catch {
    return;
  }
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#0f172a' });
  } catch {
    /* */
  }
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    // Cacher tout de suite le splash natif (icône carrée noire) → le CSS motion prend le relais
    await SplashScreen.hide({ fadeOutDuration: 150 });
  } catch {
    /* */
  }
  try {
    const { App } = await import('@capacitor/app');
    App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) window.history.back();
      else App.exitApp();
    });
  } catch {
    /* */
  }
}

export async function getNativeOnlineStatus(): Promise<boolean> {
  if (!isNative) return typeof navigator !== 'undefined' ? navigator.onLine : true;
  try {
    const { Network } = await import('@capacitor/network');
    const status = await Network.getStatus();
    return status.connected;
  } catch {
    return navigator.onLine;
  }
}

/**
 * Demande les autorisations appareil (web + WebView APK).
 * Sur Android, le manifeste APK doit déclarer RECORD_AUDIO, CAMERA, LOCATION, etc.
 * sinon le système n’affiche jamais la demande.
 */
export async function requestNativePermissions(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (typeof window === 'undefined') return out;

  // Notifications
  try {
    if ('Notification' in window) {
      if (Notification.permission === 'granted') out.notifications = 'granted';
      else if (Notification.permission === 'denied') out.notifications = 'denied';
      else {
        const r = await Notification.requestPermission();
        out.notifications = r;
      }
    }
  } catch (e) {
    out.notifications = String(e);
  }

  // Micro — déclenche la boîte système Android / Chrome
  try {
    if (navigator.mediaDevices?.getUserMedia) {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      out.microphone = 'granted';
    } else {
      out.microphone = 'unsupported';
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    out.microphone = /denied|NotAllowed|Permission/i.test(msg) ? 'denied' : msg;
  }

  // Caméra
  try {
    if (navigator.mediaDevices?.getUserMedia) {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((t) => t.stop());
      out.camera = 'granted';
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    out.camera = /denied|NotAllowed|Permission/i.test(msg) ? 'denied' : msg;
  }

  // Localisation
  try {
    if (navigator.geolocation) {
      await new Promise<void>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          () => {
            out.location = 'granted';
            resolve();
          },
          (err) => {
            out.location = err.code === 1 ? 'denied' : String(err.message);
            resolve();
          },
          { timeout: 8000, maximumAge: 60000 }
        );
      });
    }
  } catch (e) {
    out.location = String(e);
  }

  return out;
}

/** Lance les demandes natives au démarrage APK (après splash) */
export async function bootstrapNativePermissions(): Promise<void> {
  if (!isNative) return;
  try {
    // Légère attente pour que la WebView soit prête
    await new Promise((r) => setTimeout(r, 600));
    await requestNativePermissions();
  } catch {
    /* */
  }
}

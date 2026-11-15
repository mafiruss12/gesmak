/**
 * Enregistrement des tokens push (FCM / Capacitor).
 * Nécessite config Firebase (VITE_FIREBASE_*) et/ou APK avec google-services.json.
 */
import { supabase } from '@/lib/supabase';
import { Capacitor } from '@capacitor/core';

const LS_TOKEN = 'mm_fcm_token';

export function isPushConfigured(): boolean {
  return Boolean(
    import.meta.env.VITE_FIREBASE_API_KEY &&
      import.meta.env.VITE_FIREBASE_PROJECT_ID &&
      import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID &&
      import.meta.env.VITE_FIREBASE_APP_ID,
  );
}

async function saveToken(userId: string, establishmentId: string | null, token: string, platform: string) {
  try {
    localStorage.setItem(LS_TOKEN, token);
  } catch {
    /* */
  }
  const { error } = await supabase.from('device_push_tokens').upsert(
    {
      user_id: userId,
      establishment_id: establishmentId,
      token,
      platform,
      enabled: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,token' },
  );
  if (error) console.warn('[push] saveToken', error.message);
  return !error;
}

/** Demande permission + enregistre le token pour le user connecté */
export async function registerPushToken(opts: {
  userId: string;
  establishmentId?: string | null;
}): Promise<{ ok: boolean; token?: string; error?: string }> {
  const platformNative = Capacitor.isNativePlatform();

  // --- Capacitor (APK) ---
  if (platformNative) {
    try {
      const { PushNotifications } = await import('@capacitor/push-notifications');
      let perm = await PushNotifications.checkPermissions();
      if (perm.receive !== 'granted') {
        perm = await PushNotifications.requestPermissions();
      }
      if (perm.receive !== 'granted') {
        return { ok: false, error: 'Permission notifications refusée' };
      }
      await PushNotifications.register();

      return await new Promise((resolve) => {
        const t = window.setTimeout(() => resolve({ ok: false, error: 'Timeout enregistrement FCM' }), 15000);
        PushNotifications.addListener('registration', async (token) => {
          window.clearTimeout(t);
          const ok = await saveToken(opts.userId, opts.establishmentId || null, token.value, 'android');
          resolve(ok ? { ok: true, token: token.value } : { ok: false, error: 'Enregistrement token échoué' });
        });
        PushNotifications.addListener('registrationError', (err) => {
          window.clearTimeout(t);
          resolve({ ok: false, error: String((err as any)?.error || err) });
        });
      });
    } catch (e: any) {
      return {
        ok: false,
        error:
          e?.message ||
          'Plugin Push non installé. Ajoutez @capacitor/push-notifications et google-services.json, puis rebuild APK.',
      };
    }
  }

  // --- Web / PWA (Firebase Messaging) ---
  if (!isPushConfigured()) {
    return {
      ok: false,
      error: 'Firebase non configuré (variables VITE_FIREBASE_* manquantes sur Vercel)',
    };
  }

  if (typeof Notification === 'undefined') {
    return { ok: false, error: 'Notifications non supportées' };
  }

  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return { ok: false, error: 'Permission notifications refusée' };

    // Chargement dynamique firebase (évite de casser le build si non installé)
    const { initializeApp, getApps } = await import('firebase/app');
    const { getMessaging, getToken, isSupported } = await import('firebase/messaging');

    const supported = await isSupported();
    if (!supported) return { ok: false, error: 'FCM non supporté sur ce navigateur' };

    const firebaseConfig = {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    };

    const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    const messaging = getMessaging(app);
    const vapid = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;

    let swReg: ServiceWorkerRegistration | undefined;
    try {
      swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      await navigator.serviceWorker.ready;
    } catch (e) {
      console.warn('[push] SW register', e);
    }
    const token = await getToken(
      messaging,
      vapid
        ? { vapidKey: vapid, serviceWorkerRegistration: swReg }
        : swReg
          ? { serviceWorkerRegistration: swReg }
          : undefined,
    );
    if (!token) return { ok: false, error: 'Token FCM vide' };

    const ok = await saveToken(opts.userId, opts.establishmentId || null, token, 'web');
    return ok ? { ok: true, token } : { ok: false, error: 'Sauvegarde token échouée' };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Erreur FCM web' };
  }
}

/** Appelle l’Edge Function pour pousser une notif commande (côté client public après création) */
export async function triggerOrderPush(orderId: string, establishmentId: string) {
  const base = import.meta.env.VITE_SUPABASE_URL || '';
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  if (!base || !key) return;
  try {
    await fetch(`${base}/functions/v1/push-new-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
        apikey: key,
      },
      body: JSON.stringify({ order_id: orderId, establishment_id: establishmentId }),
    });
  } catch (e) {
    console.warn('[push] triggerOrderPush', e);
  }
}

import { isNative, requestNativePermissions } from '@/lib/mobile';
/**
 * Demandes d'accès appareil (web / PWA / WebView APK)
 * Déclenche les boîtes de dialogue système (micro, caméra, GPS, notifications).
 */

const STORAGE_KEY = 'mm_permissions_onboarding_v5';

export type PermissionId =
  | 'notifications'
  | 'location'
  | 'camera'
  | 'microphone'
  | 'storage';

export type PermissionResult = {
  id: PermissionId;
  ok: boolean;
  detail: string;
};

export function hasCompletedPermissionsOnboarding(): boolean {
  // Toujours considéré comme fait — plus de popup automatique
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    /* */
  }
  return true;
}

export function markPermissionsOnboardingDone(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    /* */
  }
}

/** Réafficher l’écran d’autorisations (réglages) */
export function resetPermissionsOnboarding(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* */
  }
}

export async function requestNotifications(): Promise<PermissionResult> {
  if (typeof Notification === 'undefined') {
    return { id: 'notifications', ok: false, detail: 'Non supporté sur cet appareil' };
  }
  try {
    if (Notification.permission === 'granted') {
      return { id: 'notifications', ok: true, detail: 'Déjà autorisé' };
    }
    if (Notification.permission === 'denied') {
      return {
        id: 'notifications',
        ok: false,
        detail: 'Refusé — activez dans Réglages → Applications → GESMAK',
      };
    }
    const res = await Notification.requestPermission();
    return {
      id: 'notifications',
      ok: res === 'granted',
      detail: res === 'granted' ? 'Autorisé' : 'Refusé',
    };
  } catch (e) {
    return { id: 'notifications', ok: false, detail: String(e) };
  }
}

export async function requestLocation(): Promise<PermissionResult> {
  if (!navigator.geolocation) {
    return { id: 'location', ok: false, detail: 'GPS non disponible' };
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      () => resolve({ id: 'location', ok: true, detail: 'Localisation autorisée' }),
      (err) =>
        resolve({
          id: 'location',
          ok: false,
          detail: err.code === 1 ? 'Refusé par l\'utilisateur' : err.message || 'Erreur GPS',
        }),
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 }
    );
  });
}

export async function requestCamera(): Promise<PermissionResult> {
  if (!navigator.mediaDevices?.getUserMedia) {
    return { id: 'camera', ok: false, detail: 'Caméra non disponible' };
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
      audio: false,
    });
    stream.getTracks().forEach((t) => t.stop());
    return { id: 'camera', ok: true, detail: 'Caméra autorisée' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      id: 'camera',
      ok: false,
      detail: /denied|NotAllowed|Permission/i.test(msg)
        ? 'Refusé — activez Micro dans Réglages → Applications → GESMAK'
        : msg,
    };
  }
}

/** Micro — dictée, rapport vocal, mode patron */
export async function requestMicrophone(): Promise<PermissionResult> {
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return { id: 'microphone', ok: false, detail: 'HTTPS requis pour le micro' };
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return { id: 'microphone', ok: false, detail: 'Micro non disponible sur cet appareil' };
  }
  try {
    try {
      const st = await (navigator as any).permissions?.query?.({ name: 'microphone' as PermissionName });
      if (st?.state === 'denied') {
        return {
          id: 'microphone',
          ok: false,
          detail: 'Micro bloqué — Paramètres du site (⋮) → Microphone → Autoriser',
        };
      }
    } catch {
      /* */
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    stream.getTracks().forEach((t) => t.stop());
    return { id: 'microphone', ok: true, detail: 'Micro autorisé' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      id: 'microphone',
      ok: false,
      detail: /denied|NotAllowed|Permission/i.test(msg)
        ? 'Refusé — cliquez à nouveau et acceptez « Autoriser », ou Paramètres du site → Micro'
        : msg,
    };
  }
}

export async function requestStorage(): Promise<PermissionResult> {
  try {
    if (navigator.storage?.persist) {
      const already = await navigator.storage.persisted?.();
      if (already) {
        return { id: 'storage', ok: true, detail: 'Stockage déjà persistant' };
      }
      const ok = await navigator.storage.persist();
      return {
        id: 'storage',
        ok,
        detail: ok
          ? 'Stockage persistant activé (offline plus fiable)'
          : 'Non accordé — le cache peut être effacé par le système',
      };
    }
    return { id: 'storage', ok: true, detail: 'Stockage local disponible' };
  } catch (e) {
    return { id: 'storage', ok: false, detail: String(e) };
  }
}

/** Enchaîne les prompts système (un après l’autre) */
export async function requestAllDevicePermissions(): Promise<PermissionResult[]> {
  const results: PermissionResult[] = [];
  // APK : enchaîne aussi la demande native WebView
  if (isNative) {
    try {
      const native = await requestNativePermissions();
      const map: Record<string, PermissionId> = {
        notifications: 'notifications',
        microphone: 'microphone',
        camera: 'camera',
        location: 'location',
      };
      for (const [k, id] of Object.entries(map)) {
        const v = native[k];
        if (v == null) continue;
        results.push({
          id,
          ok: v === 'granted',
          detail:
            v === 'granted'
              ? 'Autorisé (APK)'
              : v === 'denied'
                ? 'Refusé — Réglages Android → Apps → Stock AI → Autorisations'
                : String(v),
        });
      }
      results.push(await requestStorage());
      return results;
    } catch {
      /* fallback web ci-dessous */
    }
  }
  results.push(await requestNotifications());
  results.push(await requestMicrophone());
  results.push(await requestCamera());
  results.push(await requestLocation());
  results.push(await requestStorage());
  return results;
}

export function sendTestNotification(title: string, body: string): void {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body, icon: '/icons/icon-192.png' });
  } catch {
    /* */
  }
}

/**
 * Ouvre les paramètres de l'app / du téléphone pour accorder micro, caméra, etc.
 * - APK Capacitor / Android WebView : intent paramètres application
 * - iOS (PWA / WebView) : app-settings:
 * - Navigateur : guide + tentative best-effort
 */
export async function openAppSettings(): Promise<{ ok: boolean; detail: string }> {
  // 1) Capacitor App (si plugin présent dans le build natif)
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor.isNativePlatform()) {
      try {
        const { App } = await import('@capacitor/app');
        // @capacitor/app n'ouvre pas toujours Settings ; on tente les intents ci-dessous
        void App;
      } catch {
        /* */
      }
    }
  } catch {
    /* */
  }

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);

  // 2) Android — paramètres de l'application (package com.maquismanager.app)
  if (isAndroid) {
    const packageId = 'com.maquismanager.app';
    const intents = [
      // Paramètres de l'app (Autorisations)
      `intent://#Intent;action=android.settings.APPLICATION_DETAILS_SETTINGS;data=package:${packageId};end`,
      `intent:#Intent;action=android.settings.APPLICATION_DETAILS_SETTINGS;data=package:${packageId};end`,
      // Fallback paramètres généraux
      'intent:#Intent;action=android.settings.SETTINGS;end',
    ];
    for (const href of intents) {
      try {
        const a = document.createElement('a');
        a.href = href;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        a.remove();
        return { ok: true, detail: 'Ouverture des paramètres Android…' };
      } catch {
        /* try next */
      }
    }
    // window.location fallback
    try {
      window.location.href = `intent://#Intent;action=android.settings.APPLICATION_DETAILS_SETTINGS;data=package:${packageId};end`;
      return { ok: true, detail: 'Redirection paramètres…' };
    } catch {
      /* */
    }
  }

  // 3) iOS
  if (isIOS) {
    try {
      window.location.href = 'app-settings:';
      return { ok: true, detail: 'Ouverture des réglages iOS…' };
    } catch {
      /* */
    }
  }

  // 4) Navigateur desktop / autres
  // Impossible d'ouvrir les réglages OS de force — on guide l'utilisateur
  return {
    ok: false,
    detail:
      'Ouvrez manuellement : Réglages → Applications → GESMAK → Autorisations (micro, caméra, localisation, notifications).',
  };
}

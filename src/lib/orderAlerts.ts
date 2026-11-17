/** Alertes commande : permission, son, notification navigateur */

const SOUND_KEY = 'mm_order_sound_ok';
const NOTIF_KEY = 'mm_order_notif_ok';

export function orderSoundEnabled() {
  try {
    return localStorage.getItem(SOUND_KEY) === '1';
  } catch {
    return false;
  }
}

export function setOrderSoundEnabled(v: boolean) {
  try {
    localStorage.setItem(SOUND_KEY, v ? '1' : '0');
  } catch {
    /* */
  }
}

export async function requestOrderAlertPermissions(): Promise<{
  sound: boolean;
  notification: NotificationPermission | 'unsupported';
}> {
  let sound = false;
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (Ctx) {
      const ctx = new Ctx();
      if (ctx.state === 'suspended') await ctx.resume();
      // bip test court
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.frequency.value = 920;
      g.gain.value = 0.04;
      o.start();
      o.stop(ctx.currentTime + 0.08);
      await ctx.close();
      sound = true;
      setOrderSoundEnabled(true);
    }
  } catch {
    sound = false;
  }

  let notification: NotificationPermission | 'unsupported' = 'unsupported';
  if (typeof Notification !== 'undefined') {
    try {
      if (Notification.permission === 'granted') {
        notification = 'granted';
      } else if (Notification.permission !== 'denied') {
        notification = await Notification.requestPermission();
      } else {
        notification = 'denied';
      }
      if (notification === 'granted') {
        try {
          localStorage.setItem(NOTIF_KEY, '1');
        } catch {
          /* */
        }
      }
    } catch {
      notification = 'unsupported';
    }
  }
  return { sound, notification };
}

/** Alerte sonore forte (double bip) */
export function playOrderAlertSound() {
  try {
    if (!orderSoundEnabled() && localStorage.getItem(SOUND_KEY) === '0') return;
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const beep = (t0: number, freq: number) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
      o.start(t0);
      o.stop(t0 + 0.22);
    };
    const now = ctx.currentTime;
    beep(now, 880);
    beep(now + 0.25, 1175);
    setTimeout(() => {
      try {
        void ctx.close();
      } catch {
        /* */
      }
    }, 800);
  } catch {
    /* */
  }
}

export function showOrderBrowserNotification(title: string, body: string) {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const n = new Notification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'mm-new-order',
      requireInteraction: true,
    });
    n.onclick = () => {
      window.focus();
      window.location.href = '/kitchen';
      n.close();
    };
  } catch {
    /* */
  }
}

export function estimateWaitMinutes(status: string, pendingAhead = 0): number {
  const base: Record<string, number> = {
    pending: 8,
    preparing: 5,
    ready: 1,
    served: 0,
    cancelled: 0,
  };
  return (base[status] ?? 8) + pendingAhead * 3;
}

export const ORDER_STATUS_CLIENT: Record<string, string> = {
  pending: 'Reçue — en attente',
  preparing: 'En préparation',
  ready: 'Prête — on arrive',
  served: 'Servie',
  cancelled: 'Annulée',
};

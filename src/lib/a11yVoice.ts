/** Aide terrain — synthèse vocale & sons simples (sans dépendance) */

export function speakFrench(text: string, opts?: { rate?: number; interrupt?: boolean }) {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    return false;
  }
  try {
    if (opts?.interrupt !== false) {
      window.speechSynthesis.cancel();
    }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'fr-FR';
    u.rate = opts?.rate ?? 0.92;
    u.pitch = 1;
    // Préférer une voix française si dispo
    const voices = window.speechSynthesis.getVoices();
    const fr = voices.find((v) => v.lang.toLowerCase().startsWith('fr'));
    if (fr) u.voice = fr;
    window.speechSynthesis.speak(u);
    return true;
  } catch {
    return false;
  }
}

export function stopSpeaking() {
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* */
  }
}

/** Bip court via Web Audio (vert = OK, rouge = écart) */
export function playTone(kind: 'ok' | 'warn' | 'tap') {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    if (kind === 'ok') {
      o.frequency.value = 660;
      g.gain.value = 0.08;
      o.start();
      o.stop(ctx.currentTime + 0.18);
      const o2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      o2.connect(g2);
      g2.connect(ctx.destination);
      o2.frequency.value = 880;
      g2.gain.value = 0.06;
      o2.start(ctx.currentTime + 0.16);
      o2.stop(ctx.currentTime + 0.32);
    } else if (kind === 'warn') {
      o.frequency.value = 220;
      g.gain.value = 0.1;
      o.type = 'square';
      o.start();
      o.stop(ctx.currentTime + 0.35);
    } else {
      o.frequency.value = 440;
      g.gain.value = 0.05;
      o.start();
      o.stop(ctx.currentTime + 0.06);
    }
    setTimeout(() => {
      try {
        ctx.close();
      } catch {
        /* */
      }
    }, 500);
  } catch {
    /* */
  }
}

/** Phrase orale simple pour le rapport du jour */
export function buildReportSpeech(opts: {
  establishmentName?: string;
  date: string;
  items: { name: string; qty: number; total: number }[];
  theoretical: number;
  cash: number;
  mobile: number;
  match: boolean;
  diff: number;
}): string {
  const est = opts.establishmentName || 'le maquis';
  const parts: string[] = [];
  parts.push(`Rapport du jour pour ${est}, date ${opts.date}.`);
  if (!opts.items.length) {
    parts.push('Aucune boisson saisie.');
  } else {
    parts.push('Boissons vendues :');
    opts.items.forEach((it) => {
      parts.push(`${it.name}, ${it.qty}.`);
    });
  }
  parts.push(`Total théorique : ${Math.round(opts.theoretical)} francs.`);
  parts.push(`Espèces : ${Math.round(opts.cash)} francs.`);
  parts.push(`Mobile money : ${Math.round(opts.mobile)} francs.`);
  if (opts.match) {
    parts.push('Caisse correcte. Les montants coincident.');
  } else {
    parts.push(`Attention. Écart de ${Math.round(Math.abs(opts.diff))} francs.`);
  }
  return parts.join(' ');
}

/** Reconnaissance vocale (Chrome / Android surtout) */
export type DictationResult = { transcript: string; qty: number | null };

const FR_NUM: Record<string, number> = {
  zero: 0, zéro: 0,
  un: 1, une: 1,
  deux: 2, trois: 3, quatre: 4, cinq: 5,
  six: 6, sept: 7, huit: 8, neuf: 9, dix: 10,
  onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15,
  seize: 16, vingtsept: 17, dixhuit: 18, 'dix-sept': 17, 'dix-huit': 18, 'dix-neuf': 19,
  vingt: 20, trente: 30, quarante: 40, cinquante: 50,
  soixante: 60, cent: 100,
};

export function parseFrenchQuantity(transcript: string): number | null {
  const t = transcript
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/,/g, '.')
    .trim();
  if (!t) return null;
  // digits first
  const m = t.match(/(\d+(?:\.\d+)?)/);
  if (m) {
    const n = Math.floor(Number(m[1]));
    if (!Number.isNaN(n) && n >= 0) return n;
  }
  // words
  const words = t.split(/[\s-]+/).filter(Boolean);
  let total = 0;
  let current = 0;
  for (const w of words) {
    if (w === 'et') continue;
    if (FR_NUM[w] != null) {
      const v = FR_NUM[w];
      if (v === 100) {
        current = (current || 1) * 100;
      } else if (v >= 20) {
        current += v;
      } else {
        current += v;
      }
    }
  }
  total = current;
  return total > 0 ? total : null;
}


/** Demande explicite du micro (déclenche la boîte système navigateur / APK) */
export async function ensureMicrophone(): Promise<{ ok: boolean; detail: string }> {
  if (typeof window === 'undefined') {
    return { ok: false, detail: 'Environnement non supporté' };
  }
  if (!window.isSecureContext) {
    return { ok: false, detail: 'HTTPS requis pour le micro' };
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return { ok: false, detail: 'Micro non disponible sur cet appareil' };
  }
  try {
    // Permissions API (si dispo) — n'affiche pas la boîte seule, mais informe
    try {
      const st = await (navigator as any).permissions?.query?.({ name: 'microphone' as PermissionName });
      if (st?.state === 'denied') {
        return {
          ok: false,
          detail:
            'Micro bloqué dans le navigateur. Menu ⋮ → Paramètres du site → Microphone → Autoriser, puis rechargez.',
        };
      }
    } catch {
      /* certains navigateurs n'exposent pas permissions.microphone */
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
      },
      video: false,
    });
    stream.getTracks().forEach((t) => t.stop());
    return { ok: true, detail: 'Micro autorisé' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/denied|NotAllowed|Permission/i.test(msg)) {
      return {
        ok: false,
        detail:
          'Micro refusé. Autorisez le micro quand le navigateur le demande, ou dans Paramètres du site.',
      };
    }
    return { ok: false, detail: msg };
  }
}

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
}

export function startQuantityDictation(opts: {
  onResult: (r: DictationResult) => void;
  onError?: (msg: string) => void;
  onEnd?: () => void;
  lang?: string;
}): { stop: () => void } | null {
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SR) {
    opts.onError?.('Dictée non disponible sur cet appareil. Utilisez Chrome sur Android.');
    return null;
  }
  const rec = new SR();
  rec.lang = opts.lang || 'fr-FR';
  rec.interimResults = false;
  rec.maxAlternatives = 3;
  rec.continuous = false;

  rec.onresult = (ev: any) => {
    let best = '';
    try {
      best = ev.results[0][0].transcript as string;
    } catch {
      /* */
    }
    const qty = parseFrenchQuantity(best);
    opts.onResult({ transcript: best, qty });
  };
  rec.onerror = (ev: any) => {
    const err = String(ev?.error || 'erreur');
    if (err === 'not-allowed') opts.onError?.('Micro refusé. Ouvrez Paramètres du site → Microphone → Autoriser, puis réessayez.');
    else if (err === 'no-speech') opts.onError?.('Aucune voix détectée. Réessayez.');
    else opts.onError?.(`Dictée: ${err}`);
  };
  rec.onend = () => opts.onEnd?.();
  try {
    rec.start();
  } catch {
    opts.onError?.('Impossible de démarrer le micro.');
    return null;
  }
  return {
    stop: () => {
      try {
        rec.stop();
      } catch {
        /* */
      }
    },
  };
}

/** Enregistre un vocal (MediaRecorder) — pour joindre dans WhatsApp */
export async function recordVoiceNote(
  durationMs: number,
  onTick?: (remainingSec: number) => void
): Promise<Blob | null> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : '';
    const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    const chunks: BlobPart[] = [];
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    const done = new Promise<Blob | null>((resolve) => {
      rec.onstop = () => {
        stream.getTracks().forEach((tr) => tr.stop());
        if (!chunks.length) resolve(null);
        else resolve(new Blob(chunks, { type: rec.mimeType || 'audio/webm' }));
      };
    });
    rec.start();
    const end = Date.now() + durationMs;
    const iv = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      onTick?.(left);
    }, 250);
    await new Promise((r) => setTimeout(r, durationMs));
    window.clearInterval(iv);
    if (rec.state !== 'inactive') rec.stop();
    return await done;
  } catch {
    return null;
  }
}

export async function shareAudioToWhatsApp(blob: Blob, filename = 'rapport-vocal.webm'): Promise<boolean> {
  const file = new File([blob], filename, { type: blob.type || 'audio/webm' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: 'Rapport du jour',
        text: 'Vocal rapport du jour — GESMAK',
      });
      return true;
    }
  } catch {
    /* user cancel or fail */
  }
  // fallback download
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    /* */
  }
  return false;
}

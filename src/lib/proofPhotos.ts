/**
 * Preuves photo boissons (ventes / stock)
 */
import { supabase } from '@/lib/supabase';

export type ProofKind = 'sale' | 'arrivage' | 'stock' | 'other';

export type StockProofPhoto = {
  id: string;
  establishment_id: string;
  product_id: string | null;
  kind: ProofKind;
  image_url: string;
  note: string | null;
  taken_at: string;
  taken_by: string | null;
  created_at: string;
  updated_at?: string;
  product?: { name?: string } | null;
};

export async function compressImageFile(file: Blob, maxSide = 1280, quality = 0.72): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bmp.close();
      return file;
    }
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', quality)
    );
    return blob || file;
  } catch {
    return file;
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('Lecture fichier impossible'));
    r.readAsDataURL(blob);
  });
}

export async function uploadProofImage(
  establishmentId: string,
  file: Blob
): Promise<{ url: string; via: 'storage' | 'inline' }> {
  const compressed = await compressImageFile(file);
  const path = `${establishmentId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;

  try {
    const { error } = await supabase.storage.from('stock-proofs').upload(path, compressed, {
      contentType: 'image/jpeg',
      upsert: true,
    });
    if (!error) {
      const { data } = supabase.storage.from('stock-proofs').getPublicUrl(path);
      if (data?.publicUrl) return { url: data.publicUrl, via: 'storage' };
    } else {
      console.warn('[proofPhotos] storage upload', error.message);
    }
  } catch (e) {
    console.warn('[proofPhotos] storage exception', e);
  }

  // Fallback data-URL compressé
  let dataUrl = await blobToDataUrl(compressed);
  if (dataUrl.length > 700_000) {
    const smaller = await compressImageFile(file, 720, 0.5);
    dataUrl = await blobToDataUrl(smaller);
  }
  return { url: dataUrl, via: 'inline' };
}

export async function listProofPhotos(establishmentId: string): Promise<StockProofPhoto[]> {
  const { data, error } = await supabase
    .from('stock_proof_photos')
    .select('*, product:products(name)')
    .eq('establishment_id', establishmentId)
    .order('taken_at', { ascending: false })
    .limit(120);
  if (error) {
    console.warn('[proofPhotos]', error.message);
    return [];
  }
  return (data || []) as StockProofPhoto[];
}

export async function createProofPhoto(opts: {
  establishmentId: string;
  productId?: string | null;
  kind?: ProofKind;
  imageUrl: string;
  note?: string;
  userId?: string | null;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const row: Record<string, unknown> = {
    establishment_id: opts.establishmentId,
    product_id: opts.productId || null,
    kind: opts.kind || 'sale',
    image_url: opts.imageUrl,
    note: opts.note || null,
    taken_at: new Date().toISOString(),
  };
  // taken_by optionnel (évite erreur FK)
  if (opts.userId) row.taken_by = opts.userId;

  let { data, error } = await supabase.from('stock_proof_photos').insert(row).select('id').single();

  // Retry sans taken_by / product_id si contrainte
  if (error) {
    const soft: Record<string, unknown> = {
      establishment_id: opts.establishmentId,
      product_id: null,
      kind: opts.kind || 'sale',
      image_url: opts.imageUrl,
      note: opts.note || null,
      taken_at: new Date().toISOString(),
    };
    const retry = await supabase.from('stock_proof_photos').insert(soft).select('id').single();
    data = retry.data;
    error = retry.error;
  }

  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data?.id };
}

export async function updateProofPhoto(
  id: string,
  patch: { note?: string; product_id?: string | null; kind?: ProofKind; image_url?: string }
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('stock_proof_photos')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteProofPhoto(id: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from('stock_proof_photos').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Ouvre caméra ou galerie de façon fiable sur mobile (input dans le DOM).
 * capture=true → caméra ; false → galerie.
 */
export function pickPhotoFromDevice(capture = true): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = false;
    // iOS / Android
    if (capture) {
      input.setAttribute('capture', 'environment');
    } else {
      input.removeAttribute('capture');
    }
    // Doit être dans le DOM pour beaucoup de navigateurs mobiles
    input.style.cssText =
      'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0.01;z-index:99999;';
    document.body.appendChild(input);

    let settled = false;
    const finish = (file: File | null) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('focus', onFocus);
      try {
        input.remove();
      } catch {
        /* */
      }
      resolve(file);
    };

    input.addEventListener('change', () => {
      finish(input.files?.[0] || null);
    });

    // Annulation (retour sans choisir)
    const onFocus = () => {
      window.setTimeout(() => {
        if (!settled && (!input.files || input.files.length === 0)) {
          finish(null);
        }
      }, 800);
    };
    window.addEventListener('focus', onFocus);

    // Timeout sécurité
    window.setTimeout(() => {
      if (!settled) finish(null);
    }, 120000);

    // Déclenchement synchrone dans le geste utilisateur
    try {
      input.click();
    } catch {
      finish(null);
    }
  });
}

/** Traite un File déjà choisi (input visible onChange) */
export async function processPickedFile(
  establishmentId: string,
  file: File,
  opts?: { productId?: string | null; kind?: ProofKind; note?: string; userId?: string | null }
): Promise<{ ok: boolean; id?: string; error?: string; url?: string }> {
  try {
    if (!file.type.startsWith('image/') && !file.name.match(/\.(jpe?g|png|webp|gif)$/i)) {
      return { ok: false, error: 'Fichier non image' };
    }
    const { url } = await uploadProofImage(establishmentId, file);
    const r = await createProofPhoto({
      establishmentId,
      productId: opts?.productId,
      kind: opts?.kind || 'sale',
      imageUrl: url,
      note: opts?.note,
      userId: opts?.userId,
    });
    return { ...r, url };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erreur photo' };
  }
}

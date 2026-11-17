import { supabase } from '@/lib/supabase';
import { compressImageFile } from '@/lib/proofPhotos';

const BUCKET = 'public-vitrine';

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('Lecture fichier impossible'));
    r.readAsDataURL(blob);
  });
}

/** Upload image vitrine (cover / logo). Storage public-vitrine, sinon data-URL. */
export async function uploadVitrineImage(
  establishmentId: string,
  file: Blob,
  kind: 'cover' | 'logo' | 'gallery' = 'cover'
): Promise<{ url: string; via: 'storage' | 'inline' }> {
  const compressed = await compressImageFile(file, kind === 'logo' ? 512 : 1600, 0.78);
  const path = `${establishmentId}/${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`;

  try {
    const { error } = await supabase.storage.from(BUCKET).upload(path, compressed, {
      contentType: 'image/jpeg',
      upsert: true,
    });
    if (!error) {
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      if (data?.publicUrl) return { url: data.publicUrl, via: 'storage' };
    }
  } catch {
    /* */
  }

  let dataUrl = await blobToDataUrl(compressed);
  if (dataUrl.length > 600_000) {
    const smaller = await compressImageFile(file, 720, 0.55);
    dataUrl = await blobToDataUrl(smaller);
  }
  return { url: dataUrl, via: 'inline' };
}

/** Récupère la position GPS actuelle et un libellé lisible */
export async function captureClientLocation(): Promise<{
  lat: number;
  lng: number;
  label: string;
  mapsUrl: string;
}> {
  if (!navigator.geolocation) {
    throw new Error('Géolocalisation non disponible sur cet appareil.');
  }
  const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0,
    });
  });
  const lat = pos.coords.latitude;
  const lng = pos.coords.longitude;
  const mapsUrl = `https://maps.google.com/?q=${lat},${lng}`;
  let label = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
      { headers: { Accept: 'application/json' } }
    );
    if (res.ok) {
      const data = await res.json();
      if (data?.display_name) {
        label = data.display_name as string;
      }
    }
  } catch {
    /* garde les coordonnées */
  }
  return { lat, lng, label, mapsUrl };
}

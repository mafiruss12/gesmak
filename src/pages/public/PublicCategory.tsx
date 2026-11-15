import { Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';

const MAP: Record<string, string> = {
  '/restaurants': 'restaurant',
  '/restaurant': 'restaurant',
  '/maquis': 'maquis',
  '/bars': 'bar',
  '/bar': 'bar',
};

export default function PublicCategory() {
  const loc = useLocation();
  const type = MAP[loc.pathname] || '';
  useEffect(() => {
    const label = type || 'Établissements';
    document.title = `${label.charAt(0).toUpperCase() + label.slice(1)} · GESMAK`;
  }, [type]);
  return <Navigate to={type ? `/establishments?type=${encodeURIComponent(type)}` : '/establishments'} replace />;
}

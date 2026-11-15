const KEY = 'mm_theme';

export type ThemeMode = 'dark' | 'light';

export function getStoredTheme(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {
    /* */
  }
  return 'light';
}

export function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  root.setAttribute('data-theme', mode);
  if (mode === 'light') {
    root.classList.add('theme-light');
    root.classList.remove('theme-dark');
  } else {
    root.classList.add('theme-dark');
    root.classList.remove('theme-light');
  }
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    /* */
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', mode === 'light' ? '#F5F5F5' : '#0D0D0D');
}

export function initTheme() {
  applyTheme(getStoredTheme());
}

export function toggleTheme(): ThemeMode {
  const next: ThemeMode = getStoredTheme() === 'light' ? 'dark' : 'light';
  applyTheme(next);
  return next;
}

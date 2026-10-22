/**
 * Sonara 6-Theme Studio Engine
 * Contains 3 Premium Dark Themes & 3 Elegant Light Themes
 */

export const APP_THEMES = [
  // ==========================================
  // 🌙 3 DARK THEMES
  // ==========================================
  {
    id: 'dark_emerald',
    name: 'Midnight Emerald',
    type: 'dark',
    tag: 'Classic Spotify',
    accent: '#1db954',
    appBg: '#05070c',
    bgDark: '#090d14',
    bgSurface: '#121824',
    textMain: '#ffffff',
    textMuted: '#94a3b8',
    navBg: 'rgba(9, 13, 20, 0.85)',
    miniPlayerBg: 'rgba(9, 13, 20, 0.92)',
    headerBg: 'rgba(9, 13, 20, 0.85)',
    cardBg: 'rgba(255, 255, 255, 0.05)',
    borderSubtle: 'rgba(255, 255, 255, 0.08)',
    desc: 'Deep Obsidian with Spotify green glow'
  },
  {
    id: 'dark_cyber',
    name: 'Neon Cyberpunk',
    type: 'dark',
    tag: 'Synthwave',
    accent: '#a855f7',
    appBg: '#0b0717',
    bgDark: '#110c24',
    bgSurface: '#1a1336',
    textMain: '#ffffff',
    textMuted: '#a39bc2',
    navBg: 'rgba(17, 12, 36, 0.85)',
    miniPlayerBg: 'rgba(17, 12, 36, 0.92)',
    headerBg: 'rgba(17, 12, 36, 0.85)',
    cardBg: 'rgba(168, 85, 247, 0.07)',
    borderSubtle: 'rgba(168, 85, 247, 0.15)',
    desc: 'Space noir with vivid electric violet'
  },
  {
    id: 'dark_abyssal',
    name: 'Abyssal Sapphire',
    type: 'dark',
    tag: 'Deep Ocean',
    accent: '#38bdf8',
    appBg: '#040d1a',
    bgDark: '#071529',
    bgSurface: '#0e223f',
    textMain: '#ffffff',
    textMuted: '#8aa4c4',
    navBg: 'rgba(7, 21, 41, 0.85)',
    miniPlayerBg: 'rgba(7, 21, 41, 0.92)',
    headerBg: 'rgba(7, 21, 41, 0.85)',
    cardBg: 'rgba(56, 189, 248, 0.07)',
    borderSubtle: 'rgba(56, 189, 248, 0.15)',
    desc: 'Deep midnight navy with Arctic ice blue'
  },

  // ==========================================
  // ☀️ 3 LIGHT THEMES
  // ==========================================
  {
    id: 'light_snow',
    name: 'Snow Pearl',
    type: 'light',
    tag: 'Pure Porcelain',
    accent: '#059669',
    appBg: '#f8fafc',
    bgDark: '#ffffff',
    bgSurface: '#f1f5f9',
    textMain: '#0f172a',
    textMuted: '#475569',
    navBg: 'rgba(255, 255, 255, 0.92)',
    miniPlayerBg: 'rgba(255, 255, 255, 0.96)',
    headerBg: 'rgba(255, 255, 255, 0.92)',
    cardBg: 'rgba(0, 0, 0, 0.035)',
    borderSubtle: 'rgba(0, 0, 0, 0.08)',
    desc: 'Clean porcelain white with fresh emerald mint'
  },
  {
    id: 'light_rose',
    name: 'Blush Rose',
    type: 'light',
    tag: 'Warm Coral',
    accent: '#e11d48',
    appBg: '#fff1f2',
    bgDark: '#ffffff',
    bgSurface: '#ffe4e6',
    textMain: '#1c1917',
    textMuted: '#881337',
    navBg: 'rgba(255, 255, 255, 0.92)',
    miniPlayerBg: 'rgba(255, 255, 255, 0.96)',
    headerBg: 'rgba(255, 255, 255, 0.92)',
    cardBg: 'rgba(225, 29, 72, 0.035)',
    borderSubtle: 'rgba(225, 29, 72, 0.09)',
    desc: 'Warm soft blush with rich crimson accents'
  },
  {
    id: 'light_nordic',
    name: 'Nordic Frost',
    type: 'light',
    tag: 'Cool Iceberg',
    accent: '#2563eb',
    appBg: '#f0f4f9',
    bgDark: '#ffffff',
    bgSurface: '#e2e8f0',
    textMain: '#0f172a',
    textMuted: '#334155',
    navBg: 'rgba(255, 255, 255, 0.92)',
    miniPlayerBg: 'rgba(255, 255, 255, 0.96)',
    headerBg: 'rgba(255, 255, 255, 0.92)',
    cardBg: 'rgba(37, 99, 235, 0.035)',
    borderSubtle: 'rgba(37, 99, 235, 0.09)',
    desc: 'Cool iceberg slate with royal sapphire cobalt'
  }
];

export const DARK_THEMES = APP_THEMES.filter(t => t.type === 'dark');
export const LIGHT_THEMES = APP_THEMES.filter(t => t.type === 'light');

const THEME_KEY = 'sonara_theme_id';

export function getSavedThemeId() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved && APP_THEMES.some(t => t.id === saved)) {
    return saved;
  }
  // Fallback migration: check if old accent matches any theme accent
  const oldAccent = localStorage.getItem('sonara_accent_theme');
  if (oldAccent) {
    const matched = APP_THEMES.find(t => t.accent.toLowerCase() === oldAccent.toLowerCase());
    if (matched) return matched.id;
  }
  return 'dark_emerald';
}

export function getThemeById(id) {
  return APP_THEMES.find(t => t.id === id) || APP_THEMES[0];
}

export function saveThemeId(id) {
  localStorage.setItem(THEME_KEY, id);
  const theme = getThemeById(id);
  localStorage.setItem('sonara_accent_theme', theme.accent);
}

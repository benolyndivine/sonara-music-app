/**
 * Sonara 12-Theme Studio Engine
 * Contains 6 Premium Dark Themes & 6 Elegant Light Themes
 */

export const APP_THEMES = [
  // ==========================================
  // 🌙 6 PREMIUM DARK THEMES
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
    navBg: 'rgba(9, 13, 20, 0.82)',
    miniPlayerBg: 'rgba(9, 13, 20, 0.90)',
    headerBg: 'rgba(9, 13, 20, 0.85)',
    cardBg: 'rgba(255, 255, 255, 0.05)',
    borderSubtle: 'rgba(255, 255, 255, 0.08)',
    desc: 'Deep obsidian with Spotify green glow'
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
    navBg: 'rgba(17, 12, 36, 0.82)',
    miniPlayerBg: 'rgba(17, 12, 36, 0.90)',
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
    navBg: 'rgba(7, 21, 41, 0.82)',
    miniPlayerBg: 'rgba(7, 21, 41, 0.90)',
    headerBg: 'rgba(7, 21, 41, 0.85)',
    cardBg: 'rgba(56, 189, 248, 0.07)',
    borderSubtle: 'rgba(56, 189, 248, 0.15)',
    desc: 'Deep midnight navy with Arctic ice blue'
  },
  {
    id: 'dark_amethyst',
    name: 'Velvet Amethyst',
    type: 'dark',
    tag: 'Royal Twilight',
    accent: '#ec4899',
    appBg: '#130614',
    bgDark: '#1c0c1e',
    bgSurface: '#29132c',
    textMain: '#ffffff',
    textMuted: '#c49abf',
    navBg: 'rgba(28, 12, 30, 0.82)',
    miniPlayerBg: 'rgba(28, 12, 30, 0.90)',
    headerBg: 'rgba(28, 12, 30, 0.85)',
    cardBg: 'rgba(236, 72, 153, 0.07)',
    borderSubtle: 'rgba(236, 72, 153, 0.16)',
    desc: 'Imperial twilight with radiant amethyst glow'
  },
  {
    id: 'dark_apple',
    name: 'Apple Music',
    type: 'dark',
    tag: 'Classic Apple',
    accent: '#fa2d48',
    appBg: '#000000',
    bgDark: '#0a0a0c',
    bgSurface: '#1c1c1e',
    textMain: '#ffffff',
    textMuted: '#8e8e93',
    navBg: 'rgba(20, 20, 22, 0.82)',
    miniPlayerBg: 'rgba(28, 28, 30, 0.92)',
    headerBg: 'rgba(15, 15, 17, 0.85)',
    cardBg: 'rgba(250, 45, 72, 0.08)',
    borderSubtle: 'rgba(255, 255, 255, 0.12)',
    desc: 'Iconic Apple Music red with iOS OLED glass'
  },
  {
    id: 'dark_amber',
    name: 'Solar Amber',
    type: 'dark',
    tag: 'Golden Hour',
    accent: '#f59e0b',
    appBg: '#0f0b04',
    bgDark: '#191307',
    bgSurface: '#261d0b',
    textMain: '#ffffff',
    textMuted: '#c7b693',
    navBg: 'rgba(25, 19, 7, 0.82)',
    miniPlayerBg: 'rgba(25, 19, 7, 0.90)',
    headerBg: 'rgba(25, 19, 7, 0.85)',
    cardBg: 'rgba(245, 158, 11, 0.07)',
    borderSubtle: 'rgba(245, 158, 11, 0.16)',
    desc: 'Smoked espresso noir with molten gold amber'
  },

  // ==========================================
  // ☀️ 6 ELEGANT LIGHT THEMES
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
    navBg: 'rgba(248, 250, 252, 0.92)',
    miniPlayerBg: 'rgba(255, 255, 255, 0.96)',
    headerBg: 'rgba(248, 250, 252, 0.92)',
    cardBg: 'rgba(255, 255, 255, 0.85)',
    borderSubtle: 'rgba(15, 23, 42, 0.08)',
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
    textMuted: '#9f1239',
    navBg: 'rgba(255, 241, 242, 0.92)',
    miniPlayerBg: 'rgba(255, 255, 255, 0.96)',
    headerBg: 'rgba(255, 241, 242, 0.92)',
    cardBg: 'rgba(255, 255, 255, 0.85)',
    borderSubtle: 'rgba(225, 29, 72, 0.12)',
    desc: 'Warm soft blush with rich crimson coral'
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
    textMuted: '#1e3a8a',
    navBg: 'rgba(240, 244, 249, 0.92)',
    miniPlayerBg: 'rgba(255, 255, 255, 0.96)',
    headerBg: 'rgba(240, 244, 249, 0.92)',
    cardBg: 'rgba(255, 255, 255, 0.85)',
    borderSubtle: 'rgba(37, 99, 235, 0.12)',
    desc: 'Cool iceberg slate with royal sapphire cobalt'
  },
  {
    id: 'light_lavender',
    name: 'Lavender Mist',
    type: 'light',
    tag: 'Lilac Breeze',
    accent: '#9333ea',
    appBg: '#faf5ff',
    bgDark: '#ffffff',
    bgSurface: '#f3e8ff',
    textMain: '#1e1035',
    textMuted: '#6b21a8',
    navBg: 'rgba(250, 245, 255, 0.92)',
    miniPlayerBg: 'rgba(255, 255, 255, 0.96)',
    headerBg: 'rgba(250, 245, 255, 0.92)',
    cardBg: 'rgba(255, 255, 255, 0.85)',
    borderSubtle: 'rgba(147, 51, 234, 0.12)',
    desc: 'Pastel lilac breeze with royal violet essence'
  },
  {
    id: 'light_sahara',
    name: 'Golden Sahara',
    type: 'light',
    tag: 'Desert Sun',
    accent: '#d97706',
    appBg: '#fffbeb',
    bgDark: '#ffffff',
    bgSurface: '#fef3c7',
    textMain: '#2e2007',
    textMuted: '#92400e',
    navBg: 'rgba(255, 251, 235, 0.92)',
    miniPlayerBg: 'rgba(255, 255, 255, 0.96)',
    headerBg: 'rgba(255, 251, 235, 0.92)',
    cardBg: 'rgba(255, 255, 255, 0.85)',
    borderSubtle: 'rgba(217, 119, 6, 0.12)',
    desc: 'Warm sunlit beige with rich desert honey'
  },
  {
    id: 'light_sage',
    name: 'Alpine Mint',
    type: 'light',
    tag: 'Fresh Sage',
    accent: '#0d9488',
    appBg: '#f0fdfa',
    bgDark: '#ffffff',
    bgSurface: '#ccfbf1',
    textMain: '#042f2e',
    textMuted: '#115e59',
    navBg: 'rgba(240, 253, 250, 0.92)',
    miniPlayerBg: 'rgba(255, 255, 255, 0.96)',
    headerBg: 'rgba(240, 253, 250, 0.92)',
    cardBg: 'rgba(255, 255, 255, 0.85)',
    borderSubtle: 'rgba(13, 148, 136, 0.12)',
    desc: 'Crisp mountain morning air with eucalyptus teal'
  }
];

export const DARK_THEMES = APP_THEMES.filter(t => t.type === 'dark');
export const LIGHT_THEMES = APP_THEMES.filter(t => t.type === 'light');

const THEME_KEY = 'sonara_theme_id';

export function getSavedThemeId() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'dark_crimson') return 'dark_apple';
  if (saved && APP_THEMES.some(t => t.id === saved)) {
    return saved;
  }
  // Fallback migration: check if old accent matches any theme accent
  const oldAccent = localStorage.getItem('sonara_accent_theme');
  if (oldAccent) {
    if (oldAccent.toLowerCase() === '#f43f5e') return 'dark_apple';
    const matched = APP_THEMES.find(t => t.accent.toLowerCase() === oldAccent.toLowerCase());
    if (matched) return matched.id;
  }
  return 'dark_emerald';
}

export function getThemeById(id) {
  if (id === 'dark_crimson') return APP_THEMES.find(t => t.id === 'dark_apple') || APP_THEMES[0];
  return APP_THEMES.find(t => t.id === id) || APP_THEMES[0];
}

export function saveThemeId(id) {
  localStorage.setItem(THEME_KEY, id);
  const theme = getThemeById(id);
  localStorage.setItem('sonara_accent_theme', theme.accent);
}

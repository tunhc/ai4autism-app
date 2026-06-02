/**
 * AI4Autism — Pastel Vintage Design Tokens
 * Palette nhẹ nhàng, kiên nhẫn, phù hợp với phụ huynh và giáo viên
 */
export const colors = {
  // ── Backgrounds ──────────────────────────────────────────────
  bg: '#FFF8F2',          // kem nóng — màu nền chính
  bgCard: '#FFFDF9',      // trắng ngà — card
  bgMuted: '#F5EDE3',     // kem đậm hơn — section muted
  bgSection: '#F0E8DF',   // nền section nhẹ

  // ── Primary: Dusty Blue (tin cậy, bình an) ──────────────────
  primary: '#6B9DC2',     // xanh lam cũ
  primaryLight: '#B8D4E8',// xanh lam nhạt
  primaryDark: '#4A7A9B', // xanh lam đậm
  primaryBg: '#EBF3FA',   // nền primary nhạt

  // ── Secondary: Sage Green (phát triển, hy vọng) ─────────────
  secondary: '#7DAA8B',   // xanh lá thảo mộc
  secondaryLight: '#C2DBC8',
  secondaryDark: '#5A8A6A',
  secondaryBg: '#EBF5EF',

  // ── Accent: Dusty Rose (ấm áp, yêu thương) ─────────────────
  accent: '#C4848A',      // hồng cũ
  accentLight: '#E8C4C6',
  accentDark: '#A06068',
  accentBg: '#FAF0F0',

  // ── Warm Lavender (domain: sensory) ─────────────────────────
  lavender: '#9D85C0',
  lavenderLight: '#D6CCE8',
  lavenderBg: '#F3F0FA',

  // ── Warm Teal (domain: cognitive) ───────────────────────────
  teal: '#6BAAA8',
  tealLight: '#C2DCDB',
  tealBg: '#EBF5F4',

  // ── Warm Orange (domain: behavior / warning) ─────────────────
  amber: '#C9936A',       // amber cũ
  amberLight: '#E8C9B4',
  amberBg: '#FAF2EB',

  // ── Text ─────────────────────────────────────────────────────
  textDark: '#3D3530',    // nâu ấm đậm — heading
  textMid: '#6B6260',     // nâu xám — body
  textLight: '#9E9895',   // xám nhạt — placeholder, caption
  textInverse: '#FFFFFF', // trắng — text trên nền đậm

  // ── Borders ──────────────────────────────────────────────────
  border: '#E8DDD6',      // viền nhạt ấm
  borderStrong: '#C8B8AC',// viền đậm hơn

  // ── Status ───────────────────────────────────────────────────
  success: '#7DAA8B',
  successBg: '#EBF5EF',
  warning: '#C9936A',
  warningBg: '#FAF2EB',
  danger: '#C47878',
  dangerBg: '#FAF0F0',
  info: '#6B9DC2',
  infoBg: '#EBF3FA',

  // ── White / Black ────────────────────────────────────────────
  white: '#FFFFFF',
  black: '#1A1614',

  // ── hpDT Domain Colors ───────────────────────────────────────
  domain: {
    communication: '#6B9DC2',  // dusty blue
    social:        '#7DAA8B',  // sage green
    behavior:      '#C9936A',  // amber
    sensory:       '#9D85C0',  // lavender
    motor:         '#C4848A',  // dusty rose
    cognitive:     '#6BAAA8',  // teal
  },
};

export const shadows = {
  sm: {
    shadowColor: '#3D3530',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#3D3530',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 6,
    elevation: 4,
  },
  lg: {
    shadowColor: '#3D3530',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
};

export const radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

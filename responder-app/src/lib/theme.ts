// ═══════════════════════════════════════════════════════════════
//  SnakeGuard Responder — Amber/Orange Dark Theme
//  Distinct from user app (green) to visually separate the apps.
// ═══════════════════════════════════════════════════════════════

export const colors = {
  background: '#0D0907',
  backgroundLight: '#14100C',
  card: '#1C1510',
  cardElevated: '#261E16',
  cardBorder: '#33271C',
  surface: '#15100B',
  surfaceLight: '#2A2018',

  primary: '#F59E0B',
  primaryLight: '#FBBF24',
  primaryDark: '#D97706',
  primaryMuted: 'rgba(245, 158, 11, 0.15)',
  primaryGlow: 'rgba(245, 158, 11, 0.08)',

  accent: '#10B981',
  accentMuted: 'rgba(16, 185, 129, 0.15)',

  danger: '#EF4444',
  dangerMuted: 'rgba(239, 68, 68, 0.12)',
  dangerLight: '#FCA5A5',

  warning: '#F97316',
  warningMuted: 'rgba(249, 115, 22, 0.12)',

  success: '#10B981',
  successMuted: 'rgba(16, 185, 129, 0.12)',

  info: '#3B82F6',
  infoMuted: 'rgba(59, 130, 246, 0.12)',

  textPrimary: '#FEF3E2',
  textSecondary: '#FCD9A8',
  textMuted: '#8F7A65',
  textDim: '#5E4D3E',

  border: '#2E231A',
  borderLight: '#3D3027',

  tabBar: '#0A0806',
  tabBarBorder: '#1F1812',

  inputBg: '#15100B',
  inputBorder: '#2E231A',

  overlay: 'rgba(0, 0, 0, 0.85)',
  skeleton: '#261E16',
  white: '#FFFFFF',

  risk: {
    critical: '#EF4444',
    high: '#F97316',
    medium: '#F59E0B',
    low: '#10B981',
  } as Record<string, string>,

  riskBg: {
    critical: 'rgba(239, 68, 68, 0.12)',
    high: 'rgba(249, 115, 22, 0.12)',
    medium: 'rgba(245, 158, 11, 0.12)',
    low: 'rgba(16, 185, 129, 0.12)',
  } as Record<string, string>,

  status: {
    assigned: '#3B82F6',
    in_progress: '#F59E0B',
    completed: '#10B981',
    cancelled: '#6B7280',
    pending: '#F97316',
    accepted: '#10B981',
    rejected: '#EF4444',
    expired: '#6B7280',
  } as Record<string, string>,

  statusBg: {
    assigned: 'rgba(59, 130, 246, 0.12)',
    in_progress: 'rgba(245, 158, 11, 0.12)',
    completed: 'rgba(16, 185, 129, 0.12)',
    cancelled: 'rgba(107, 114, 128, 0.12)',
    pending: 'rgba(249, 115, 22, 0.12)',
    accepted: 'rgba(16, 185, 129, 0.12)',
    rejected: 'rgba(239, 68, 68, 0.12)',
    expired: 'rgba(107, 114, 128, 0.12)',
  } as Record<string, string>,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  xxxxl: 40,
};

export const borderRadius = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 999,
};

export const fontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  display: 40,
};

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  glow: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  }),
};

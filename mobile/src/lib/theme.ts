export const colors = {
  background: '#060D09',
  backgroundLight: '#0A1410',
  card: '#0F1F17',
  cardElevated: '#142A1F',
  cardBorder: '#1A3328',
  surface: '#0D1A13',
  surfaceLight: '#183024',
  primary: '#10B981',
  primaryLight: '#34D399',
  primaryDark: '#059669',
  primaryMuted: 'rgba(16, 185, 129, 0.15)',
  primaryGlow: 'rgba(16, 185, 129, 0.08)',
  accent: '#F59E0B',
  accentMuted: 'rgba(245, 158, 11, 0.15)',
  danger: '#EF4444',
  dangerMuted: 'rgba(239, 68, 68, 0.12)',
  warning: '#F97316',
  info: '#3B82F6',
  infoMuted: 'rgba(59, 130, 246, 0.12)',
  textPrimary: '#ECFDF5',
  textSecondary: '#A7F3D0',
  textMuted: '#6B8F7B',
  textDim: '#3F5E4E',
  border: '#1E3A2B',
  borderLight: '#2A4D3C',
  tabBar: '#070E0A',
  tabBarBorder: '#12261B',
  inputBg: '#0D1A13',
  inputBorder: '#1E3A2B',
  overlay: 'rgba(0, 0, 0, 0.8)',
  skeleton: '#142A1F',
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

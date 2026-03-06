import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, borderRadius, spacing, fontSize, shadows } from '@/lib/theme';

interface StatCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string | number;
  color?: string;
  subtitle?: string;
}

export function StatCard({
  icon,
  label,
  value,
  color = colors.primary,
  subtitle,
}: StatCardProps) {
  return (
    <View style={[styles.card, shadows.sm]}>
      <View style={styles.cardTop}>
        <View style={[styles.iconWrap, { backgroundColor: color + '18' }]}>
          <Ionicons name={icon} size={18} color={color} />
        </View>
        <Text style={styles.label}>{label}</Text>
      </View>
      <Text style={[styles.value, { color }]}>{value}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.lg,
    minWidth: 100,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flex: 1,
  },
  value: {
    fontSize: fontSize.xxxl,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 2,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: fontSize.xs,
    color: colors.textDim,
    marginTop: 2,
  },
});

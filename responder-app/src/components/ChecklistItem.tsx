import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, borderRadius, spacing, fontSize } from '@/lib/theme';

interface ChecklistItemProps {
  title: string;
  description?: string;
  completed: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export function ChecklistItem({
  title,
  description,
  completed,
  onToggle,
  disabled,
}: ChecklistItemProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.item,
        completed && styles.itemCompleted,
        pressed && !disabled && styles.itemPressed,
      ]}
      onPress={onToggle}
      disabled={disabled}
    >
      <View
        style={[
          styles.checkbox,
          completed && styles.checkboxCompleted,
        ]}
      >
        {completed && (
          <Ionicons name="checkmark" size={14} color="#fff" />
        )}
      </View>

      <View style={styles.textWrap}>
        <Text
          style={[
            styles.title,
            completed && styles.titleCompleted,
          ]}
        >
          {title}
        </Text>
        {description ? (
          <Text style={styles.description} numberOfLines={2}>
            {description}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  itemCompleted: {
    backgroundColor: colors.successMuted,
    borderColor: colors.success + '30',
  },
  itemPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.99 }],
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: borderRadius.xs,
    borderWidth: 2,
    borderColor: colors.textDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxCompleted: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  titleCompleted: {
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  description: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    lineHeight: 18,
  },
});

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, radius, shadows, spacing } from '../../lib/colors';

export default function Card({ children, style, variant = 'default', padding = 'md' }) {
  return (
    <View style={[styles.card, styles[variant], styles[`pad_${padding}`], style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  default: {},
  elevated: {
    ...shadows.md,
  },
  muted: {
    backgroundColor: colors.bgMuted,
    borderColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  accent: {
    backgroundColor: colors.primaryBg,
    borderColor: colors.primaryLight,
  },

  pad_none: { padding: 0 },
  pad_sm:   { padding: spacing.sm },
  pad_md:   { padding: spacing.lg },
  pad_lg:   { padding: spacing.xl },
});

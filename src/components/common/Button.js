import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import { colors, radius, shadows } from '../../lib/colors';
import { typography } from '../../lib/typography';

export default function Button({
  label,
  onPress,
  variant = 'primary',   // primary | secondary | outline | ghost | danger
  size = 'md',           // sm | md | lg
  loading = false,
  disabled = false,
  icon = null,
  fullWidth = true,
  style,
}) {
  const btnStyle = [
    styles.base,
    styles[variant],
    styles[`size_${size}`],
    fullWidth && styles.fullWidth,
    (disabled || loading) && styles.disabled,
    style,
  ];

  const labelStyle = [
    styles.label,
    styles[`label_${variant}`],
    styles[`labelSize_${size}`],
  ];

  return (
    <TouchableOpacity
      style={btnStyle}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.82}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'outline' || variant === 'ghost' ? colors.primary : colors.white}
        />
      ) : (
        <View style={styles.row}>
          {icon && <Text style={styles.icon}>{icon}</Text>}
          <Text style={labelStyle}>{label}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  fullWidth: { width: '100%' },

  // Variants
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.secondary,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  ghost: {
    backgroundColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  danger: {
    backgroundColor: colors.danger,
  },

  // Sizes
  size_sm: { height: 38, paddingHorizontal: 14 },
  size_md: { height: 48, paddingHorizontal: 20 },
  size_lg: { height: 56, paddingHorizontal: 28 },

  disabled: { opacity: 0.5 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  icon: { fontSize: 18 },

  // Label styles
  label: { ...typography.btn },
  label_primary:   { color: colors.white },
  label_secondary: { color: colors.white },
  label_outline:   { color: colors.primary },
  label_ghost:     { color: colors.primary },
  label_danger:    { color: colors.white },

  labelSize_sm: { fontSize: 13 },
  labelSize_md: { fontSize: 15 },
  labelSize_lg: { fontSize: 17 },
});

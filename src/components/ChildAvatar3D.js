import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors, shadows } from '../lib/colors';
import { getChildDisplayAvatar } from '../lib/childAvatar';

export default function ChildAvatar3D({ child, uri, size = 68, style }) {
  const avatarUri = uri || getChildDisplayAvatar(child);

  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: size / 2 }, style]}>
      {avatarUri ? (
        <Image source={{ uri: avatarUri }} style={styles.image} />
      ) : (
        <Text style={{ fontSize: size * 0.48, lineHeight: size * 0.62 }}>👦</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.primaryBg,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...shadows.sm,
  },
  image: { width: '100%', height: '100%' },
});

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View, StyleSheet } from 'react-native';

import { useAuth } from '../contexts/AuthContext';
import { colors } from '../lib/colors';

import LoginScreen            from '../screens/auth/LoginScreen';
import ProfileCompletionScreen from '../screens/auth/ProfileCompletionScreen';
import ParentNavigator         from './ParentNavigator';
import TeacherNavigator        from './TeacherNavigator';

const Stack = createNativeStackNavigator();

function LoadingScreen() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

export default function RootNavigator() {
  const { session, profile, profileComplete, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!session ? (
          // Chưa đăng nhập
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : !profileComplete ? (
          // Đã đăng nhập nhưng chưa hoàn thiện hồ sơ — bắt buộc
          <Stack.Screen name="ProfileCompletion" component={ProfileCompletionScreen} />
        ) : profile?.role === 'teacher' || profile?.role === 'specialist' || profile?.role === 'admin' ? (
          // Giáo viên / Chuyên gia
          <Stack.Screen name="TeacherApp" component={TeacherNavigator} />
        ) : (
          // Phụ huynh (default)
          <Stack.Screen name="ParentApp" component={ParentNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg,
  },
});

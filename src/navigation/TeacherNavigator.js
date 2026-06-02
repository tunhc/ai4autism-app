import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../lib/colors';

// Teacher Screens
import TeacherDashboardScreen  from '../screens/teacher/TeacherDashboardScreen';
import StudentDetailScreen     from '../screens/teacher/StudentDetailScreen';
import LogSessionScreen        from '../screens/teacher/LogSessionScreen';
import TeacherTeachingScreen   from '../screens/teacher/TeacherTeachingScreen';
import TeacherLibraryScreen    from '../screens/teacher/TeacherLibraryScreen';
import TeacherReportScreen     from '../screens/teacher/TeacherReportScreen';
import TeacherProfileScreen    from '../screens/teacher/TeacherProfileScreen';

import TeacherMessagesScreen   from '../screens/teacher/TeacherMessagesScreen';
import TeacherExercisesScreen  from '../screens/teacher/TeacherExercisesScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function TabIcon({ emoji, label, focused }) {
  return (
    <View style={styles.tabIcon}>
      <Text style={[styles.emoji, { opacity: focused ? 1 : 0.5 }]}>{emoji}</Text>
      <Text style={[styles.tabLabel, { color: focused ? colors.secondary : colors.textLight }]}>
        {label}
      </Text>
    </View>
  );
}

function StudentStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="TeacherDashboard"  component={TeacherDashboardScreen} />
      <Stack.Screen name="StudentDetail"     component={StudentDetailScreen} />
      <Stack.Screen name="LogSession"        component={LogSessionScreen} />
      <Stack.Screen name="Messages"          component={TeacherMessagesScreen} />
      <Stack.Screen name="TeacherExercises"  component={TeacherExercisesScreen} />
    </Stack.Navigator>
  );
}

export default function TeacherNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bgCard,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 72,
          paddingBottom: 8,
          paddingTop: 4,
        },
        tabBarShowLabel: false,
      }}
    >
      <Tab.Screen
        name="TrangChu"
        component={StudentStack}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🏠" label="Trang chủ" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="DayHoc"
        component={TeacherTeachingScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🏫" label="Dạy học" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="ThuVien"
        component={TeacherLibraryScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🎬" label="Thư viện" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="BaoCao"
        component={TeacherReportScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="📊" label="Báo cáo" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="CaiDat"
        component={TeacherProfileScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="⚙️" label="Cài đặt" focused={focused} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 4,
  },
  emoji: {
    fontSize: 22,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
  },
});


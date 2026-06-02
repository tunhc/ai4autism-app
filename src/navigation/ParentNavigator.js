import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius, shadows, spacing } from '../lib/colors';

// Screens
import DashboardScreen   from '../screens/parent/DashboardScreen';
import SOSScreen         from '../screens/parent/SOSScreen';
import AIReportScreen    from '../screens/parent/AIReportScreen';
// Exercises, Journal, VideoModeling, VideoUpload — đã không dùng, đã xóa
import LibraryScreen     from '../screens/parent/LibraryScreen';
import ChatScreen        from '../screens/parent/ChatScreen';
import ProgressScreen    from '../screens/parent/ProgressScreen';
import SettingsScreen    from '../screens/parent/SettingsScreen';
import PersonalInfoScreen  from '../screens/parent/PersonalInfoScreen';
import ChildProfileScreen  from '../screens/parent/ChildProfileScreen';

const Tab   = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function TabIcon({ emoji, label, focused }) {
  return (
    <View style={st.tabIcon}>
      <Text style={[st.tabEmoji, { opacity: focused ? 1 : 0.5 }]}>{emoji}</Text>
      <Text style={[st.tabLabel, { color: focused ? colors.primary : colors.textLight }]}>
        {label}
      </Text>
    </View>
  );
}

// Center FAB for Chat tab
function ChatTabIcon({ focused }) {
  return (
    <View style={st.chatFabWrap}>
      <View style={[st.chatFab, focused && st.chatFabActive]}>
        <Text style={st.chatFabEmoji}>💬</Text>
      </View>
    </View>
  );
}

// Home stack (includes SOS, AI Report, etc.)
function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Dashboard"  component={DashboardScreen} />
      <Stack.Screen name="SOS"        component={SOSScreen} />
      <Stack.Screen name="AIReport"   component={AIReportScreen} />
    </Stack.Navigator>
  );
}

function SettingsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SettingsHome"  component={SettingsScreen} />
      <Stack.Screen name="PersonalInfo"  component={PersonalInfoScreen} />
      <Stack.Screen name="ChildProfile"  component={ChildProfileScreen} />
    </Stack.Navigator>
  );
}

export default function ParentNavigator() {
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
        component={HomeStack}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" label="Trang chủ" focused={focused} />,
        }}
      />

      <Tab.Screen
        name="ThuVien"
        component={LibraryScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="🎬" label="Thư viện" focused={focused} />,
        }}
      />

      {/* Center chat FAB */}
      <Tab.Screen
        name="ChatVST"
        component={ChatScreen}
        options={{
          tabBarIcon: ({ focused }) => <ChatTabIcon focused={focused} />,
          tabBarStyle: { display: 'none' },  // Hide tab bar on chat screen
        }}
      />

      <Tab.Screen
        name="TienTrinh"
        component={ProgressScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="📈" label="Tiến trình" focused={focused} />,
        }}
      />

      <Tab.Screen
        name="CaiDat"
        component={SettingsStack}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="⚙️" label="Cài đặt" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
}

const st = StyleSheet.create({
  tabIcon: { alignItems: 'center', justifyContent: 'center', paddingTop: 4 },
  tabEmoji: { fontSize: 22 },
  tabLabel: { fontSize: 10, fontWeight: '500', marginTop: 2 },

  // Chat FAB
  chatFabWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -16,
  },
  chatFab: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    ...shadows.md,
    borderWidth: 3, borderColor: colors.bgCard,
  },
  chatFabActive: { backgroundColor: colors.primaryDark },
  chatFabEmoji: { fontSize: 24 },
});

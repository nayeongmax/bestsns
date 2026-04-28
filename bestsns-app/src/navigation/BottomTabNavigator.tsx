import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Colors, Radius } from '../lib/theme';
import type { BottomTabParamList } from './types';

import HomeScreen from '../screens/home/HomeScreen';
import ChannelsScreen from '../screens/channels/ChannelsScreen';
import StoreScreen from '../screens/store/StoreScreen';
import PartTimeScreen from '../screens/parttime/PartTimeScreen';
import BoardScreen from '../screens/board/BoardScreen';
import MyPageScreen from '../screens/mypage/MyPageScreen';

const Tab = createBottomTabNavigator<BottomTabParamList>();

const TAB_ICONS: Record<string, { emoji: string; activeEmoji: string }> = {
  홈:  { emoji: '📈', activeEmoji: '📈' },
  채널: { emoji: '📺', activeEmoji: '📺' },
  스토어: { emoji: '🏪', activeEmoji: '🏪' },
  알바: { emoji: '💼', activeEmoji: '💼' },
  게시판: { emoji: '💬', activeEmoji: '💬' },
  마이: { emoji: '👤', activeEmoji: '👤' },
};

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons = TAB_ICONS[name] ?? { emoji: '📱', activeEmoji: '📱' };
  return (
    <View style={[styles.tabIcon, focused && styles.tabIconActive]}>
      <Text style={styles.tabEmoji}>{focused ? icons.activeEmoji : icons.emoji}</Text>
    </View>
  );
}

export default function BottomTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
      })}
    >
      <Tab.Screen name="홈" component={HomeScreen} />
      <Tab.Screen name="채널" component={ChannelsScreen} />
      <Tab.Screen name="스토어" component={StoreScreen} />
      <Tab.Screen name="알바" component={PartTimeScreen} />
      <Tab.Screen name="게시판" component={BoardScreen} />
      <Tab.Screen name="마이" component={MyPageScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#fff',
    borderTopWidth: 0,
    height: 70,
    paddingBottom: 8,
    paddingTop: 6,
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 20,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  tabIcon: {
    width: 36,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Radius.sm,
  },
  tabIconActive: {
    backgroundColor: '#EDE9FF',
  },
  tabEmoji: {
    fontSize: 20,
  },
});

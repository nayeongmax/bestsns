import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../hooks/useAuth';
import { Colors } from '../lib/theme';
import type { RootStackParamList } from './types';

import BottomTabNavigator from './BottomTabNavigator';
import AuthScreen from '../screens/auth/AuthScreen';
import BoardDetailScreen from '../screens/board/BoardDetailScreen';
import BoardWriteScreen from '../screens/board/BoardWriteScreen';
import NoticesScreen from '../screens/notices/NoticesScreen';
import NotificationsScreen from '../screens/notifications/NotificationsScreen';

// Lazy screens (simple placeholders for less critical screens)
import ChannelDetailPlaceholder from '../screens/channels/ChannelDetailScreen';
import EbookDetailPlaceholder from '../screens/store/EbookDetailScreen';
import PartTimeDetailPlaceholder from '../screens/parttime/PartTimeDetailScreen';
import ChatPlaceholder from '../screens/chat/ChatScreen';
import PointPaymentPlaceholder from '../screens/mypage/PointPaymentScreen';
import CouponBoxPlaceholder from '../screens/mypage/CouponBoxScreen';
import AIConsultPlaceholder from '../screens/mypage/AIConsultScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { loading } = useAuth();

  if (loading) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.primary }}>
      <ActivityIndicator size="large" color="#fff" />
    </View>
  );

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="MainTabs" component={BottomTabNavigator} />
        <Stack.Screen name="Auth" component={AuthScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="BoardDetail" component={BoardDetailScreen} />
        <Stack.Screen name="BoardWrite" component={BoardWriteScreen} />
        <Stack.Screen name="ChannelDetail" component={ChannelDetailPlaceholder} />
        <Stack.Screen name="EbookDetail" component={EbookDetailPlaceholder} />
        <Stack.Screen name="PartTimeDetail" component={PartTimeDetailPlaceholder} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        <Stack.Screen name="Notices" component={NoticesScreen} />
        <Stack.Screen name="Chat" component={ChatPlaceholder} />
        <Stack.Screen name="PointPayment" component={PointPaymentPlaceholder} />
        <Stack.Screen name="CouponBox" component={CouponBoxPlaceholder} />
        <Stack.Screen name="AIConsult" component={AIConsultPlaceholder} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

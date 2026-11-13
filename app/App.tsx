/**
 * Main Application Entry Point
 * Handles navigation and app initialization
 */

import React, { useEffect, useState } from 'react';
import { StatusBar, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts } from 'expo-font';
import { Icon, IconName } from './components/Icons';
import {
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NOMA_COLORS, Wordmark } from './components/UIComponents';

// Screens
import { HomeScreen } from './screens/HomeScreen';
import { LiveTrackingScreen } from './screens/LiveTrackingScreen';
import { ActivitySummaryScreen } from './screens/ActivitySummaryScreen';
import { ActivityDetailsScreen } from './screens/ActivityDetailsScreen';
import { RecordsScreen } from './screens/RecordsScreen';
import { SegmentsScreen, SegmentDetailScreen } from './screens/SegmentsScreen';
import { ActivitiesHubScreen } from './screens/ActivitiesHubScreen';
import { ExplorerScreen } from './screens/ExplorerScreen';
import { PlanScreen } from './screens/PlanScreen';
import { PlanEditScreen } from './screens/PlanEditScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { AuthScreen } from './screens/AuthScreen';

const ONBOARDING_KEY = 'NOMA_ONBOARDING_DONE_V1';

// Context
import { TrackingProvider } from './context/TrackingContext';
import { AnalyticsProvider } from './context/AnalyticsContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SyncProvider } from './context/SyncContext';
import { SummariesProvider } from './context/SummariesContext';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const SummaryScreen = ActivitySummaryScreen as React.ComponentType<any>;
const DetailsScreen = ActivityDetailsScreen as React.ComponentType<any>;
const SegmentDetail = SegmentDetailScreen as React.ComponentType<any>;

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: NOMA_COLORS.background,
    card: NOMA_COLORS.background,
    text: NOMA_COLORS.text,
    border: NOMA_COLORS.greige,
    primary: NOMA_COLORS.charcoal,
  },
};

const stackScreenOptions = {
  headerShown: false,
  contentStyle: { backgroundColor: NOMA_COLORS.background },
};

const headerOptions = (title: string) => ({
  title,
  headerShown: true,
  headerShadowVisible: false,
  headerStyle: { backgroundColor: NOMA_COLORS.background },
  headerTintColor: NOMA_COLORS.charcoal,
  headerTitleStyle: { color: NOMA_COLORS.text, fontWeight: '700' as const },
});

const detailsScreen = (
  <Stack.Screen name="ActivityDetails" component={DetailsScreen} options={headerOptions('Activité')} />
);

const HomeStackNavigator = () => (
  <Stack.Navigator screenOptions={stackScreenOptions}>
    <Stack.Screen name="HomeMain" component={HomeScreen} />
    {detailsScreen}
  </Stack.Navigator>
);

const LiveStackNavigator = () => (
  <Stack.Navigator screenOptions={stackScreenOptions}>
    <Stack.Screen name="LiveTracking" component={LiveTrackingScreen} options={{ title: 'Enregistrement' }} />
    <Stack.Screen name="Summary" component={SummaryScreen} options={headerOptions('Résumé de la sortie')} />
    {detailsScreen}
  </Stack.Navigator>
);

const ActivitiesStackNavigator = () => (
  <Stack.Navigator screenOptions={stackScreenOptions}>
    <Stack.Screen name="ActivitiesHub" component={ActivitiesHubScreen} />
    {detailsScreen}
    <Stack.Screen name="Summary" component={SummaryScreen} options={headerOptions('Résumé de la sortie')} />
    <Stack.Screen name="Records" component={RecordsScreen} />
    <Stack.Screen name="Segments" component={SegmentsScreen} options={headerOptions('Segments')} />
    <Stack.Screen name="SegmentDetail" component={SegmentDetail} options={headerOptions('Segment')} />
  </Stack.Navigator>
);

const PlanStackNavigator = () => (
  <Stack.Navigator screenOptions={stackScreenOptions}>
    <Stack.Screen name="PlanList" component={PlanScreen} />
    <Stack.Screen name="PlanEdit" component={PlanEditScreen as React.ComponentType<any>} options={headerOptions('Sortie')} />
  </Stack.Navigator>
);

const TAB_ICONS: Record<string, IconName> = {
  Home: 'home',
  Explorer: 'compass',
  Activities: 'activity',
  Plan: 'calendar',
  Profile: 'user',
};

const TabNavigator = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      headerShown: false,
      tabBarActiveTintColor: NOMA_COLORS.charcoal,
      tabBarInactiveTintColor: NOMA_COLORS.textSecondary,
      tabBarIcon: ({ focused, color }) => (
        <Icon name={TAB_ICONS[route.name] ?? 'home'} size={22} color={focused ? NOMA_COLORS.coral : color} />
      ),
      tabBarStyle: {
        backgroundColor: NOMA_COLORS.surface,
        borderTopColor: NOMA_COLORS.greige,
        borderTopWidth: 1,
        paddingBottom: 8,
        paddingTop: 8,
      },
      tabBarLabelStyle: { fontSize: 11, fontFamily: 'Inter_600SemiBold', marginTop: 2 },
    })}
  >
    <Tab.Screen name="Home" component={HomeStackNavigator} options={{ tabBarLabel: 'Accueil' }} />
    <Tab.Screen name="Explorer" component={ExplorerScreen} />
    <Tab.Screen name="Activities" component={ActivitiesStackNavigator} options={{ tabBarLabel: 'Activités' }} />
    <Tab.Screen name="Plan" component={PlanStackNavigator} />
    <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarLabel: 'Profil' }} />
  </Tab.Navigator>
);

/** Shows the sign-in gate until an account session exists. */
const AuthGate: React.FC = () => {
  const { status } = useAuth();
  if (status === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: NOMA_COLORS.background, alignItems: 'center', justifyContent: 'center' }}>
        <Wordmark />
      </View>
    );
  }
  if (status === 'signedOut') return <AuthScreen />;
  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={stackScreenOptions}>
        <Stack.Screen name="Main" component={TabNavigator} />
        <Stack.Screen name="Record" component={LiveStackNavigator} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

/**
 * App Component with Providers
 */
export default function App() {
  // If a font fails to load we still render (system font fallback).
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY)
      .then((v) => setOnboarded(v === '1'))
      .catch(() => setOnboarded(true));
  }, []);

  if ((!fontsLoaded && !fontError) || onboarded === null) {
    return (
      <View style={{ flex: 1, backgroundColor: NOMA_COLORS.background, alignItems: 'center', justifyContent: 'center' }}>
        {fontsLoaded ? <Wordmark /> : null}
      </View>
    );
  }

  if (!onboarded) {
    return (
      <>
        <StatusBar barStyle="dark-content" />
        <OnboardingScreen
          onDone={() => {
            AsyncStorage.setItem(ONBOARDING_KEY, '1').catch(() => undefined);
            setOnboarded(true);
          }}
        />
      </>
    );
  }

  return (
    <TrackingProvider>
      <AnalyticsProvider>
        <AuthProvider>
          <SummariesProvider>
            <SyncProvider>
              <StatusBar barStyle="dark-content" />
              <AuthGate />
            </SyncProvider>
          </SummariesProvider>
        </AuthProvider>
      </AnalyticsProvider>
    </TrackingProvider>
  );
}

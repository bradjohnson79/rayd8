import { Stack } from 'expo-router';
import 'react-native-reanimated';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded] = useFonts({
    'EBGaramond-Regular': require('../assets/fonts/EBGaramond-Regular.ttf'),
    'EBGaramond-Bold': require('../assets/fonts/EBGaramond-Bold.ttf'),
  });

  useEffect(() => {
    if (loaded) {
      setTimeout(() => {
        SplashScreen.hideAsync();
      }, 1000);
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
      <Stack>
        <Stack.Screen name="(tabs)/index" options={{ headerShown: false }} />
      </Stack>
  );
}

import OnboardingFlow from "@/app/onboarding"; // Your onboarding flow
import Colors from "@/constants/Colors";
import { GlobalStateProvider } from "@/contexts/GlobalStateProvider";
import { OnboardingProvider } from "@/contexts/OnboardingContext";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useOnboarding } from "@/hooks/useOnboarding";

import AppWrapper from "@/components/AppWrapper";
import { ShoeIcon } from "@/components/ShoeIcon";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  Text,
  View,
} from "react-native";

SplashScreen.preventAutoHideAsync();

const { width, height } = Dimensions.get("window");

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { isOnboardingComplete, isLoading } = useOnboarding();
  const [showSplash, setShowSplash] = useState(true);

  const [fontsLoaded] = useFonts({
    LexendBold: require("../assets/fonts/Lexend/Lexend-Bold.ttf"),
    LexendRegular: require("../assets/fonts/Lexend/Lexend-Regular.ttf"),
    LexendMedium: require("../assets/fonts/Lexend/Lexend-Medium.ttf"),
    LexendLight: require("../assets/fonts/Lexend/Lexend-Light.ttf"),
    LexendThin: require("../assets/fonts/Lexend/Lexend-Thin.ttf"),
  });

  const shoeIconOpacity = useRef(new Animated.Value(0)).current;
  const shoeIconScale = useRef(new Animated.Value(0.3)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(50)).current;
  const suistepScale = useRef(new Animated.Value(1)).current;
  const backgroundOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (fontsLoaded && !isLoading) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, isLoading]);

  useEffect(() => {
    if (isOnboardingComplete && !isLoading) {
      setShowSplash(true);
      const timer = setTimeout(() => setShowSplash(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [isOnboardingComplete, isLoading]);

  useEffect(() => {
    if (showSplash && isOnboardingComplete) {
      startWelcomeAnimations();
    }
  }, [showSplash, isOnboardingComplete]);

  const startWelcomeAnimations = () => {
    const sequence = Animated.sequence([
      Animated.parallel([
        Animated.timing(shoeIconOpacity, {
          toValue: 1,
          duration: 800,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(shoeIconScale, {
          toValue: 1,
          duration: 800,
          easing: Easing.elastic(1.2),
          useNativeDriver: true,
        }),
        Animated.timing(backgroundOpacity, {
          toValue: 1,
          duration: 1000,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(textTranslateY, {
          toValue: 0,
          duration: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]);

    sequence.start();

    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(suistepScale, {
          toValue: 1.1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(suistepScale, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    pulseAnimation.start();
  };

  if (!fontsLoaded || isLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: Colors.primary,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator size="large" color={Colors.thickOrange} />
      </View>
    );
  }

  if (!isOnboardingComplete) {
    return (
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <GlobalStateProvider>
          <AppWrapper>
            <OnboardingFlow />
          </AppWrapper>
        </GlobalStateProvider>
      </ThemeProvider>
    );
  }

  if (showSplash) {
    return (
      <Animated.View
        style={{
          flex: 1,
          backgroundColor: Colors.primary,
          opacity: backgroundOpacity,
        }}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: 20,
          }}
        >
          <Animated.View
            style={{
              opacity: shoeIconOpacity,
              transform: [{ scale: shoeIconScale }],
            }}
          >
            <ShoeIcon size={150} />
          </Animated.View>

          <Animated.View
            style={{
              opacity: textOpacity,
              transform: [{ translateY: textTranslateY }],
              marginTop: 30,
            }}
          >
            <Text
              style={{
                fontSize: 28,
                fontWeight: "bold",
                color: Colors.white,
                textAlign: "center",
                fontFamily: "LexendBold",
              }}
            >
              Welcome to{" "}
              <Animated.Text
                style={{
                  color: Colors.thickOrange,
                  transform: [{ scale: suistepScale }],
                }}
              >
                SuiStep
              </Animated.Text>
            </Text>

            <Animated.View
              style={{
                opacity: textOpacity,
                transform: [{ translateY: textTranslateY }],
                marginTop: 10,
              }}
            >
              <Text
                style={{
                  fontSize: 16,
                  color: Colors.white,
                  textAlign: "center",
                  fontFamily: "LexendLight",
                  opacity: 0.8,
                }}
              >
                Your secure crypto companion
              </Text>
            </Animated.View>
          </Animated.View>
        </View>
      </Animated.View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <GlobalStateProvider>
        <AppWrapper>
          <OnboardingProvider>
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="+not-found" />
              <Stack.Screen
                name="authentication"
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="transactionconfirmation"
                options={{ headerShown: false }}
              />
            </Stack>
            <StatusBar style="light" />
          </OnboardingProvider>
        </AppWrapper>
      </GlobalStateProvider>
    </ThemeProvider>
  );
}

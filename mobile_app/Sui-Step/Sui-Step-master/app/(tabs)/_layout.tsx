import Colors from "@/constants/Colors";
import { GlobalStateProvider } from "@/contexts/GlobalStateProvider";
import { OnboardingProvider } from "@/contexts/OnboardingContext";
import { useColorScheme } from "@/hooks/useColorScheme";
import Feather from "@expo/vector-icons/Feather";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import Octicons from "@expo/vector-icons/Octicons";
import { Tabs } from "expo-router";
import React from "react";
import { Platform } from "react-native";

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <GlobalStateProvider>
      <OnboardingProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarActiveTintColor: Colors.thickOrange,
          tabBarInactiveTintColor: Colors.gray,
          tabBarStyle: {
            position: "absolute",
            left: 20,
            right: 20,
            bottom: Platform.OS === "ios" ? 30 : 20,
            // height: 70,
            borderRadius: 35,
            backgroundColor: Colors.lightGray,
            borderTopWidth: 0,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 12,
            elevation: 10,
            paddingBottom: Platform.OS === "ios" ? 20 : 10,
            paddingTop: 10,
            marginHorizontal: 20,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: ({ focused }) => (
              <Feather
                name="home"
                size={24}
                color={focused ? Colors.thickOrange : Colors.gray}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="send"
          options={{
            title: "Send",
            tabBarIcon: ({ focused }) => (
              <FontAwesome
                name="send-o"
                size={24}
                color={focused ? Colors.thickOrange : Colors.gray}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="receive"
          options={{
            title: "Receive",
            tabBarIcon: ({ focused }) => (
              <MaterialIcons
                name="qr-code-scanner"
                size={24}
                color={focused ? Colors.thickOrange : Colors.gray}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            title: "History",
            tabBarIcon: ({ focused }) => (
              <Octicons
                name="history"
                size={24}
                color={focused ? Colors.thickOrange : Colors.gray}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "Settings",
            tabBarIcon: ({ focused }) => (
              <Feather
                name="settings"
                size={24}
                color={focused ? Colors.thickOrange : Colors.gray}
              />
            ),
          }}
        />
      </Tabs>
      </OnboardingProvider>
    </GlobalStateProvider>
  );
}

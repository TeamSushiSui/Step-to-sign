import Colors from "@/constants/Colors";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useOnboardingContext } from "../contexts/OnboardingContext";
import { PageIndicator } from "./PageIndicator";
import { ShoeIcon } from "./ShoeIcon";

export const OnboardingPage1 = () => {
  let currentPage = 0;
  try {
    const context = useOnboardingContext();
    currentPage = context.currentPage;
  } catch (error) {
    console.log(
      "OnboardingContext not available, using fallback currentPage = 0"
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <ShoeIcon size={150} />
        <Text style={styles.title}>
          Welcome to <Text style={{ color: Colors.thickOrange }}>SuiStep</Text>
        </Text>
      </View>
      <View style={styles.indicatorContainer}>
        <PageIndicator totalPages={3} currentPage={currentPage} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
    justifyContent: "space-between",
    paddingVertical: 60,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: Colors.secondary,
    marginTop: 30,
    textAlign: "center",
    fontFamily: "LexendBold",
  },
  indicatorContainer: {
    paddingBottom: 40,
  },
});

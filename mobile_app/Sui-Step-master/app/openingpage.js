import Colors from "@/constants/Colors";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { ShoeIcon } from "../components/ShoeIcon";

export const OnboardingPage1 = () => {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <ShoeIcon size={150} />
        <Text style={styles.title}>Welcome to Sui Step</Text>
      </View>
    </View>
  );
};

export default OnboardingPage1;

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

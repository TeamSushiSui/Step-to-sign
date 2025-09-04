import React from "react";
import { Image, StyleSheet, View } from "react-native";

export const ShoeIcon = ({ size = 120, color = "#F4A261" }) => {
  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Image
        source={require("../assets/images/OnboardingPageShoeMain.png")}
        style={[styles.shoeImage, { width: size, height: size }]}
        resizeMode="contain"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  shoeImage: {
    width: "100%",
    height: "100%",
  },
});

import Colors from "@/constants/Colors";
import React from "react";
import { StyleSheet, View } from "react-native";

export const PageIndicator = ({
  totalPages,
  currentPage,
  activeColor = Colors.thickOrange,
  inactiveColor = Colors.secondary,
}) => {
  return (
    <View style={styles.container}>
      {Array.from({ length: totalPages }, (_, index) => (
        <View
          key={index}
          style={[
            styles.dot,
            {
              backgroundColor:
                index === currentPage ? activeColor : inactiveColor,
              width: 30,
              height: index === currentPage ? 8 : 6,
            },
          ]}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    borderRadius: 6,
    borderWidth: 1,
  },
});

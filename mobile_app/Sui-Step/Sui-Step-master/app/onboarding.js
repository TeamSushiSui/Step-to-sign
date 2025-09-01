import Colors from "@/constants/Colors";
import React from "react";
import { StyleSheet, View } from "react-native";
import Swiper from "react-native-swiper";
import { OnboardingNavigation } from "../components/OnboardingNavigation";
import { OnboardingPage1 } from "../components/OnboardingPage1";
import { OnboardingPage2 } from "../components/OnboardingPage2";
import { OnboardingPage4 } from "../components/OnboardingPage4";
import {
  OnboardingProvider,
  useOnboardingContext,
} from "../contexts/OnboardingContext";

function OnboardingContent() {
  const { currentPage, setCurrentPage } = useOnboardingContext();
  return (
    <View style={styles.container}>
      <Swiper
        style={styles.wrapper}
        showsButtons={false}
        showsPagination={false}
        loop={false}
        onIndexChanged={setCurrentPage}
        autoplay={false}
        index={currentPage}
      >
        <OnboardingPage1 />
        <OnboardingPage2 />
        <OnboardingPage4 />
      </Swiper>
      <OnboardingNavigation />
    </View>
  );
}

export default function OnboardingScreen() {
  return (
    <OnboardingProvider>
      <OnboardingContent />
    </OnboardingProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  wrapper: {
    backgroundColor: Colors.primary,
  },
});

import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { createContext, useContext, useState } from "react";
import { useOnboarding } from "../hooks/useOnboarding";

const OnboardingContext = createContext();

export const useOnboardingContext = () => {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error(
      "useOnboardingContext must be used within an OnboardingProvider"
    );
  }
  return context;
};

export const OnboardingProvider = ({ children }) => {
  const onboardingPageButtonsDetails = [
    { page: 0, button1: "Previous", button2: "Next" },
    { page: 1, button1: "Previous", button2: "Next" },
    { page: 2, button1: "Previous", button2: "Get Started" },
  ];
  const router = useRouter();
  const { completeOnboarding: completeOnboardingHook } = useOnboarding();
  const [currentPage, setCurrentPage] = useState(0);

  const completeOnboarding = async () => {
    await completeOnboardingHook();
    router.replace("/(tabs)");
    await SecureStore.setItemAsync("onboardingCompleted", "true");
  };

  const goToPrevious = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const goToNext = () => {
    if (currentPage < 2) {
      setCurrentPage(currentPage + 1);
    }
  };

  const activateWallet = () => {
    // No demo flow here; handled by device pages
  };

  return (
    <OnboardingContext.Provider
      value={{
        completeOnboarding,
        currentPage,
        setCurrentPage,
        onboardingPageButtonsDetails,
        goToPrevious,
        goToNext,
        activateWallet,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
};

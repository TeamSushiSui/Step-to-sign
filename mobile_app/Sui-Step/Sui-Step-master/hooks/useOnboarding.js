import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";

const ONBOARDING_KEY = "suistep_onboarding_completed";
const LAST_OPEN_KEY = "suistep_last_open";

export const useOnboarding = () => {
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  const checkOnboardingStatus = async () => {

    try {
      const onboardingCompleted = await SecureStore.getItemAsync(
        ONBOARDING_KEY
      );
      const lastOpen = await SecureStore.getItemAsync(LAST_OPEN_KEY);

      if (!onboardingCompleted) {
        // First time user
        setIsOnboardingComplete(false);
      } else {
        // Checks if 30+ days have passed since last open
        const now = new Date().getTime();
        const lastOpenTime = lastOpen ? parseInt(lastOpen) : 0;
        const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;

        if (now - lastOpenTime > thirtyDaysInMs) {
          setIsOnboardingComplete(false);
        } else {
          setIsOnboardingComplete(true);
        }
      }
    } catch (error) {
      console.error("Error checking onboarding status:", error);
      setIsOnboardingComplete(false);
    } finally {
      setIsLoading(false);
    }
  };

  const completeOnboarding = async () => {
    try {
      await SecureStore.setItemAsync(ONBOARDING_KEY, "true");
      await SecureStore.setItemAsync(
        LAST_OPEN_KEY,
        new Date().getTime().toString()
      );
      setIsOnboardingComplete(true);
    } catch (error) {
      console.error("Error completing onboarding:", error);
    }
  };

  const updateLastOpen = async () => {
    try {
      await SecureStore.setItemAsync(
        LAST_OPEN_KEY,
        new Date().getTime().toString()
      );
    } catch (error) {
      console.error("Error updating last open time:", error);
    }
  };

  return {
    isOnboardingComplete,
    isLoading,
    completeOnboarding,
    updateLastOpen,
  };
};

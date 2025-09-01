import Colors from "@/constants/Colors";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useGlobalState } from "../contexts/GlobalStateProvider";
import { useOnboardingContext } from "../contexts/OnboardingContext";
import CustomAlert from "./CustomAlert";

export const OnboardingNavigation = () => {
  const {
    currentPage,
    onboardingPageButtonsDetails,
    goToPrevious,
    goToNext,
    completeOnboarding,
  } = useOnboardingContext();

  const {
    deviceConnected,
    walletCreated,
    walletActivated,
    deviceSetupCompleted,
    walletSetupCompleted,
    activationSetupCompleted,
    setWalletAddress,
    setWalletActivated,
    setActivationSetupCompleted,
    setWalletSetupCompleted,
    setIsScanning,
    setDevices,
    setShowDeviceModal,
    scanForBleDevices,
    showLetterGrid,
    setShowLetterGrid,
    setOnboardingCompleted,
  } = useGlobalState();
  const startScan = async () => {
    setIsScanning(true);
    setDevices([]);
    setShowDeviceModal(true);
    try {
      await scanForBleDevices();
    } catch (_) {}
    setIsScanning(false);
  };

  const buttonCode = {
    Previous: goToPrevious,
    Next: goToNext,
    "Connect Device": startScan,
    "Activate Wallet": () => {
      if (!walletActivated) {
        setShowLetterGrid(!showLetterGrid);
      }
    },
    "Get Started": () => {
      completeOnboarding();
    },
  };

  if (walletActivated && activationSetupCompleted && walletSetupCompleted) {
    return (
      <CustomAlert
        visible={true}
        title="Onboarding Completed"
        message="You have completed the onboarding process. You can now start using the app."
        buttons={[
          {
            text: "OK",
            onPress: () => {
              setWalletSetupCompleted(false);
            },
          },
        ]}
      />
    );
  }
  const { button1, button2 } = onboardingPageButtonsDetails[currentPage];

  const isNextEnabled = () => {
    switch (currentPage) {
      case 0:
        return true;
      case 1:
        return deviceConnected && deviceSetupCompleted;
      case 2:
        return walletActivated && activationSetupCompleted;
      default:
        return true;
    }
  };

  const nextEnabled = isNextEnabled();

  const isButton1Disabled = () => {
    if (currentPage === 0) return true;
    if (button1 === "Activate Wallet" && walletActivated) return true;
    return false;
  };

  const button1Disabled = isButton1Disabled();

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.button, button1Disabled && styles.buttonDisabled]}
        onPress={buttonCode[button1]}
        disabled={button1Disabled}
      >
        <Text
          style={[
            styles.buttonText,
            button1Disabled && styles.buttonTextDisabled,
          ]}
        >
          {button1}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, !nextEnabled && styles.buttonDisabled]}
        onPress={buttonCode[button2]}
        disabled={!nextEnabled}
      >
        <Text
          style={[styles.buttonText, !nextEnabled && styles.buttonTextDisabled]}
        >
          {button2}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 16,
  },
  button: {
    flex: 1,
    backgroundColor: Colors.thickOrange,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonDisabled: {
    backgroundColor: Colors.gray,
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.white,
  },
  buttonTextDisabled: {
    color: Colors.lightGray,
  },
});

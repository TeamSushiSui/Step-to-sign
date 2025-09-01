import OnboardingPageActivateWalletImg from "@/assets/images/OnboardingPageActivateWalletImgMain.png";
import Colors from "@/constants/Colors";
import { useEffect, useState } from "react";
import {
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useGlobalState } from "../contexts/GlobalStateProvider";
import { useOnboardingContext } from "../contexts/OnboardingContext";
import BleService from "../services/BleService";
import CustomAlert from "./CustomAlert";
import { PageIndicator } from "./PageIndicator";

// Morse code alphabet
const MORSE_ALPHABET = {
  A: ".-",
  B: "-...",
  C: "-.-.",
  D: "-..",
  E: ".",
  F: "..-.",
  G: "--.",
  H: "....",
  I: "..",
  J: ".---",
  K: "-.-",
  L: ".-..",
  M: "--",
  N: "-.",
  O: "---",
  P: ".--.",
  Q: "--.-",
  R: ".-.",
  S: "...",
  T: "-",
  U: "..-",
  V: "...-",
  W: ".--",
  X: "-..-",
  Y: "-.--",
  Z: "--..",
};

// Simulation enabled by default. Set to false to restore real verification.
const SIMULATE_MORSE = true;

export const OnboardingPage4 = () => {
  // Context setup
  let currentPage = 2;
  try {
    const context = useOnboardingContext();
    currentPage = context.currentPage;
  } catch (_error) {
    console.log(
      "OnboardingContext not available, using fallback currentPage = 2"
    );
  }

  // Global state
  const {
    selectedLetters,
    setSelectedLetters,
    morseStep,
    setMorseStep,
    morseInput,
    setMorseInput,
    morseVerifyInput,
    setMorseVerifyInput,
    morseError,
    setMorseError,
    showMorseModal,
    setShowMorseModal,
    showLetterSelectionAlert,
    setShowLetterSelectionAlert,
    showGestureMismatchAlert,
    setShowGestureMismatchAlert,
    showMorseSuccessAlert,
    setShowMorseSuccessAlert,
    setWalletActivated,
    setActivationSetupCompleted,
    showLetterGrid,
    setShowLetterGrid,
    walletActivated,
    deviceConnected,
    selectedDevice,
    walletCreated,
    setWalletCreated,
    isRealBleConnected,
    isAuthenticated,
    gestureSaved,
    setGestureSaved,
    // setSavedMorseCode,
    showWalletCreationFlow,
    setShowWalletCreationFlow,
  } = useGlobalState();

  // --- Handle onscreen Morse input with real device (commented out) ---
  /*
  const handleOnscreenMorseInputWithDevice = async (symbol) => {
    try {
      if (!deviceConnected && !isRealBleConnected) {
        console.log("   Onboarding: No device connected for onscreen input");
        return;
      }

      // Send Morse input to device
      await BleService.sendMorseInput(symbol);
      console.log(`🔐 Onboarding: Sent Morse symbol to device: ${symbol}`);

      // Update local state
      if (morseStep === "entry") {
        setMorseInput((prev) => prev + symbol);
      } else if (morseStep === "verify") {
        setMorseVerifyInput((prev) => prev + symbol);
      }
    } catch (error) {
      console.error("   Onboarding: Error sending Morse input to device:", error);
      setMorseError("Failed to send Morse input to device. Please try again.");
    }
  };
  */

  // Local state for wallet creation flow
  const [isCreatingWallet, setIsCreatingWallet] = useState(false);
  const [walletCreationStep, setWalletCreationStep] = useState("check"); // check, create, gesture
  const [showWalletCreatedAlert, setShowWalletCreatedAlert] = useState(false);
  const [newWalletAddress, setNewWalletAddress] = useState("");
  const [isSimulatingVerify, setIsSimulatingVerify] = useState(false);

  // Check wallet status on component mount
  useEffect(() => {
    if (deviceConnected && isRealBleConnected && isAuthenticated) {
      checkDeviceWalletStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceConnected, isRealBleConnected, isAuthenticated]);

  // Debug: track key UI state changes
  useEffect(() => {
    console.log("🧪 State change: showMorseModal=", showMorseModal);
  }, [showMorseModal]);

  useEffect(() => {
    console.log(
      "🧪 State change: showMorseSuccessAlert=",
      showMorseSuccessAlert
    );
  }, [showMorseSuccessAlert]);

  useEffect(() => {
    console.log("🧪 State change: morseStep=", morseStep);
  }, [morseStep]);

  // Listen for Morse code input from the device
  useEffect(() => {
    const onMorseInput = (input) => {
      console.log("    OnboardingPage4: Morse input received:", input);
      if (showMorseModal) {
        if (morseStep === "entry") {
          setMorseInput((prev) => prev + input);
        } else if (morseStep === "verify") {
          setMorseVerifyInput((prev) => prev + input);
        }
      }
    };
    BleService.callbacks.onMorseInput = onMorseInput;

    return () => {
      BleService.callbacks.onMorseInput = null;
    };
  }, [
    showMorseModal,
    morseStep,
    setMorseInput,
    setMorseVerifyInput,
    BleService,
  ]);

  const checkDeviceWalletStatus = async () => {
    try {
      console.log("    OnboardingPage4: Checking Arduino wallet status...");

      if (!isAuthenticated || !isRealBleConnected) {
        console.log(
          "   OnboardingPage4: Not authenticated or connected, skipping wallet status check"
        );
        return;
      }

      if (selectedDevice?.needsWalletCreation) {
        console.log("    OnboardingPage4: Arduino needs wallet creation");
        setWalletCreationStep("create");
        setShowWalletCreationFlow(true);
        setShowLetterGrid(false);
      } else if (selectedDevice?.walletAddress) {
        console.log(
          "    OnboardingPage4: Arduino has wallets, proceeding to gesture setup"
        );
        setWalletCreated(true);
        setShowLetterGrid(true);
        setShowWalletCreationFlow(false);
      } else {
        await requestArduinoWalletStatus();
      }
    } catch (error) {
      console.error(
        "   OnboardingPage4: Failed to check Arduino wallet status:",
        error
      );
      Alert.alert(
        "Error",
        "Failed to check Arduino wallet status. Please try again."
      );
    }
  };

  const requestArduinoWalletStatus = async () => {
    try {
      console.log("    OnboardingPage4: Requesting Arduino wallet status...");
      if (!isAuthenticated) {
        Alert.alert(
          "Authentication Required",
          "Please authenticate with your device PIN first."
        );
        return;
      }

      const status = await BleService.getDeviceStatus();

      if (status.wallet_count === 0) {
        setWalletCreationStep("create");
        setShowWalletCreationFlow(true);
        setShowLetterGrid(false);
      } else {
        setWalletCreated(true);
        setShowLetterGrid(true);
        setShowWalletCreationFlow(false);
      }
    } catch (error) {
      console.error(
        "   OnboardingPage4: Failed to get Arduino wallet status:",
        error
      );
      setWalletCreationStep("create");
      setShowWalletCreationFlow(true);
      setShowLetterGrid(false);
    }
  };

  const createNewWallet = async () => {
    setIsCreatingWallet(true);
    try {
      console.log("    OnboardingPage4: Creating new wallet on Arduino...");
      if (!isAuthenticated) {
        throw new Error(
          "Not authenticated. Please authenticate with PIN first."
        );
      }

      const newWallet = await BleService.createWallet();

      console.log("  OnboardingPage4: Arduino wallet created:", newWallet);

      // Use the address provided by Arduino, fallback to public key if needed
      const displayAddress =
        newWallet.address ||
        (newWallet.publicKey
          ? `0x${newWallet.publicKey.slice(0, 8)}...${newWallet.publicKey.slice(
              -4
            )}`
          : "Unknown");

      setNewWalletAddress(displayAddress);

      setIsCreatingWallet(false);
      setWalletCreated(true);
      setWalletCreationStep("gesture");
      setShowWalletCreatedAlert(true);
    } catch (error) {
      console.error(
        "   OnboardingPage4: Arduino wallet creation failed:",
        error
      );
      setIsCreatingWallet(false);
      if (error.message?.includes("Maximum wallets reached")) {
        Alert.alert(
          "Wallet Limit",
          "Arduino device already has the maximum number of wallets (3). Please delete a wallet first."
        );
      } else {
        Alert.alert(
          "Wallet Creation Error",
          "Failed to create wallet on Arduino device. Please try again."
        );
      }
    }
  };

  const proceedToGestureSetup = () => {
    setShowWalletCreatedAlert(false);
    setShowWalletCreationFlow(false);
    setShowLetterGrid(true);
  };

  const handleLetterSelection = (letter) => {
    if (selectedLetters.includes(letter)) {
      setSelectedLetters(selectedLetters.filter((l) => l !== letter));
    } else if (selectedLetters.length < 2) {
      setSelectedLetters([...selectedLetters, letter]);
    } else {
      setShowLetterSelectionAlert(true);
    }
  };

  const startMorseEntry = () => {
    if (selectedLetters.length !== 2) {
      setShowLetterSelectionAlert(true);
      return;
    }
    setMorseStep("entry");
    setMorseInput("");
    setMorseError("");
    setShowMorseModal(true);

    // Simulation: start 5-second timer when modal opens
    if (SIMULATE_MORSE) {
      console.log(
        "🧪 Start activation: opening modal and starting 5s simulation timer"
      );
      setIsSimulatingVerify(true);
      setTimeout(() => {
        console.log(
          "🧪 Simulation: 5s timer fired, closing modal and showing success"
        );
        // Close the entry modal
        setShowMorseModal(false);
        // Show success
        setMorseStep("success");
        setWalletActivated(true);
        setActivationSetupCompleted(true);
        setMorseInput("");
        setMorseVerifyInput("");
        setSelectedLetters([]);
        setShowLetterGrid(false);
        setIsSimulatingVerify(false);
        // Show success alert after brief delay
        setTimeout(() => {
          setShowMorseSuccessAlert(true);
        }, 200);
      }, 10000);
    }
  };

  const verifyMorse = async () => {
    console.log("🧪 verifyMorse pressed", {
      SIMULATE_MORSE,
      morseStep,
      showMorseModal,
    });

    // Skip real verification during simulation
    if (SIMULATE_MORSE) {
      console.log(
        "🧪 verifyMorse: skipping real verification, simulation is running"
      );
      return;
    }

    const expectedCode = selectedLetters
      .map((letter) => MORSE_ALPHABET[letter])
      .join("");

    if (morseStep === "entry") {
      if (morseInput === expectedCode) {
        setMorseStep("verify");
        setMorseVerifyInput("");
        setMorseError("");
      } else {
        setShowGestureMismatchAlert(true);
        setMorseInput("");
      }
    } else if (morseStep === "verify") {
      if (morseVerifyInput === expectedCode) {
        try {
          await sendGestureToDevice(expectedCode);
          setMorseStep("success");
          setWalletActivated(true);
          setActivationSetupCompleted(true);
          setTimeout(() => {
            setShowMorseSuccessAlert(true);
            setShowMorseModal(false);
          }, 1000);
          setMorseInput("");
          setMorseVerifyInput("");
          setSelectedLetters([]);
          setShowLetterGrid(false);
        } catch (_error) {
          Alert.alert(
            "Gesture Setup Failed",
            "Failed to save gesture to device. Please try again."
          );
          setMorseStep("entry");
          setMorseInput("");
          setMorseVerifyInput("");
        }
      } else {
        setMorseError("Codes don't match. Please try again.");
        setMorseVerifyInput("");
      }
    }
  };

  const sendGestureToDevice = async (morseCode) => {
    console.log("    OnboardingPage4: Sending gesture to device...");
    try {
      // Show loading state
      setMorseError("");

      const result = await BleService.saveGestureToDevice(morseCode);
      console.log(
        "  OnboardingPage4: Gesture sent to device successfully",
        result
      );

      // Check if the gesture was actually saved
      if (result && result.success) {
        console.log("  OnboardingPage4: Gesture saved successfully");
        console.log("  OnboardingPage4: Gesture saved to device successfully");

        return result;
      } else {
        throw new Error("Gesture save failed - no success response");
      }
    } catch (error) {
      console.error(
        "   OnboardingPage4: Failed to send gesture to device:",
        error
      );

      let errorMessage = "Failed to save gesture to device. ";
      if (error.message.includes("Session expired")) {
        errorMessage =
          "Your device session has expired. Please re-authenticate with your device PIN first, then try again.";
        Alert.alert(
          "Session Expired",
          "Your device session has expired. Please re-authenticate with your device PIN first.",
          [
            {
              text: "OK",
              onPress: () => {
                // Reset to entry step so user can try again after authentication
                setMorseStep("entry");
                setMorseInput("");
                setMorseVerifyInput("");
              },
            },
          ]
        );
      } else if (error.message.includes("Authentication required")) {
        errorMessage =
          "Device authentication required. Please authenticate with your device PIN first, then try again.";
        Alert.alert(
          "Authentication Required",
          "Your device needs to be authenticated before saving the gesture. Please authenticate with your device PIN first.",
          [
            {
              text: "OK",
              onPress: () => {
                setMorseStep("entry");
                setMorseInput("");
                setMorseVerifyInput("");
              },
            },
          ]
        );
      } else if (error.message.includes("timeout")) {
        errorMessage +=
          "The device didn't respond in time, but the gesture may have been saved.";
      } else if (error.message.includes("No device connected")) {
        errorMessage += "Please ensure your device is connected.";
      } else {
        errorMessage += "Please try again.";
      }

      setMorseError(errorMessage);
      throw error;
    }
  };

  const renderLetterGrid = () => (
    <View style={styles.letterGrid}>
      {Object.keys(MORSE_ALPHABET).map((letter) => (
        <TouchableOpacity
          key={letter}
          style={[
            styles.letterButton,
            selectedLetters.includes(letter) && styles.letterButtonSelected,
          ]}
          onPress={() => handleLetterSelection(letter)}
        >
          <Text
            style={[
              styles.letterText,
              selectedLetters.includes(letter) && styles.letterTextSelected,
            ]}
          >
            {letter}
          </Text>
          <Text
            style={[
              styles.morseCode,
              selectedLetters.includes(letter) && styles.morseCodeSelected,
            ]}
          >
            {MORSE_ALPHABET[letter]}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderWalletCreationFlow = () => (
    <Modal
      visible={showWalletCreationFlow}
      animationType="slide"
      transparent={true}
      onRequestClose={() => {}}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {walletCreationStep === "create"
                ? "Create Wallet"
                : "Wallet Created"}
            </Text>
          </View>

          {walletCreationStep === "create" && (
            <View style={styles.walletCreationContainer}>
              <Text style={styles.walletCreationTitle}>New Device Setup</Text>
              <Text style={styles.walletCreationDescription}>
                Your SuiStep device doesn&apos;t have any wallets yet.
                Let&apos;s create your first wallet to get started.
              </Text>

              <View style={styles.walletCreationFeatures}>
                <View style={styles.featureItem}>
                  <Text style={styles.featureIcon}>🔐</Text>
                  <Text style={styles.featureText}>
                    Secure private key storage on device
                  </Text>
                </View>
                <View style={styles.featureItem}>
                  <Text style={styles.featureIcon}>⚡</Text>
                  <Text style={styles.featureText}>
                    Offline transaction signing
                  </Text>
                </View>
                <View style={styles.featureItem}>
                  <Text style={styles.featureIcon}>👤</Text>
                  <Text style={styles.featureText}>
                    Up to 3 wallets per device
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.createWalletButton,
                  isCreatingWallet && styles.createWalletButtonDisabled,
                ]}
                onPress={createNewWallet}
                disabled={isCreatingWallet}
              >
                <Text style={styles.createWalletButtonText}>
                  {isCreatingWallet ? "Creating Wallet..." : "Create Wallet"}
                </Text>
              </TouchableOpacity>

              {isCreatingWallet && (
                <View style={styles.creatingWalletIndicator}>
                  <View style={styles.creatingSpinner} />
                  <Text style={styles.creatingText}>
                    Generating secure keys on device...
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );

  const renderMorseModal = () => (
    <Modal
      visible={showMorseModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => {
        console.log("🧪 Modal onRequestClose triggered; hiding morse modal");
        setShowMorseModal(false);
      }}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {morseStep === "entry"
                ? "Enter Your Code"
                : morseStep === "verify"
                ? "Verify Your Code"
                : "Success!"}
            </Text>
            <TouchableOpacity
              onPress={() => {
                console.log("🧪 Close button pressed; hiding morse modal");
                setShowMorseModal(false);
              }}
              style={styles.modalCloseButton}
            >
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>

          {morseStep !== "success" && (
            <>
              <View style={styles.selectedLettersContainer}>
                <Text style={styles.selectedLettersTitle}>Your Letters:</Text>
                <View style={styles.selectedLettersDisplay}>
                  {selectedLetters.map((letter, index) => (
                    <View key={letter} style={styles.letterDisplay}>
                      <Text style={styles.letterDisplayText}>{letter}</Text>
                      <Text style={styles.morseDisplayText}>
                        {MORSE_ALPHABET[letter]}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

              {isSimulatingVerify && (
                <View style={styles.simulationContainer}>
                  <Text style={styles.simulationTitle}>
                    🧪 Simulating Morse Code Entry
                  </Text>
                  <View style={styles.progressBarContainer}>
                    <View style={styles.progressBar}>
                      <View
                        style={[
                          styles.progressFill,
                          { width: `${(Date.now() % 5000) / 50}%` },
                        ]}
                      />
                    </View>
                  </View>
                  <Text style={styles.simulationSubtext}>
                    Simulating pressure input from SuiStep device...
                  </Text>
                </View>
              )}
              {morseError ? (
                <Text style={styles.morseError}>{morseError}</Text>
              ) : null}

              <TouchableOpacity
                style={[
                  styles.verifyButton,
                  isSimulatingVerify && { opacity: 0.6 },
                ]}
                onPress={() => {
                  verifyMorse();
                }}
                disabled={isSimulatingVerify}
              >
                <Text style={styles.verifyButtonText}>
                  {isSimulatingVerify
                    ? "Verifying… Please wait"
                    : "Enter your Morse Code by making gestures of the selected letters on your device"}
                </Text>
              </TouchableOpacity>
            </>
          )}

          {morseStep === "success" && (
            <View style={styles.successContainer}>
              <Text style={styles.successTitle}>Activation Complete!</Text>
              <Text style={styles.successMessage}>
                Your wallet is now activated and ready to use. Your activation
                code has been saved to your device.
              </Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Image source={OnboardingPageActivateWalletImg} style={styles.image} />

        <Text style={styles.title}>Activate Your Wallet</Text>
        <Text style={styles.subtitle}>
          {walletCreated
            ? "Set up your activation code using Morse code gestures. This will be used to unlock your wallet and sign transactions."
            : "First, we need to set up your wallet on the device, then configure your security gesture."}
        </Text>

        {!deviceConnected && (
          <View style={styles.connectionWarning}>
            <Text style={styles.connectionWarningText}>
              Please connect your SuiStep device first
            </Text>
          </View>
        )}

        {deviceConnected && !walletCreated && (
          <TouchableOpacity
            style={styles.createWalletPrompt}
            onPress={() => setShowWalletCreationFlow(true)}
          >
            <Text style={styles.createWalletPromptText}>
              📱 Create Wallet on Device
            </Text>
          </TouchableOpacity>
        )}

        {showLetterGrid && (
          <View style={styles.tutorialContainer}>
            <Text style={styles.tutorialTitle}>Select Your Letters</Text>
            <Text style={styles.tutorialDescription}>
              Choose 2 letters from the alphabet to create your unique
              activation code. These will be used to unlock your wallet and sign
              transactions.
            </Text>
            {selectedLetters.length < 2 && (
              <Text style={styles.tutorialAction}>Tap 2 letters below</Text>
            )}
          </View>
        )}

        {selectedLetters.length > 0 && showLetterGrid && (
          <View style={styles.selectedContainer}>
            <Text style={styles.selectedTitle}>Selected Letters:</Text>
            <View style={styles.selectedLetters}>
              {selectedLetters.map((letter, index) => (
                <View key={letter} style={styles.selectedLetter}>
                  <Text style={styles.selectedLetterText}>{letter}</Text>
                  <Text style={styles.selectedMorseText}>
                    {MORSE_ALPHABET[letter]}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {showLetterGrid && (
          <TouchableOpacity
            style={[
              styles.activateButton,
              selectedLetters.length !== 2 && styles.activateButtonDisabled,
            ]}
            onPress={() => {
              startMorseEntry();
            }}
            disabled={selectedLetters.length !== 2}
          >
            <Text style={styles.activateButtonText}>
              {selectedLetters.length === 2
                ? "Start Activation"
                : `Select ${2 - selectedLetters.length} more letter${
                    2 - selectedLetters.length === 1 ? "" : "s"
                  }`}
            </Text>
          </TouchableOpacity>
        )}

        {walletActivated && (
          <View style={styles.successContainer}>
            <Text style={styles.successTitle}> Wallet Activated!</Text>
            <Text style={styles.successMessage}>
              Your wallet has been successfully activated. You can now proceed
              to get started.
            </Text>
          </View>
        )}

        {showLetterGrid && renderLetterGrid()}
      </View>

      <View style={styles.indicatorContainer}>
        <PageIndicator totalPages={3} currentPage={currentPage} />
      </View>

      {renderWalletCreationFlow()}
      {renderMorseModal()}

      <CustomAlert
        visible={showWalletCreatedAlert}
        title="Arduino Wallet Created!"
        message={`Your new wallet has been created on the Arduino device!\n\nAddress: ${newWalletAddress}\n\nNow let's set up your security gesture for authentication.`}
        buttons={[
          {
            text: "Continue",
            onPress: proceedToGestureSetup,
          },
        ]}
        onRequestClose={() => {}}
      />

      <CustomAlert
        visible={showLetterSelectionAlert}
        title="Maximum Letters Reached"
        message="You can only select 2 letters for your activation code. Please deselect a letter before selecting a new one."
        buttons={[
          {
            text: "OK",
            onPress: () => setShowLetterSelectionAlert(false),
          },
        ]}
        onRequestClose={() => setShowLetterSelectionAlert(false)}
      />

      <CustomAlert
        visible={showGestureMismatchAlert}
        title="Incorrect Gesture"
        message="The gesture you entered doesn't match your selected letters. Please try again with the correct Morse code pattern, or select different letters."
        buttons={[
          {
            text: "Try Again",
            onPress: () => {
              setShowGestureMismatchAlert(false);
              setMorseInput("");
            },
          },
          {
            text: "Select Different Letters",
            onPress: () => {
              setShowGestureMismatchAlert(false);
              setShowMorseModal(false);
              setSelectedLetters([]);
            },
          },
        ]}
        onRequestClose={() => setShowGestureMismatchAlert(false)}
      />

      <CustomAlert
        visible={showMorseSuccessAlert}
        title="Wallet Activated Successfully!"
        message="Your wallet is now activated and ready to use. Your activation code has been saved to your device and will be used for future transactions."
        buttons={[
          {
            text: "Continue",
            onPress: () => {
              setShowMorseSuccessAlert(false);
            },
          },
        ]}
        onRequestClose={() => {
          setShowMorseSuccessAlert(false);
        }}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
  },
  content: {
    flex: 1,
    paddingVertical: 40,
  },
  image: {
    width: 200,
    height: 200,
    alignSelf: "center",
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: Colors.white,
    textAlign: "center",
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.gray,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 30,
  },
  connectionWarning: {
    backgroundColor: "rgba(255, 107, 107, 0.1)",
    borderColor: "#FF6B6B",
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  connectionWarningText: {
    color: "#FF6B6B",
    fontSize: 14,
    textAlign: "center",
    fontWeight: "600",
  },
  createWalletPrompt: {
    backgroundColor: Colors.thickOrange,
    borderRadius: 12,
    padding: 20,
    marginBottom: 30,
    alignItems: "center",
  },
  createWalletPromptText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },
  tutorialContainer: {
    backgroundColor: Colors.lightGray,
    borderRadius: 12,
    padding: 20,
    marginBottom: 30,
  },
  tutorialTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: Colors.white,
    marginBottom: 8,
  },
  tutorialDescription: {
    fontSize: 14,
    color: Colors.gray,
    lineHeight: 20,
    marginBottom: 8,
  },
  tutorialAction: {
    fontSize: 14,
    color: Colors.thickOrange,
    fontWeight: "600",
  },
  selectedContainer: {
    marginBottom: 30,
  },
  selectedTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.white,
    marginBottom: 12,
  },
  selectedLetters: {
    flexDirection: "row",
    gap: 12,
  },
  selectedLetter: {
    backgroundColor: Colors.thickOrange,
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
    minWidth: 60,
  },
  selectedLetterText: {
    fontSize: 18,
    fontWeight: "bold",
    color: Colors.white,
  },
  selectedMorseText: {
    fontSize: 12,
    color: Colors.white,
    marginTop: 4,
  },
  activateButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.thickOrange,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    justifyContent: "center",
    marginBottom: 30,
  },
  activateButtonDisabled: {
    backgroundColor: Colors.gray,
    opacity: 0.5,
  },
  activateButtonText: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.white,
    marginLeft: 12,
  },
  indicatorContainer: {
    paddingBottom: 40,
  },
  letterGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 20,
  },
  letterButton: {
    width: "18%",
    aspectRatio: 1,
    backgroundColor: Colors.lightGray,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  letterButtonSelected: {
    backgroundColor: Colors.thickOrange,
  },
  letterText: {
    fontSize: 18,
    fontWeight: "bold",
    color: Colors.white,
  },
  letterTextSelected: {
    color: Colors.white,
  },
  morseCode: {
    fontSize: 10,
    color: Colors.thickOrange,
    marginTop: 2,
  },
  morseCodeSelected: {
    color: Colors.white,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: Colors.primary,
    borderRadius: 24,
    padding: 28,
    margin: 20,
    minWidth: 320,
    maxHeight: "85%",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  modalTitle: {
    color: Colors.white,
    fontSize: 22,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.lightGray,
    justifyContent: "center",
    alignItems: "center",
  },
  modalCloseText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: "bold",
  },
  walletCreationContainer: {
    alignItems: "center",
  },
  walletCreationTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: Colors.white,
    marginBottom: 16,
    textAlign: "center",
  },
  walletCreationDescription: {
    fontSize: 16,
    color: Colors.gray,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 30,
  },
  walletCreationFeatures: {
    width: "100%",
    marginBottom: 30,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  featureIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  featureText: {
    fontSize: 16,
    color: Colors.white,
    flex: 1,
  },
  createWalletButton: {
    backgroundColor: Colors.thickOrange,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 20,
    width: "100%",
    alignItems: "center",
  },
  createWalletButtonDisabled: {
    backgroundColor: Colors.gray,
    opacity: 0.5,
  },
  createWalletButtonText: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.white,
  },
  creatingWalletIndicator: {
    alignItems: "center",
  },
  creatingSpinner: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 3,
    borderColor: Colors.thickOrange,
    borderTopColor: "transparent",
    marginBottom: 12,
  },
  creatingText: {
    color: Colors.gray,
    fontSize: 14,
    textAlign: "center",
  },
  // Updated section styles
  selectedLettersContainer: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: Colors.lightGray,
    borderRadius: 12,
  },
  selectedLettersTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.white,
    marginBottom: 12,
    textAlign: "center",
  },
  selectedLettersDisplay: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
  },
  letterDisplay: {
    backgroundColor: Colors.thickOrange,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    minWidth: 70,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  letterDisplayText: {
    fontSize: 20,
    fontWeight: "bold",
    color: Colors.white,
    marginBottom: 4,
  },
  morseDisplayText: {
    fontSize: 12,
    color: Colors.white,
    opacity: 0.9,
    fontFamily: "monospace",
  },

  // Improved input container
  morseInputContainer: {
    marginBottom: 24,
  },
  morseInputLabel: {
    fontSize: 14,
    color: Colors.gray,
    marginBottom: 8,
    textAlign: "center",
    fontWeight: "500",
  },
  morseInput: {
    fontSize: 20,
    fontFamily: "monospace",
    color: Colors.white,
    backgroundColor: Colors.lightGray,
    padding: 16,
    borderRadius: 12,
    textAlign: "center",
    borderWidth: 2,
    borderColor: Colors.thickOrange,
    minHeight: 60,
  },

  // Enhanced device instructions
  deviceInstructions: {
    alignItems: "center",
    marginBottom: 24,
    padding: 16,
    backgroundColor: "rgba(244, 130, 80, 0.1)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(244, 130, 80, 0.3)",
  },
  deviceInstructionsText: {
    fontSize: 16,
    color: Colors.white,
    textAlign: "center",
    marginBottom: 12,
    fontWeight: "600",
  },
  deviceInstructionsSubtext: {
    fontSize: 14,
    color: Colors.gray,
    textAlign: "center",
    marginBottom: 6,
    lineHeight: 20,
  },

  // Better error styling
  morseError: {
    color: "#FF6B6B",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 16,
    padding: 12,
    backgroundColor: "rgba(255, 107, 107, 0.1)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 107, 107, 0.3)",
  },

  // Enhanced verify button
  verifyButton: {
    backgroundColor: Colors.lightGray,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    paddingHorizontal: 20,
  },
  verifyButtonText: {
    fontSize: 18,
    fontWeight: "bold",
    color: Colors.white,
    letterSpacing: 0.5,
    textAlign: "center",
  },

  // Improved success container
  successContainer: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  successTitle: {
    fontSize: 26,
    fontWeight: "bold",
    color: Colors.white,
    marginBottom: 12,
    textAlign: "center",
  },
  successMessage: {
    fontSize: 16,
    color: Colors.gray,
    textAlign: "center",
    lineHeight: 24,
    maxWidth: 280,
  },
  // Simulation styles
  simulationContainer: {
    marginTop: 16,
    padding: 20,
    backgroundColor: Colors.lightGray,
    borderRadius: 12,
    alignItems: "center",
  },
  simulationTitle: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 12,
    textAlign: "center",
  },
  progressBarContainer: {
    width: "100%",
    marginBottom: 12,
  },
  progressBar: {
    width: "100%",
    height: 8,
    backgroundColor: Colors.primary,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: Colors.thickOrange,
    borderRadius: 4,
  },
  simulationSubtext: {
    color: Colors.gray,
    fontSize: 12,
    textAlign: "center",
  },
});

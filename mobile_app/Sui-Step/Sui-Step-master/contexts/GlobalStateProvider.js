import * as SecureStore from "expo-secure-store";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Alert, AppState } from "react-native";
import BleService from "../services/BleService";
import feedbackManager from "../utils/feedbackUtils";

import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";
import SuiRpcService from "../services/SuiRpcService";
const GlobalStateContext = createContext();

function useWalletAddress() {
  const [walletAddress, setWalletAddressState] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const setWalletAddress = (address) => {
    setWalletAddressState(address);
    console.log("    GlobalState: Set wallet address:", address);
  };

  return { walletAddress, setWalletAddress, isLoading };
}

export const GlobalStateProvider = ({ children }) => {
  const {
    walletAddress,
    setWalletAddress,
    isLoading: walletAddressLoading,
  } = useWalletAddress();

  const [selectedLetters, setSelectedLetters] = useState([]);
  const [morseStep, setMorseStep] = useState("entry");
  const [morseInput, setMorseInput] = useState("");
  const [morseVerifyInput, setMorseVerifyInput] = useState("");
  const [morseError, setMorseError] = useState("");
  const [showMorseModal, setShowMorseModal] = useState(false);
  const [showLetterSelectionAlert, setShowLetterSelectionAlert] =
    useState(false);
  const [showGestureMismatchAlert, setShowGestureMismatchAlert] =
    useState(false);
  const [showMorseSuccessAlert, setShowMorseSuccessAlert] = useState(false);
  const [walletActivated, setWalletActivated] = useState(false);
  const [activationSetupCompleted, setActivationSetupCompleted] =
    useState(false);
  const [showLetterGrid, setShowLetterGrid] = useState(false);
  const [showWalletCreationFlow, setShowWalletCreationFlow] = useState(false);
  const [walletCreated, setWalletCreated] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [isRealBleConnected, setIsRealBleConnected] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [deviceConnected, setDeviceConnected] = useState(false);

  useEffect(() => {
    console.log(
      "🔍 GlobalState: deviceConnected state changed to:",
      deviceConnected
    );
  }, [deviceConnected]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [bleInitialized, setBleInitialized] = useState(false);
  const [blePermissionsGranted, setBlePermissionsGranted] = useState(false);
  const [devices, setDevices] = useState([]); // New state for discovered devices
  const [isScanning, setIsScanning] = useState(false); // New state for scanning status
  const [deviceSetupCompleted, setDeviceSetupCompleted] = useState(false);
  const [showDisconnectionModal, setShowDisconnectionModal] = useState(false);
  const [gestureSaved, setGestureSaved] = useState(false);
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [balance, setBalance] = useState(0);
  const [allBalances, setAllBalances] = useState([]);
  const [txHistory, setTxnHistory] = useState([]);
  // Transaction state
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [currentTransaction, setCurrentTransaction] = useState(null);
  const [authInProgress, setAuthInProgress] = useState(false);
  // Auth/Signing states
  const [authChallenge, setAuthChallenge] = useState("");
  const [authMorseInput, setAuthMorseInput] = useState("");
  const [transactionSigning, setTransactionSigning] = useState(false);
  // Settings states
  const [bleEnabled, setBleEnabled] = useState(false);
  const [selectedCalibration, setSelectedCalibration] = useState("baseline");
  const [noiseFloor, setNoiseFloor] = useState(150);
  const [dotPressure, setDotPressure] = useState(300);
  const [dashPressure, setDashPressure] = useState(1000);

  const [emergencyCode, setEmergencyCode] = useState("");
  // feedback preferences (persisted later if needed)
  const [vibration, setVibration] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  // Password management
  const [devicePassword, setDevicePassword] = useState("2024"); // Default password
  const [isPasswordChanged, setIsPasswordChanged] = useState(false);
  // App state refs
  const appStateRef = useRef(AppState.currentState);
  const backgroundTimerRef = useRef(null);

  const showToast = useCallback((message) => {
    setToastMessage(message);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2000);
  }, []);

  // Password management functions
  const loadDevicePassword = useCallback(async () => {
    try {
      const savedPassword = await SecureStore.getItemAsync("devicePassword");
      if (savedPassword) {
        setDevicePassword(savedPassword);
        setIsPasswordChanged(true);
        console.log("    GlobalState: Loaded saved device password");
      } else {
        console.log("    GlobalState: Using default password");
      }
    } catch (error) {
      console.log("Error loading device password:", error);
    }
  }, []);

  const saveDevicePassword = useCallback(async (newPassword) => {
    try {
      await SecureStore.setItemAsync("devicePassword", newPassword);
      setDevicePassword(newPassword);
      setIsPasswordChanged(true);
      console.log("    GlobalState: Saved new device password");
    } catch (error) {
      console.log("Error saving device password:", error);
    }
  }, []);

  // Feedback settings persistence functions
  const loadFeedbackSettings = useCallback(async () => {
    try {
      const savedVibration = await SecureStore.getItemAsync("vibrationEnabled");

      if (savedVibration !== null) {
        const vibrationEnabled = savedVibration === "true";
        setVibration(vibrationEnabled);
        console.log(
          "    GlobalState: Loaded vibration setting:",
          vibrationEnabled
        );
      }

      // Initialize feedback manager with loaded settings
      feedbackManager.init(vibration);
    } catch (error) {
      console.log("Error loading feedback settings:", error);
    }
  }, [vibration]);

  const saveFeedbackSettings = useCallback(async (type, value) => {
    try {
      if (type === "vibration") {
        await SecureStore.setItemAsync("vibrationEnabled", value.toString());
        setVibration(value);
        console.log("    GlobalState: Saved vibration setting:", value);

        // Update feedback manager with new settings
        feedbackManager.updateSettings(value);

        // Test vibration when setting is enabled
        if (value) {
          await feedbackManager.testVibration();
        }
      }
    } catch (error) {
      console.log("Error saving feedback settings:", error);
    }
  }, []);

  // Function to scan for devices
  const scanForBleDevices = useCallback(async () => {
    if (isScanning) {
      console.log("    GlobalState: Already scanning, ignoring request.");
      return;
    }

    setDevices([]);
    setIsScanning(true);
    console.log("    GlobalState: Starting scan for devices...");

    BleService.scanForDevices(
      (device) => {
        // Scan devices ONLY if it ain't on the list
        setDevices((prevDevices) => {
          if (!prevDevices.find((d) => d.id === device.id)) {
            console.log(
              "  GlobalState: Found new device:",
              device.name,
              "ID:",
              device.id
            );
            return [...prevDevices, device];
          }
          console.log("   GlobalState: Device already in list:", device.name);
          return prevDevices;
        });
      },
      () => {
        // On scan end callback
        setIsScanning(false);
        console.log(
          " GlobalState: Device scan stopped. Total devices found:",
          devices.length
        );
      }
    );
  }, [isScanning]);

  // Fetch wallet data
  const fetchWalletData = useCallback(async () => {
    if (!walletAddress) {
      console.log(
        "    GlobalState: No wallet address, skipping wallet data fetch"
      );
      return;
    }

    try {
      console.log("    GlobalState: Fetching wallet data for:", walletAddress);
      const rpcUrl = getFullnodeUrl("testnet");
      const client = new SuiClient({ url: rpcUrl });

      const balance = await client.getBalance({
        owner: walletAddress,
        coinType: "0x2::sui::SUI",
      });
      setBalance(balance);
      console.log("    GlobalState: Balance:", balance);
      try {
        const suiNum = Number(balance?.totalBalance || 0) / 1_000_000_000;
        setWalletBalance(suiNum);
      } catch (_) {}

      const allBalances = await client.getAllBalances({
        owner: walletAddress,
      });
      setAllBalances(allBalances);
      console.log("    GlobalState: All Balances:", allBalances);

      // Fetch transaction history (both sent adn received)
      try {
        const history = await SuiRpcService.fetchWalletTransactionsRpc(
          walletAddress,
          "testnet",
          50
        );
        setTxnHistory(history);
        console.log("    GlobalState: Txn history count:", history.length);
        console.log(
          "    GlobalState: Txn history details:",
          JSON.stringify(history, null, 2)
        );
      } catch (e) {
        console.log(
          "   GlobalState: Txn history fetch failed (RPC):",
          e?.message || e
        );
        setTxnHistory([]);
      }
    } catch (error) {
      console.error("   GlobalState: Failed to fetch wallet data:", error);
    }
  }, [walletAddress]);

  // Fetch wallet data when wallet address is loaded
  useEffect(() => {
    if (walletAddress && !walletAddressLoading) {
      console.log(
        "    GlobalState: Wallet address loaded, fetching wallet data"
      );
      fetchWalletData();
    }
  }, [walletAddress, walletAddressLoading, fetchWalletData]);

  // Load password and haptic settings on app startup
  useEffect(() => {
    loadDevicePassword();
    loadFeedbackSettings();
  }, [loadDevicePassword, loadFeedbackSettings]);

  // Function to connect to a device
  const connectToBleDevice = async (deviceId) => {
    const deviceToConnect = devices.find((d) => d.id === deviceId);
    if (!deviceToConnect) {
      console.error(
        "   GlobalState: Device not found for connection:",
        deviceId
      );
      await feedbackManager.error();
      return;
    }

    try {
      await BleService.connectToDevice(deviceToConnect);
      await feedbackManager.connect();
    } catch (error) {
      console.error("   GlobalState: Connection failed:", error);
      await feedbackManager.error();
    }
  };

  // Disconnect from the device
  const disconnectBleDevice = async () => {
    try {
      await BleService.disconnect();
      await feedbackManager.disconnect();
    } catch (error) {
      console.error("   GlobalState: Disconnect failed:", error);
      await feedbackManager.error();
    }
  };

  // Function to disconnect and clear wallet data (for security, we ain't saving nothing on the app)
  const disconnectAndClearWallet = async () => {
    await BleService.disconnect();
    try {
      setWalletAddress("");
      setWalletBalance(0);
      setBalance(0);
      setAllBalances([]);
    } catch (_) {}
  };

  // Function to prepare transaction
  const prepareTransaction = useCallback(async (recipientAddress, amount) => {
    try {
      console.log("    GlobalState: Preparing transaction...");
      const transactionData = {
        recipient: recipientAddress,
        amount: amount,
        timestamp: Date.now(),
        id: Math.random().toString(36).substr(2, 9),
      };
      setCurrentTransaction(transactionData);
      return transactionData;
    } catch (error) {
      console.error("   GlobalState: Failed to prepare transaction:", error);
      throw error;
    }
  }, []);

  // Authentication helpers (for max security, auth before even signing txn)
  const startAuthentication = useCallback(async (challengeWord) => {
    setAuthChallenge(challengeWord || "");
    if (challengeWord && challengeWord !== "VERIFY") {
      setAuthMorseInput("");
    }
    setAuthInProgress(true);
  }, []);

  const completeAuthentication = useCallback(() => {
    setAuthInProgress(false);
    setAuthChallenge("");
    setAuthMorseInput("");
  }, []);

  const signTransactionWithBle = useCallback(async (txData) => {
    try {
      setTransactionSigning(true);
      console.log("    GlobalState: Transaction signing initiated");
      return { success: true };
    } finally {
      setTransactionSigning(false);
    }
  }, []);

  // Start re-authentication process (for max security, users enter their PIN after all time out from the device)
  const startReAuthentication = useCallback(async () => {
    try {
      console.log("    GlobalState: Starting re-authentication process...");

      // Generate a new challenge for re-authentication
      const challenge = "REAUTH";
      setAuthChallenge(challenge);
      setAuthMorseInput("");
      setAuthInProgress(true);

      // Start authentication with the new challenge
      await BleService.startAuthentication(challenge);

      console.log("  GlobalState: Re-authentication initiated");
    } catch (error) {
      console.error("   GlobalState: Re-authentication failed:", error);
      Alert.alert(
        "Re-authentication Failed",
        "Failed to start re-authentication. Please try again or reconnect your device.",
        [
          {
            text: "OK",
            onPress: () => {
              // If re-authentication fails, disconnect device
              BleService.disconnect();
              setDeviceConnected(false);
              setIsRealBleConnected(false);
              setSelectedDevice(null);
            },
          },
        ]
      );
    }
  }, []);

  // Hook for BLE initialization and lifecycle management
  useEffect(() => {
    const initBle = async () => {
      console.log("    GlobalState: Initializing BLE services...");
      try {
        // Request Bluetooth permissions before starting anything
        const granted = await BleService.requestPermissions();
        setBlePermissionsGranted(granted);
        if (!granted) {
          console.log("   GlobalState: BLE permissions not granted");
          return;
        }

        // Set up the state change listener first, so we capture the initial state
        BleService.manager.onStateChange(async (state) => {
          console.log("📡 BLE Manager state changed to:", state);
          if (state === "PoweredOn") {
            setBleInitialized(true);
            console.log("  GlobalState: BLE service is powered on.");
          } else {
            setBleInitialized(false);
            console.log(
              "   GlobalState: BLE service is powered off. Please enable Bluetooth."
            );
          }
        }, true); // Triggers the callback immediately for the current state

        // Sets up all other event callbacks on the BleService instance
        BleService.setCallbacks({
          onConnected: async (device) => {
            console.log("  GlobalState: Device connected:", device.name);
            console.log("🔍 GlobalState: Setting deviceConnected to true");
            setDeviceConnected(true);
            setSelectedDevice(device);
            setIsRealBleConnected(true);
            console.log(
              "🔍 GlobalState: Device state updated - deviceConnected should now be true"
            );
            showToast(`Connected to ${device.name || "device"}`);
            try {
              if (vibration) {
                await feedbackManager.success();
              }
            } catch (_) {}
            // Fetch wallet data after successful connection
            fetchWalletData();
          },
          onDisconnected: (error) => {
            console.log("   GlobalState: Device disconnected:", error);
            console.log("🔍 GlobalState: Setting deviceConnected to false");
            setDeviceConnected(false);
            setIsRealBleConnected(false);
            setSelectedDevice(null);
            console.log(
              "🔍 GlobalState: Device state updated - deviceConnected should now be false"
            );
            setDeviceSetupCompleted(false);
            setIsAuthenticated(false);
            setWalletActivated(false);
            setActivationSetupCompleted(false);
            setWalletCreated(false);
            setGestureSaved(false);
            setShowLetterGrid(false);
            setShowWalletCreationFlow(false);
            setSelectedLetters([]);
            setMorseInput("");
            setMorseVerifyInput("");
            setMorseError("");
            setShowMorseModal(false);
            setShowLetterSelectionAlert(false);
            setShowGestureMismatchAlert(false);
            setShowMorseSuccessAlert(false);
            setMorseStep("entry");
            setWalletAddress("");

            console.log(" GlobalState: Setting showDisconnectionModal to true");
            setShowDisconnectionModal(true);
            console.log(
              " GlobalState: Disconnection modal should now be visible"
            );
            try {
              showToast("Device disconnected - all data cleared");
            } catch (_) {}
            try {
              if (vibration) {
                feedbackManager.error();
              }
            } catch (_) {}
            // Clears all wallet data on disconnect - user must and re-authenticate to be able to reconnect
          },
          onWalletCreated: (wallet) => {
            console.log("  GlobalState: Wallet created:", wallet);
            setWalletCreated(true);
          },
          onMorseInput: (input) => {
            setAuthMorseInput(input || "");
            console.log("    GlobalState: Morse input:", input);
          },
          onError: (error) => {
            console.error("   GlobalState: BLE error:", error);
            Alert.alert("BLE Error", error.message);
          },
          onAuthenticationSuccess: () => {
            setIsAuthenticated(true);
          },
          onSessionExpired: (result) => {
            console.log(
              "   GlobalState: Session expired - re-authentication required:",
              result
            );
            setIsAuthenticated(false);

            // Show re-authentication prompt
            Alert.alert(
              "Session Expired",
              "Your device session has expired. Please re-authenticate with your device PIN to continue.",
              [
                {
                  text: "Cancel",
                  style: "cancel",
                  onPress: () => {
                    console.log(
                      "    GlobalState: User cancelled re-authentication"
                    );
                    console.log(
                      "🔍 GlobalState: Disconnecting device due to user cancellation"
                    );
                    // Disconnect device if user cancels
                    BleService.disconnect();
                    setDeviceConnected(false);
                    setIsRealBleConnected(false);
                    setSelectedDevice(null);
                    console.log(
                      "🔍 GlobalState: Device disconnected - deviceConnected set to false"
                    );
                  },
                },
                {
                  text: "Re-authenticate",
                  onPress: () => {
                    console.log(
                      "    GlobalState: User chose to re-authenticate"
                    );
                    startReAuthentication();
                  },
                },
              ]
            );
          },
          onWalletSelected: () => {
            console.log(
              "  GlobalState: Wallet selected - marking device setup complete"
            );
            setDeviceSetupCompleted(true);
          },
          onGestureSaved: (result) => {
            console.log("  GlobalState: Gesture saved to device:", result);
            setGestureSaved(true);
          },
          onGestureVerified: (result) => {
            console.log("  GlobalState: Gesture verified on device:", result);
          },
          onGestureMismatch: (result) => {
            console.log("   GlobalState: Gesture mismatch on device:", result);
          },
          onCreateWallet: (walletData) => {
            console.log("  GlobalState: Wallet created on device:", walletData);
            setWalletCreated(true);

            if (walletData?.address) {
              console.log(
                "  GlobalState: Setting new wallet address:",
                walletData.address
              );
              setWalletAddress(walletData.address);
            }
          },
        });
      } catch (error) {
        console.error("   GlobalState: BLE initialization failed:", error);
        setBleInitialized(false);
      }
    };

    initBle();

    const handleAppStateChange = (nextAppState) => {
      appStateRef.current = nextAppState;
      if (nextAppState === "active") {
        console.log("    App is now active");
        if (backgroundTimerRef.current) {
          clearTimeout(backgroundTimerRef.current);
          backgroundTimerRef.current = null;
        }
        return;
      }

      // Schedules disconnect automatically ONLY if app remains in the background for a while
      if (backgroundTimerRef.current) {
        clearTimeout(backgroundTimerRef.current);
      }
      backgroundTimerRef.current = setTimeout(() => {
        if (appStateRef.current !== "active") {
          if (!authInProgress) {
            console.log(
              "    App stayed in background, disconnecting BLE to save power..."
            );
            BleService.disconnect();
          } else {
            console.log("⏸️ Skipping disconnect: authentication in progress");
          }
        }
      }, 8000);
    };

    const appStateSubscription = AppState.addEventListener(
      "change",
      handleAppStateChange
    );

    return () => {
      if (backgroundTimerRef.current) {
        clearTimeout(backgroundTimerRef.current);
      }
      appStateSubscription.remove();
    };
  }, [
    scanForBleDevices,
    fetchWalletData,
    showToast,
    vibration,
    setWalletAddress,
    authInProgress,
  ]);

  // Selects wallet and updates global state
  const selectWalletAndUpdateState = useCallback(
    async (walletIndex, walletAddress) => {
      try {
        console.log("    GlobalState: Selecting wallet at index:", walletIndex);
        console.log("    GlobalState: Wallet address:", walletAddress);

        await BleService.selectWallet(walletIndex);
        setWalletAddress(walletAddress);
        await fetchWalletData();

        console.log(
          "  GlobalState: Wallet selected and state updated successfully"
        );
      } catch (error) {
        console.error("   GlobalState: Failed to select wallet:", error);
        throw error;
      }
    },
    [setWalletAddress, fetchWalletData]
  );

  const value = {
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
    walletActivated,
    setWalletActivated,
    activationSetupCompleted,
    setActivationSetupCompleted,
    showLetterGrid,
    setShowLetterGrid,
    showWalletCreationFlow,
    setShowWalletCreationFlow,
    walletCreated,
    setWalletCreated,
    walletAddress,
    setWalletAddress,
    walletBalance,
    setWalletBalance,
    deviceConnected,
    setDeviceConnected,
    selectedDevice,
    setSelectedDevice,
    isRealBleConnected,
    setIsRealBleConnected,
    isAuthenticated,
    setIsAuthenticated,
    bleInitialized,
    blePermissionsGranted,
    devices,
    setDevices,
    isScanning,
    setIsScanning,
    scanForBleDevices,
    connectToBleDevice,
    disconnectBleDevice,
    disconnectAndClearWallet,
    fetchWalletData,
    selectWalletAndUpdateState,
    deviceSetupCompleted,
    setDeviceSetupCompleted,
    showDisconnectionModal,
    setShowDisconnectionModal,
    gestureSaved,
    setGestureSaved,
    showDeviceModal,
    setShowDeviceModal,
    // Sui-related states and wallet data 💃💃💃
    balance,
    allBalances,
    txHistory,
    amount,
    setAmount,
    recipient,
    setRecipient,
    currentTransaction,
    setCurrentTransaction,
    authInProgress,
    setAuthInProgress,
    prepareTransaction,
    // Auth/Signing
    authChallenge,
    authMorseInput,
    transactionSigning,
    startAuthentication,
    completeAuthentication,
    signTransactionWithBle,
    startReAuthentication,
    // Settings states
    bleEnabled,
    setBleEnabled,
    selectedCalibration,
    setSelectedCalibration,
    noiseFloor,
    setNoiseFloor,
    dotPressure,
    setDotPressure,
    dashPressure,
    setDashPressure,

    emergencyCode,
    setEmergencyCode,
    // feedback prefs (persisted later if needed)
    vibration,
    setVibration,
    // Password management
    devicePassword,
    setDevicePassword,
    isPasswordChanged,
    setIsPasswordChanged,
    saveDevicePassword,
    saveFeedbackSettings,
    // toasts (not sure if I'm gonna implement it yet, but let's see)
    toastMessage,
    toastVisible,
    showToast,
  };

  return (
    <GlobalStateContext.Provider value={value}>
      {children}
    </GlobalStateContext.Provider>
  );
};

export const useGlobalState = () => {
  const context = useContext(GlobalStateContext);
  if (!context) {
    throw new Error("useGlobalState must be used within a GlobalStateProvider");
  }
  return context;
};
export default GlobalStateContext;

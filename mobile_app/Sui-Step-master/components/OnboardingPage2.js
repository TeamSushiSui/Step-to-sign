import BluetoothImg from "@/assets/images/OnboardingPageBluetoothMain.png";
import Colors from "@/constants/Colors";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useGlobalState } from "../contexts/GlobalStateProvider";
import { useOnboardingContext } from "../contexts/OnboardingContext";
import BleService from "../services/BleService";
import SuiService from "../services/SuiService";
import CustomAlert from "./CustomAlert";
import { PageIndicator } from "./PageIndicator";

export const OnboardingPage2 = () => {
  let currentPage = 1;
  try {
    const context = useOnboardingContext();
    currentPage = context.currentPage;
  } catch (_error) {
    console.log(
      "OnboardingContext not available, using fallback currentPage = 1"
    );
  }

  const {
    deviceConnected,
    selectedDevice,
    bleInitialized,
    blePermissionsGranted,
    isRealBleConnected,
    scanForBleDevices,
    connectToBleDevice,
    disconnectBleDevice,
    setDeviceSetupCompleted,
    isScanning,
    devices,
    setWalletAddress,
    setWalletBalance,
    showDeviceModal,
    setShowDeviceModal,
  } = useGlobalState();

  const [showBluetoothPrompt, setShowBluetoothPrompt] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pin, setPin] = useState("");
  const [pinAttempts, setPinAttempts] = useState(0);
  const [pinError, setPinError] = useState("");
  const [isPinValidating, setIsPinValidating] = useState(false);
  const [selectedDeviceForPin, setSelectedDeviceForPin] = useState(null);
  const [showDeviceConnectedAlert, setShowDeviceConnectedAlert] =
    useState(false);
  const [walletList, setWalletList] = useState([]);
  const [showWalletListModal, setShowWalletListModal] = useState(false);
  const [isFetchingWallets, setIsFetchingWallets] = useState(false);
  const [isCreatingWallet, setIsCreatingWallet] = useState(false);

  useEffect(() => {
    console.log(
      "    OnboardingPage2: Checking Bluetooth status from global state..."
    );
    if (!blePermissionsGranted) {
      console.log(
        "   OnboardingPage2: Bluetooth permissions not granted, prompting user"
      );
      Alert.alert(
        "Permissions Required",
        "Bluetooth permissions are required to connect to your SuiStep device. Please enable them in settings.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Settings", onPress: () => Linking.openSettings() },
        ]
      );
    } else if (!bleInitialized) {
      console.log(
        "   OnboardingPage2: Bluetooth is not powered on, prompting user"
      );
      setShowBluetoothPrompt(true);
    } else {
      console.log("✅ OnboardingPage2: Bluetooth is ready for scanning.");
    }
  }, [bleInitialized, blePermissionsGranted]);

  const handleEnableBluetooth = () => {
    setShowBluetoothPrompt(false);
    if (Platform.OS === "android") {
      Alert.alert(
        "Enable Bluetooth",
        "Please enable Bluetooth in your device settings to continue.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Settings", onPress: () => Linking.openSettings() },
        ]
      );
    } else {
      Alert.alert(
        "Enable Bluetooth",
        "Please enable Bluetooth in Settings > Bluetooth to continue.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Settings", onPress: () => Linking.openSettings() },
        ]
      );
    }
  };

  const startDeviceScan = async () => {
    try {
      console.log("    OnboardingPage2: Starting device scan...");

      if (!bleInitialized || !blePermissionsGranted) {
        console.log("   OnboardingPage2: Bluetooth not ready for scanning");
        if (!blePermissionsGranted) {
          Alert.alert(
            "Permissions Required",
            "Bluetooth permissions are required to connect to your SuiStep device. Please enable them in settings.",
            [
              { text: "Cancel", style: "cancel" },
              { text: "Settings", onPress: () => Linking.openSettings() },
            ]
          );
        } else {
          setShowBluetoothPrompt(true);
        }
        return;
      }

      setShowDeviceModal(true);
      await scanForBleDevices();

      console.log("✅ OnboardingPage2: Device scan started");
    } catch (error) {
      console.error("   OnboardingPage2: Device scan failed:", error);
      Alert.alert(
        "Scan Error",
        "Failed to scan for devices. Please check your Bluetooth connection."
      );
    }
  };

  const stopDeviceScan = () => {
    console.log("    OnboardingPage2: Stopping device scan...");
    try {
      BleService.stopScan();
    } catch (e) {
      console.log("   OnboardingPage2: stopScan warning", e?.message);
    }
  };

  const checkDeviceCompatibility = async (device) => {
    try {
      proceedWithConnection(device);
    } catch (error) {
      console.error("   OnboardingPage2: Compatibility prep failed:", error);
      Alert.alert("Connection Error", "Failed to prepare device connection.");
    }
  };

  const proceedWithConnection = (device) => {
    setSelectedDeviceForPin(device);
    setShowPinModal(true);
  };

  const cancelPinEntry = async () => {
    try {
      setShowPinModal(false);
      await disconnectBleDevice();
    } catch (_) {}
  };

  const handleDeviceConnection = async (device) => {
    try {
      console.log(
        "    OnboardingPage2: Attempting to connect to device:",
        device.name
      );

      stopDeviceScan();
      setShowDeviceModal(false);

      await checkDeviceCompatibility(device);
    } catch (error) {
      console.error("   OnboardingPage2: Device connection failed:", error);
      Alert.alert(
        "Connection Error",
        `Failed to connect to ${device.name}. Please ensure the device is powered on and nearby, then try again.`
      );
    }
  };

  const validateFactoryPin = async () => {
    if (pin.length !== 4) {
      setPinError("PIN must be 4 digits");
      return;
    }

    setIsPinValidating(true);
    setPinError("");

    try {
      console.log("OnboardingPage2: Validating factory PIN with Arduino...");

      try {
        await connectToBleDevice(selectedDeviceForPin.id);
      } catch (_connErr) {
        setPinError("Failed to connect to device. Please try again.");
        setIsPinValidating(false);
        return;
      }

      // Set up one-time callback for authentication result BEFORE sending command
      const authPromise = new Promise((resolve) => {
        const originalCallback = BleService.callbacks.onAuthenticationResult;
        BleService.callbacks.onAuthenticationResult = (result) => {
          // Restore original and forward result to global handler
          BleService.callbacks.onAuthenticationResult = originalCallback;
          try {
            if (typeof originalCallback === "function") {
              originalCallback(result);
            }
          } catch (_) {}
          resolve(result);
        };
      });

      // Send authentication command to Arduino
      await BleService.authenticate(pin);

      // Wait for Arduino response
      const authResult = await Promise.race([
        authPromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Authentication timeout")), 10000)
        ),
      ]);

      if (authResult.success) {
        console.log("✅ OnboardingPage2: Arduino authentication successful");
        setShowPinModal(false);
        setPin("");
        setPinAttempts(0);

        // Small delay to ensure notifications are properly set up
        await new Promise((r) => setTimeout(r, 150));

        // Request wallet list from Arduino
        await requestWalletListFromArduino();
      } else {
        console.log("   OnboardingPage2: Arduino authentication failed");
        handlePinError();
        try {
          await disconnectBleDevice();
        } catch (_) {}
      }
    } catch (error) {
      console.error(
        "   OnboardingPage2: Arduino PIN validation failed:",
        error
      );
      setPinError("Arduino authentication failed. Please try again.");
      try {
        await disconnectBleDevice();
      } catch (_) {}
    } finally {
      setIsPinValidating(false);
    }
  };

  const handlePinError = () => {
    setPinAttempts((prev) => prev + 1);
    if (pinAttempts >= 2) {
      setPinError("Maximum attempts reached. Device locked for 5 minutes.");
      setShowPinModal(false);
      setPin("");
      setPinAttempts(0);
    } else {
      setPinError(`Invalid PIN. ${3 - pinAttempts - 1} attempts remaining.`);
    }
  };

  // Remove simulated PIN validation and unused helpers

  // Request real wallet list from Arduino
  const requestWalletListFromArduino = async () => {
    try {
      console.log(
        "    OnboardingPage2: Requesting wallet list from Arduino..."
      );
      setIsFetchingWallets(true);

      const walletsPromise = new Promise((resolve) => {
        const original = BleService.callbacks.onWalletListReceived;
        BleService.callbacks.onWalletListReceived = (wallets) => {
          BleService.callbacks.onWalletListReceived = original;
          // Forward to global state handler if it exists
          try {
            if (typeof original === "function") {
              original(wallets);
            }
          } catch (error) {
            console.log(
              "   OnboardingPage2: Global wallet list callback error:",
              error?.message
            );
          }
          resolve(wallets || []);
        };
      });

      await BleService.listWallets();
      const wallets = await Promise.race([
        walletsPromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Wallet list timeout")), 20000)
        ),
      ]);

      // Enrich with real data from Sui SDK by address
      const addresses = (wallets || [])
        .map((w) => {
          const addr = w.address || w.public_key;
          // Ensure address has 0x prefix
          return addr && !addr.startsWith("0x") ? `0x${addr}` : addr;
        })
        .filter(Boolean);

      let enriched = [];
      try {
        const sui = SuiService.getInstance();
        // Ensure we start from testnet as requested
        sui.setNetwork("testnet");

        // Test connection first
        const connectionOk = await sui.testConnection();
        if (!connectionOk) {
          throw new Error("Sui network connection failed");
        }

        console.log("🔍 OnboardingPage2: Testing wallet addresses:", addresses);
        enriched = await sui.getMultipleWalletInfoByAddresses(addresses);
      } catch (e) {
        console.log(
          "   OnboardingPage2: Failed to enrich addresses:",
          e?.message || e
        );
        enriched = (addresses || []).map((addr, idx) => ({
          id: idx,
          index: idx,
          address: addr,
          balance: 0,
          coinCount: 0,
          objectCount: 0,
          recentTransactions: [],
          network: "testnet",
          error: e?.message || "Failed to fetch wallet data",
        }));
      }

      const normalized = (enriched || []).map((w, idx) => ({
        id: w.index ?? idx,
        index: w.index ?? idx,
        address: w.address,
        balance: w.balance || 0,
        coinCount: w.coinCount || 0,
        objectCount: w.objectCount || 0,
        recentTransactions: w.recentTransactions || [],
        isActive: idx === 0,
        network: w.network,
      }));

      setWalletList(normalized);

      // Also set global currently selected wallet address and balance to first wallet
      try {
        if (normalized.length > 0) {
          const first = normalized[0];
          if (first?.address) {
            // Set in global state via useGlobalState
            setWalletAddress(first.address);
            setWalletBalance(first.balance || 0);
          }
        }
      } catch (_) {}

      if ((normalized || []).length === 0) {
        // New device, no wallets - show wallet list modal with create option
        setShowWalletListModal(true);
        setDeviceSetupCompleted(true);
      } else {
        // Existing device with wallets - show wallet selection
        setShowWalletListModal(true);
      }
    } catch (error) {
      console.error("   OnboardingPage2: Failed to get wallet list:", error);
      // Fallback: show wallet list modal with create option
      setShowWalletListModal(true);
      setDeviceSetupCompleted(true);
    } finally {
      setIsFetchingWallets(false);
    }
  };

  const selectWallet = (wallet) => {
    console.log("✅ OnboardingPage2: Wallet selected:", wallet.address);
    try {
      BleService.selectWallet(wallet.id);
    } catch (_) {}
    setShowWalletListModal(false);
    setShowDeviceConnectedAlert(true);
    setDeviceSetupCompleted(true);
  };

  const createNewWallet = async () => {
    setIsCreatingWallet(true);
    try {
      console.log("    OnboardingPage2: Creating new wallet on device...");

      const newWallet = await BleService.createWallet();

      console.log(
        "✅ OnboardingPage2: Wallet created successfully:",
        newWallet
      );

      // Close the wallet list modal and refresh the list
      setShowWalletListModal(false);
      await new Promise((resolve) => setTimeout(resolve, 500)); // Small delay

      // Refresh wallet list
      await requestWalletListFromArduino();
    } catch (error) {
      console.error("   OnboardingPage2: Wallet creation failed:", error);
      Alert.alert(
        "Wallet Creation Error",
        "Failed to create wallet on device. Please try again."
      );
    } finally {
      setIsCreatingWallet(false);
    }
  };

  const renderDevice = ({ item }) => (
    <TouchableOpacity
      style={[styles.deviceItem, item.connected && styles.deviceItemConnected]}
      onPress={() => handleDeviceConnection(item)}
      disabled={item.connected || isScanning}
    >
      <View style={styles.deviceInfo}>
        <Text style={styles.deviceName}>{item.name}</Text>
        <Text style={styles.deviceRssi}>Signal: {item.rssi} dBm</Text>
        {item.isArduinoDevice && (
          <Text style={styles.deviceType}>Arduino Device</Text>
        )}
      </View>
      <View style={styles.deviceStatus}>
        {item.connected ? (
          <MaterialIcons name="check-circle" size={24} color="#4CAF50" />
        ) : (
          <MaterialIcons
            name="bluetooth"
            size={24}
            color={Colors.thickOrange}
          />
        )}
      </View>
    </TouchableOpacity>
  );

  const renderWallet = ({ item }) => (
    <TouchableOpacity
      style={[styles.walletItem, item.isActive && styles.walletItemActive]}
      onPress={() => selectWallet(item)}
    >
      <View style={styles.walletInfo}>
        <Text style={styles.walletAddress}>
          {item.address?.length > 18
            ? `${item.address.slice(0, 8)}...${item.address.slice(-8)}`
            : item.address}
        </Text>
        <Text style={styles.walletBalance}>{item.balance} SUI</Text>
      </View>
      <View style={styles.walletStatus}>
        {item.isActive ? (
          <MaterialIcons name="star" size={20} color={Colors.thickOrange} />
        ) : (
          <MaterialIcons
            name="radio-button-unchecked"
            size={20}
            color={Colors.gray}
          />
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Image source={BluetoothImg} style={styles.image} />

        <Text style={styles.title}>Connect Your Device</Text>
        <Text style={styles.subtitle}>
          Connect your SuiStep in-shoe device to enable secure wallet management
          and transaction signing.
        </Text>

        <View style={styles.featuresContainer}>
          <View style={styles.featureItem}>
            <MaterialIcons
              name="security"
              size={20}
              color={Colors.thickOrange}
            />
            <Text style={styles.featureText}>Factory PIN Authentication</Text>
          </View>
          <View style={styles.featureItem}>
            <MaterialIcons
              name="fingerprint"
              size={20}
              color={Colors.thickOrange}
            />
            <Text style={styles.featureText}>Morse Code Verification</Text>
          </View>
          <View style={styles.featureItem}>
            <MaterialIcons
              name="offline-bolt"
              size={20}
              color={Colors.thickOrange}
            />
            <Text style={styles.featureText}>Offline Transaction Signing</Text>
          </View>
        </View>

        {/* Real BLE Connection Button */}
        <TouchableOpacity
          style={[
            styles.connectButton,
            isScanning && styles.connectButtonScanning,
            deviceConnected && styles.connectButtonConnected,
          ]}
          onPress={startDeviceScan}
          disabled={isScanning || deviceConnected || isRealBleConnected}
        >
          <MaterialIcons
            name={deviceConnected ? "check-circle" : "bluetooth"}
            size={20}
            color={Colors.white}
          />
          <Text style={styles.connectButtonText}>
            {isScanning
              ? "Scanning..."
              : deviceConnected
              ? "Device Connected"
              : "Connect Device"}
          </Text>
        </TouchableOpacity>

        {deviceConnected && selectedDevice && (
          <View style={styles.connectedStatus}>
            <MaterialIcons name="check-circle" size={20} color="#4CAF50" />
            <Text style={styles.connectedText}>
              Connected to {selectedDevice.name}
            </Text>
          </View>
        )}
        {!deviceConnected && isRealBleConnected && selectedDevice && (
          <View style={styles.connectedStatus}>
            <MaterialIcons name="info" size={20} color={Colors.thickOrange} />
            <Text style={styles.connectedText}>
              Enter PIN to complete connection to {selectedDevice.name}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.indicatorContainer}>
        <PageIndicator totalPages={3} currentPage={currentPage} />
      </View>

      {/* Bluetooth Enable Prompt */}
      <CustomAlert
        visible={showBluetoothPrompt}
        title="Enable Bluetooth"
        message="SuiStep requires Bluetooth to connect to your smart shoe device. Please enable Bluetooth to continue."
        buttons={[
          { text: "Cancel", onPress: () => setShowBluetoothPrompt(false) },
          { text: "Enable", onPress: handleEnableBluetooth },
        ]}
        onRequestClose={() => setShowBluetoothPrompt(false)}
      />

      {/* Device Selection Modal */}
      <Modal
        visible={showDeviceModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          stopDeviceScan();
          setShowDeviceModal(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select SuiStep Device</Text>
              <TouchableOpacity
                onPress={() => {
                  stopDeviceScan();
                  setShowDeviceModal(false);
                }}
                style={styles.modalCloseButton}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {isScanning ? (
              <View style={styles.scanningContainer}>
                <View style={styles.scanningSpinner} />
                <Text style={styles.scanningText}>
                  Scanning for SuiStep devices...
                </Text>
                <TouchableOpacity
                  style={styles.stopScanButton}
                  onPress={stopDeviceScan}
                >
                  <Text style={styles.stopScanText}>Stop Scan</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {(devices || []).length === 0 ? (
                  <View style={styles.noDevicesContainer}>
                    <Text style={styles.noDevicesText}>
                      No SuiStep devices found
                    </Text>
                    <Text style={styles.noDevicesSubtext}>
                      Make sure your device is powered on and nearby
                    </Text>
                    <TouchableOpacity
                      style={styles.rescanButton}
                      onPress={startDeviceScan}
                    >
                      <Text style={styles.rescanButtonText}>Scan Again</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <FlatList
                    data={devices || []}
                    renderItem={renderDevice}
                    keyExtractor={(item) => item.id}
                    style={styles.deviceList}
                  />
                )}
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Factory PIN Modal */}
      <Modal
        visible={showPinModal}
        animationType="slide"
        transparent={true}
        onRequestClose={cancelPinEntry}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Enter Factory PIN</Text>
              <TouchableOpacity
                onPress={cancelPinEntry}
                style={styles.modalCloseButton}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.pinInstructions}>
              Enter the 4-digit factory PIN provided with your SuiStep device
            </Text>

            <TextInput
              style={[styles.pinInput, pinError && styles.pinInputError]}
              value={pin}
              onChangeText={(text) => {
                setPin(text.replace(/[^0-9]/g, "").slice(0, 4));
                setPinError("");
              }}
              placeholder="0000"
              placeholderTextColor={Colors.gray}
              keyboardType="numeric"
              maxLength={4}
              secureTextEntry={true}
              autoFocus={true}
            />

            {pinError ? <Text style={styles.pinError}>{pinError}</Text> : null}

            <TouchableOpacity
              style={[
                styles.validatePinButton,
                (pin.length !== 4 || isPinValidating) &&
                  styles.validatePinButtonDisabled,
              ]}
              onPress={validateFactoryPin}
              disabled={pin.length !== 4 || isPinValidating}
            >
              <Text style={styles.validatePinButtonText}>
                {isPinValidating ? "Validating..." : "Connect"}
              </Text>
            </TouchableOpacity>

            <Text style={styles.pinAttempts}>
              Attempts remaining: {3 - pinAttempts}
            </Text>
          </View>
        </View>
      </Modal>

      {/* Wallet List Modal */}
      <Modal
        visible={showWalletListModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowWalletListModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Wallet</Text>
              <TouchableOpacity
                onPress={() => setShowWalletListModal(false)}
                style={styles.modalCloseButton}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {isFetchingWallets ? (
              <View style={styles.scanningContainer}>
                <View style={styles.scanningSpinner} />
                <Text style={styles.scanningText}>Fetching wallets…</Text>
              </View>
            ) : walletList.length === 0 ? (
              <View style={styles.scanningContainer}>
                <Ionicons name="wallet-outline" size={50} color={Colors.gray} />
                <Text style={styles.scanningText}>
                  No wallets found on device
                </Text>
                <Text style={styles.scanningSubtext}>
                  Create a new wallet on your device to get started
                </Text>
                <TouchableOpacity
                  style={[
                    styles.retryScanButton,
                    isCreatingWallet && styles.retryScanButtonDisabled,
                  ]}
                  onPress={createNewWallet}
                  disabled={isCreatingWallet}
                >
                  <Text style={styles.retryScanButtonText}>
                    {isCreatingWallet ? "Creating..." : "Create Wallet"}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={styles.walletInstructions}>
                  Select which wallet to use for this session
                </Text>

                <FlatList
                  data={walletList}
                  renderItem={renderWallet}
                  keyExtractor={(item) => item.id.toString()}
                  style={styles.walletList}
                />
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Device Connected Alert */}
      <CustomAlert
        visible={showDeviceConnectedAlert}
        title="Device Connected Successfully!"
        message={`Your ${selectedDevice?.name} is now connected and ready for wallet setup. You can now proceed to the next step.`}
        buttons={[
          {
            text: "Continue",
            onPress: () => setShowDeviceConnectedAlert(false),
          },
        ]}
        onRequestClose={() => setShowDeviceConnectedAlert(false)}
      />

      {/* Fetching Wallets Overlay */}
      <Modal
        visible={isFetchingWallets}
        animationType="fade"
        transparent={true}
        onRequestClose={() => {}}
      >
        <View style={styles.fetchOverlay}>
          <View style={styles.fetchCard}>
            <ActivityIndicator size="large" color={Colors.thickOrange} />
            <Text style={styles.fetchText}>Fetching wallets...</Text>
            <Text style={styles.fetchSubtext}>Please wait</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// Enhanced styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  image: {
    width: 200,
    height: 200,
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
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  featuresContainer: {
    width: "100%",
    marginBottom: 40,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  featureText: {
    fontSize: 16,
    color: Colors.white,
    marginLeft: 12,
  },
  connectButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.thickOrange,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  connectButtonScanning: {
    backgroundColor: Colors.gray,
    opacity: 0.7,
  },
  connectButtonConnected: {
    backgroundColor: "#4CAF50",
  },
  connectButtonText: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.white,
    marginLeft: 12,
  },
  connectedStatus: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(76, 175, 80, 0.1)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#4CAF50",
  },
  connectedText: {
    fontSize: 14,
    color: "#4CAF50",
    marginLeft: 8,
    fontWeight: "600",
  },
  fetchOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  fetchCard: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: "center",
    gap: 8,
    minWidth: 240,
  },
  fetchText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: "600",
    marginTop: 12,
  },
  fetchSubtext: {
    color: Colors.gray,
    fontSize: 12,
  },
  indicatorContainer: {
    paddingBottom: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    padding: 24,
    margin: 20,
    minWidth: 300,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    color: Colors.white,
    fontSize: 20,
    fontWeight: "bold",
  },
  modalCloseButton: {
    padding: 8,
  },
  modalCloseText: {
    color: Colors.gray,
    fontSize: 20,
    fontWeight: "bold",
  },
  scanningContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  scanningSpinner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: Colors.thickOrange,
    borderTopColor: "transparent",
    marginBottom: 16,
  },
  scanningText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 16,
  },
  scanningSubtext: {
    color: Colors.gray,
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
  },
  stopScanButton: {
    backgroundColor: Colors.gray,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  stopScanText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: "600",
  },
  noDevicesContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  noDevicesText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
  },
  noDevicesSubtext: {
    color: Colors.gray,
    fontSize: 14,
    textAlign: "center",
    marginBottom: 20,
  },
  rescanButton: {
    backgroundColor: Colors.thickOrange,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  rescanButtonText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: "600",
  },
  retryScanButton: {
    backgroundColor: Colors.thickOrange,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 16,
  },
  retryScanButtonText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: "600",
  },
  retryScanButtonDisabled: {
    opacity: 0.5,
  },
  deviceList: {
    maxHeight: 300,
  },
  deviceItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.lightGray,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  deviceItemConnected: {
    backgroundColor: "#4CAF50",
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  deviceRssi: {
    color: Colors.gray,
    fontSize: 14,
  },
  deviceType: {
    color: Colors.thickOrange,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  deviceStatus: {
    marginLeft: 12,
  },
  pinInstructions: {
    color: Colors.gray,
    fontSize: 14,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 20,
  },
  pinInput: {
    backgroundColor: Colors.lightGray,
    borderRadius: 8,
    padding: 16,
    fontSize: 24,
    color: Colors.white,
    textAlign: "center",
    letterSpacing: 8,
    marginBottom: 20,
    fontFamily: "monospace",
  },
  pinInputError: {
    borderWidth: 2,
    borderColor: "#FF6B6B",
  },
  pinError: {
    color: "#FF6B6B",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 16,
  },
  validatePinButton: {
    backgroundColor: Colors.thickOrange,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 16,
  },
  validatePinButtonDisabled: {
    backgroundColor: Colors.gray,
    opacity: 0.5,
  },
  validatePinButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.white,
  },
  pinAttempts: {
    color: Colors.gray,
    fontSize: 12,
    textAlign: "center",
  },
  walletInstructions: {
    color: Colors.gray,
    fontSize: 14,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 20,
  },
  walletList: {
    maxHeight: 300,
  },
  walletItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.lightGray,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  walletItemActive: {
    backgroundColor: Colors.thickOrange,
  },
  walletInfo: {
    flex: 1,
  },
  walletAddress: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  walletBalance: {
    color: Colors.gray,
    fontSize: 14,
  },
  walletStatus: {
    marginLeft: 12,
  },
});

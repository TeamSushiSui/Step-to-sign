// Custom Components/Constants
import CustomAlert from "@/components/CustomAlert";
import { ShoeIcon } from "@/components/ShoeIcon";
import Colors from "@/constants/Colors";
import BleService from "@/services/BleService";
import { fetchPrices as fetchTokenPrices, getDecimals as getTokenDecimals, coinTypeToCoingeckoId as mapCoinTypeToId } from "@/services/TokenPriceService";
import { truncateAddress } from "@/utils/addressUtils";
// Icons
import { useGlobalState } from "@/contexts/GlobalStateProvider";
import feedbackManager from "@/utils/feedbackUtils";
import Feather from "@expo/vector-icons/Feather";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Clipboard from "expo-clipboard";

import * as Network from "expo-network";
import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";

// Custom hook for persistent showBalance
function usePersistentShowBalance() {
  const [showBalance, setShowBalanceState] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load the saved value on mount
  useEffect(() => {
    loadShowBalance();
  }, []);

  const loadShowBalance = async () => {
    try {
      const savedValue = await SecureStore.getItemAsync('showBalance');
      setShowBalanceState(savedValue === 'true');
    } catch (error) {
      console.log('Error loading showBalance:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const setShowBalance = async (value) => {
    try {
      setShowBalanceState(value);
      await SecureStore.setItemAsync('showBalance', value.toString());
    } catch (error) {
      console.log('Error saving showBalance:', error);
    }
  };

  return { showBalance, setShowBalance, isLoading };
}

export default function HomeScreen() {
  const {
    deviceConnected,
    walletAddress,
    walletBalance,
    walletCreated,
    walletActivated,
    setDeviceConnected,
    vibration,
    showDeviceModal,
    setShowDeviceModal,
    isScanning,
    setIsScanning,
    devices,
    setDevices,
    emergencyCode,
    setEmergencyCode,
    isRealBleConnected,
    scanForBleDevices,
    connectToBleDevice,
    disconnectBleDevice,
    disconnectAndClearWallet,
    fetchWalletData,
    balance,
    allBalances,
    bleInitialized,
    blePermissionsGranted,
    setWalletAddress,
    setWalletBalance,
  } = useGlobalState();

  const { showBalance, setShowBalance, isLoading: balanceLoading } = usePersistentShowBalance();
  const [isConnected, setIsConnected] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Quick action states - Only for actions not in navigation
  const [showBuyAlert, setShowBuyAlert] = useState(false);

  // Emergency wipe states
  const [showEmergencyWipeModal, setShowEmergencyWipeModal] = useState(false);
  const [showEmergencySetupAlert, setShowEmergencySetupAlert] = useState(false);
  const [emergencyMorseInput, setEmergencyMorseInput] = useState("");
  const [showEmergencyConfirmAlert, setShowEmergencyConfirmAlert] = useState(false);

  // Auth and wallet selection states
  const [showPinModal, setShowPinModal] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [isPinValidating, setIsPinValidating] = useState(false);
  const [selectedDeviceForPin, setSelectedDeviceForPin] = useState(null);

  const [walletList, setWalletList] = useState([]);
  const [showWalletListModal, setShowWalletListModal] = useState(false);
  const [isFetchingWallets, setIsFetchingWallets] = useState(false);
  const [isCreatingWallet, setIsCreatingWallet] = useState(false);
  const [prices, setPrices] = useState({}); // coingeckoId -> usd price
  const [portfolioUsd, setPortfolioUsd] = useState(0);

  // Tokens derived from balances with decimals & mapped CoinGecko IDs
  const tokens = allBalances.map((b) => {
    const symbol = b.coinType.split("::")[1] || b.coinType;
    const decimals = getTokenDecimals(b.coinType);
    const amount = Number(b.totalBalance || 0) / Math.pow(10, decimals);
    const coingeckoId = mapCoinTypeToId(b.coinType);
    return {
      id: symbol,
      name: symbol,
      symbol,
      amount,
      coinType: b.coinType,
      coingeckoId,
    };
  });

  // Fetch prices and compute portfolio USD when tokens change
  useEffect(() => {
    const ids = Array.from(new Set(tokens.map((t) => t.coingeckoId).filter(Boolean)));
    if (ids.length === 0) {
      setPrices({});
      setPortfolioUsd(0);
      return;
    }
    (async () => {
      try {
        const priceMap = await fetchTokenPrices(ids);
        setPrices(priceMap);
        const total = tokens.reduce((sum, t) => sum + t.amount * (priceMap[t.coingeckoId] || 0), 0);
        setPortfolioUsd(total);
      } catch (e) {
        console.log("Price fetch failed:", e?.message || e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(tokens)]);

  useEffect(() => {
    console.log("Tokens:", tokens);
    console.log("Prices:", prices);
    console.log("Portfolio USD:", portfolioUsd);
  }, [tokens, prices, portfolioUsd]);

  // Using the imported truncateAddress function from utils/addressUtils

  // Check wallet states - Arduino device only
  const hasDevice = deviceConnected || isRealBleConnected;
  const hasWallet = walletCreated;
  const isActivated = walletActivated;
  const currentAddress = walletAddress;
  const currentBalance = walletBalance; // Already in SUI units from SuiService

  // Load emergency code on mount
  useEffect(() => {
    loadEmergencyCode();
  }, []);

  const loadEmergencyCode = async () => {
    try {
      const savedCode = await SecureStore.getItemAsync('emergencyWipeCode');
      if (savedCode) {
        setEmergencyCode(savedCode);
      }
    } catch (error) {
      console.log('Error loading emergency code:', error);
    }
  };

  // Emergency wipe functions
  const handleConnectLongPress = async () => {
    console.log("Connect button long pressed for 5 seconds");
    if (!deviceConnected && !isRealBleConnected) {
      setShowEmergencySetupAlert(true);
      return;
    }
    if (emergencyCode) {
      await feedbackManager.transaction();
      setShowEmergencyWipeModal(true);
    } else {
      setShowEmergencySetupAlert(true);
    }
  };

  const handleEmergencyMorseInput = (symbol) => {
    setEmergencyMorseInput(prev => prev + symbol);
  };

  const verifyEmergencyCode = async () => {
    if (emergencyMorseInput === emergencyCode) {
      setShowEmergencyWipeModal(false);
      setEmergencyMorseInput("");
      setShowEmergencyConfirmAlert(true);
    } else {
      await feedbackManager.error();
      setEmergencyMorseInput("");
    }
  };

  const executeEmergencyWipe = async () => {
    try {
      console.log("🚨 Executing emergency wipe...");

      // Clear all stored data
      await SecureStore.deleteItemAsync('emergencyWipeCode');
      await SecureStore.deleteItemAsync('showBalance');
      await SecureStore.deleteItemAsync('onboardingCompleted');

      // Send wipe command to ESP32 if connected
      if (isRealBleConnected) {
        const BleService = require('../../services/BleService').default;
        await BleService.sendEmergencyWipe();
      }

      // Reset all states
      setEmergencyCode("");
      setDeviceConnected(false);
      setShowEmergencyConfirmAlert(false);

      // Show success feedback
      await feedbackManager.warning();

      console.log("  Emergency wipe completed");

    } catch (error) {
      console.error("   Emergency wipe failed:", error);
    }
  };

  // Check internet connection
  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const checkConnection = async () => {
    try {
      const networkState = await Network.getNetworkStateAsync();
      setIsConnected(
        networkState.isConnected && networkState.isInternetReachable
      );
      setIsLoading(false);
    } catch (_error) {
      setIsConnected(false);
      setIsLoading(false);
    }
  };

  const handleRetry = () => {
    setIsLoading(true);
    checkConnection();
  };

  const handleDisconnect = async () => {
    try {
      await disconnectAndClearWallet();
    } catch (error) {
      console.error("Home: Disconnect failed:", error);
    }
  };

  // Pull to refresh
  const onRefresh = async () => {
    setRefreshing(true);

    try {
      // Refresh real data only if we have a wallet address
      if (walletAddress && deviceConnected) {
        await fetchWalletData();
      }
    } catch (error) {
      console.error("Refresh failed:", error);
    } finally {
      setRefreshing(false);
    }
  };

  // Quick Action Handlers - Only non-navigation actions
  const handleBuy = () => {
    setShowBuyAlert(true);
  };

  // Real BLE Device Scanning
  const startDeviceScan = async () => {
    try {
      if (!bleInitialized) {
        console.log("BLE not initialized - showing Bluetooth prompt");
        Alert.alert(
          "Bluetooth Required",
          "Please enable Bluetooth to scan for SuiStep devices.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Settings", onPress: () => Linking.openSettings() },
          ]
        );
        return;
      }

      if (!blePermissionsGranted) {
        console.log("   BLE permissions not granted - showing permissions prompt");
        Alert.alert(
          "Permissions Required",
          "Bluetooth permissions are required to connect to your SuiStep device. Please enable them in settings.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Settings", onPress: () => Linking.openSettings() },
          ]
        );
        return;
      }

      console.log("Starting device scan...");
      setShowDeviceModal(true);
      setDevices([]);
      setIsScanning(true);

      // Use real BLE scan (this will only scan for devices, not fetch wallet data)
      await scanForBleDevices();
    } catch (error) {
      console.error("Device scan failed:", error);
      setIsScanning(false);
    }
  };

  const connectToDevice = async (deviceId) => {
    try {
      const deviceToConnect = devices.find((d) => d.id === deviceId);
      if (!deviceToConnect) {
        console.error("   Device not found for connection:", deviceId);
        return;
      }

      console.log("Preparing authentication for device:", deviceToConnect.name);

      // Close the device modal and stop scanning
      setShowDeviceModal(false);
      setIsScanning(false);
      try { BleService.stopScan(); } catch (_) { }

      setSelectedDeviceForPin(deviceToConnect);
      setShowPinModal(true);
    } catch (error) {
      console.error("Device connection prep failed:", error);
      await feedbackManager.error();
    }
  };

  const cancelPinEntry = async () => {
    try {
      setShowPinModal(false);
      setPin("");
      setPinError("");
      await disconnectBleDevice();
    } catch (_) { }
  };

  const requestWalletListFromDevice = async () => {
    try {
      console.log("Home: Requesting wallet list from device...");
      setIsFetchingWallets(true);

      const walletsPromise = new Promise((resolve) => {
        const original = BleService.callbacks.onWalletListReceived;
        BleService.callbacks.onWalletListReceived = (wallets) => {
          BleService.callbacks.onWalletListReceived = original;
          try {
            if (typeof original === "function") {
              original(wallets);
            }
          } catch (_) { }
          resolve(wallets || []);
        };
      });

      try {
        BleService.listWallets();
      } catch (_e) {
        // ignore fire-and-forget errors; we'll rely on callback/timeout
      }
      const wallets = await Promise.race([
        walletsPromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Wallet list timeout")), 20000)
        ),
      ]);

      // Normalize
      const normalized = (wallets || []).map((w, idx) => {
        const addr = w.address || w.public_key;
        // Ensure address has 0x prefix
        const formattedAddress = addr && !addr.startsWith('0x') ? `0x${addr}` : addr;
        return {
          id: w.index ?? idx,
          index: w.index ?? idx,
          address: formattedAddress,
          isActive: idx === 0,
        };
      }).filter(w => !!w.address);

      setWalletList(normalized);
      setShowWalletListModal(true);
    } catch (error) {
      console.error("Home: Failed to get wallet list:", error);
      setShowWalletListModal(false);
    } finally {
      setIsFetchingWallets(false);
    }
  };

  const validatePinAndAuthenticate = async () => {
    if (pin.length !== 4) {
      setPinError("PIN must be 4 digits");
      return;
    }

    setIsPinValidating(true);
    setPinError("");

    try {
      console.log("Home: Connecting to device for auth...");
      try {
        await connectToBleDevice(selectedDeviceForPin.id);
      } catch (_connErr) {
        setPinError("Failed to connect to device. Please try again.");
        setIsPinValidating(false);
        return;
      }

      const authPromise = new Promise((resolve) => {
        const originalCallback = BleService.callbacks.onAuthenticationResult;
        BleService.callbacks.onAuthenticationResult = (result) => {
          BleService.callbacks.onAuthenticationResult = originalCallback;
          try {
            if (typeof originalCallback === "function") {
              originalCallback(result);
            }
          } catch (_) { }
          resolve(result);
        };
      });

      await BleService.authenticate(pin);

      const authResult = await Promise.race([
        authPromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Authentication timeout")), 10000)
        ),
      ]);

      if (authResult?.success) {
        console.log("  Home: Authentication successful");
        setShowPinModal(false);
        setPin("");

        // Provide feedback for successful authentication
        await feedbackManager.authentication();

        await new Promise((r) => setTimeout(r, 150));
        await requestWalletListFromDevice();
      } else {
        console.log("   Home: Authentication failed");
        setPinError("Invalid PIN. Please try again.");

        // Provide feedback for authentication failure
        await feedbackManager.error();

        try { await disconnectBleDevice(); } catch (_) { }
      }
    } catch (error) {
      console.error("   Home: PIN validation failed:", error);
      setPinError("Authentication failed. Please try again.");
      try { await disconnectBleDevice(); } catch (_) { }
    } finally {
      setIsPinValidating(false);
    }
  };

  const selectWallet = async (wallet) => {
    try {
      console.log("  Home: Wallet selected:", wallet.address);
      setShowWalletListModal(false);
      setWalletAddress(wallet.address);
      setWalletBalance(0);
      await fetchWalletData();

      // Provide feedback for wallet selection
      await feedbackManager.success();
    } catch (error) {
      console.error("   Home: Failed to select wallet:", error);
      await feedbackManager.error();
    }
  };

  const createNewWallet = async () => {
    setIsCreatingWallet(true);
    try {
      console.log("Home: Creating new wallet on device...");

      const newWallet = await BleService.createWallet();

      console.log("  Home: Wallet created successfully:", newWallet);

      // Close the wallet list modal and refresh the list
      setShowWalletListModal(false);
      await new Promise(resolve => setTimeout(resolve, 500)); // Small delay

      // Refresh wallet list
      await requestWalletListFromDevice();

      // Provide feedback for successful wallet creation
      await feedbackManager.success();
    } catch (error) {
      console.error("   Home: Wallet creation failed:", error);
      Alert.alert(
        "Wallet Creation Error",
        "Failed to create wallet on device. Please try again."
      );
    } finally {
      setIsCreatingWallet(false);
    }
  };

  // Show loading state
  if (isLoading || balanceLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <View style={styles.loadingCard}>
            <View style={styles.loadingSpinner} />
            <Text style={styles.loadingText}>Loading portfolio...</Text>
          </View>
        </View>
      </View>
    );
  }

  // Show error state when no internet
  if (!isConnected) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <ShoeIcon size={40} />
            <Text style={styles.headerText}>SuiStep</Text>
          </View>
        </View>

        <View style={styles.errorContainer}>
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Network Error</Text>
            <Text style={styles.errorSubtitle}>
              Unable to connect to the network. Please check your internet connection and try again.
            </Text>

            <View style={styles.warningIconContainer}>
              <Ionicons
                name="warning-sharp"
                size={50}
                color={Colors.thickOrange}
              />
            </View>

            <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
              <Text style={styles.retryButtonText}>Try again</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <ShoeIcon size={40} />
          <Text style={styles.headerText}>SuiStep</Text>
        </View>
        <View style={styles.headerRight}>
          <View
            style={[
              styles.statusIndicator,
              deviceConnected ? styles.connected : styles.disconnected,
            ]}
          >
            <MaterialIcons
              name={deviceConnected ? "bluetooth" : "bluetooth-disabled"}
              size={16}
              color={Colors.white}
            />
            <Text style={styles.statusText}>
              {deviceConnected ? "Connected" : "Disconnected"}
            </Text>
          </View>
        </View>
      </View>

      {/* Main Content */}
      <ScrollView
        style={styles.mainContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.thickOrange}
            colors={[Colors.thickOrange]}
          />
        }
      >
        {/* Wallet Address Section */}
        <View style={styles.card}>
          {currentAddress ? (
            <View style={styles.walletAddressContainer}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Wallet Address</Text>
                <TouchableOpacity
                  style={styles.copyButton}
                  onPress={() => {
                    Clipboard.setStringAsync(currentAddress);
                  }}
                >
                  <MaterialIcons
                    name="content-copy"
                    size={16}
                    color={Colors.thickOrange}
                  />
                  <Text style={styles.copyButtonText}>Copy</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.addressText}>
                {truncateAddress(currentAddress)}
              </Text>
            </View>
          ) : (
            <View style={styles.emptyStateContainer}>
              <Ionicons
                name="wallet"
                size={50}
                color={Colors.thickOrange}
              />
              <Text style={styles.emptyStateTitle}>No Wallet Connected</Text>
              <Text style={styles.emptyStateSubtitle}>Connect your SuiStep device to access your wallet</Text>
            </View>
          )
          }
        </View>

        {/* Balance Section */}
        <View style={styles.card}>
          {!deviceConnected ? (
            <View style={styles.emptyStateContainer}>
              <Ionicons
                name="hardware-chip"
                size={50}
                color={Colors.thickOrange}
              />
              <Text style={styles.emptyStateTitle}>
                {!hasDevice ? "No Device Connected" :
                  !hasWallet ? "No Wallet Created" :
                    !isActivated ? "Wallet Not Activated" : "No Wallet Connected"}
              </Text>
              <Text style={styles.emptyStateSubtitle}>
                {!hasDevice ? "Connect your SuiStep device to access your wallet" :
                  !hasWallet ? "Create a wallet on your connected device to get started" :
                    !isActivated ? "Activate your wallet using Morse code to access your funds" :
                      "Connect your SuiStep device to access your wallet"}
              </Text>
            </View>
          ) : (
            <View style={styles.balanceContainer}>
              <View style={styles.balanceHeader}>
                <Text style={styles.balanceLabel}>Wallet Balance</Text>
                <TouchableOpacity onPress={() => setShowBalance(!showBalance)}>
                  <Feather
                    name={showBalance ? "eye-off" : "eye"}
                    size={20}
                    color={Colors.thickOrange}
                  />
                </TouchableOpacity>
              </View>
              <Text style={styles.balanceAmount}>
                {showBalance ? `$${portfolioUsd.toFixed(2)}` : "******"}
              </Text>
              <Text style={styles.balanceSubtitle}>
                {showBalance ? `${truncateAddress(currentAddress)}` : "******"}
              </Text>
            </View>
          )}

          {/* Portfolio Coins - Real Data */}
          {deviceConnected && tokens.length > 0 && (
            <View style={styles.portfolioSection}>
              <Text style={styles.portfolioTitle}>Portfolio</Text>
              {tokens.map((t) => {
                const price = prices[t.coingeckoId] || 0;
                const usdValue = t.amount * price;
                return (
                  <View key={t.coinType} style={styles.coinItem}>
                    <View style={styles.coinInfo}>
                      <Text style={styles.coinName}>{t.name}</Text>
                      <Text style={styles.coinSymbol}>{t.symbol}</Text>
                    </View>
                    <View style={styles.coinBalance}>
                      <Text style={styles.coinBalanceText}>
                        {showBalance ? `${t.amount.toFixed(4)} ${t.symbol}` : "******"}
                      </Text>
                      <Text style={styles.coinPrice}>
                        {showBalance ? `$${usdValue.toFixed(2)}${price ? ` ($${price.toFixed(4)} ea)` : ''}` : "******"}
                      </Text>
                    </View>
                    <View style={styles.coinChange}>
                      <Text style={[styles.coinChangeText, { color: '#4CAF50' }]}>
                        {/* optional change */}
                      </Text>
                    </View>
                  </View>
                )
              })}
            </View>
          )}

          {/* Quick Actions - Always Visible */}
          <View style={styles.quickActionsContainer}>
            {deviceConnected ? (
              <Pressable
                style={styles.quickActionButton}
                onPress={handleDisconnect}
                onLongPress={handleConnectLongPress}
                delayLongPress={5000}
              >
                <FontAwesome5
                  name="bluetooth-b"
                  size={24}
                  color={Colors.white}
                />
                <Text style={styles.quickActionText}>Disconnect</Text>
                {emergencyCode && (
                  <View style={styles.emergencyIndicator}>
                    <Text style={styles.emergencyIndicatorText}>  </Text>
                  </View>
                )}
              </Pressable>
            ) : (
              <Pressable
                style={styles.quickActionButton}
                onPress={startDeviceScan}
                onLongPress={handleConnectLongPress}
                delayLongPress={5000}
              >
                <FontAwesome5
                  name="bluetooth"
                  size={24}
                  color={Colors.white}
                />
                <Text style={styles.quickActionText}>Connect</Text>
                {emergencyCode && (
                  <View style={styles.emergencyIndicator}>
                    <Text style={styles.emergencyIndicatorText}>  </Text>
                  </View>
                )}
              </Pressable>
            )}
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={handleBuy}
            >
              <FontAwesome5
                name="wallet"
                size={24}
                color={Colors.white}
              />
              <Text style={styles.quickActionText}>Buy</Text>
            </TouchableOpacity>
          </View>

        </View>
      </ScrollView>

      {/* Device Selection Modal */}
      <Modal
        visible={showDeviceModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDeviceModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Device</Text>
              <TouchableOpacity
                onPress={() => {
                  console.log("Closing device modal");
                  setShowDeviceModal(false);
                  setIsScanning(false);
                  try {
                    BleService.stopScan();
                  } catch (e) {
                    console.log("   Error stopping scan:", e?.message);
                  }
                }}
                style={styles.modalCloseButton}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {!bleInitialized ? (
              <View style={styles.scanningContainer}>
                <Ionicons name="bluetooth-off" size={50} color={Colors.gray} />
                <Text style={styles.scanningText}>Bluetooth is not enabled</Text>
                <Text style={styles.scanningSubtext}>Please enable Bluetooth in your device settings</Text>
              </View>
            ) : !blePermissionsGranted ? (
              <View style={styles.scanningContainer}>
                <Ionicons name="shield-outline" size={50} color={Colors.gray} />
                <Text style={styles.scanningText}>Bluetooth permissions required</Text>
                <Text style={styles.scanningSubtext}>Please grant Bluetooth permissions to scan for devices</Text>
              </View>
            ) : isScanning ? (
              <View style={styles.scanningContainer}>
                <View style={styles.scanningSpinner} />
                <Text style={styles.scanningText}>Scanning for devices...</Text>
              </View>
            ) : devices.length === 0 ? (
              <View style={styles.scanningContainer}>
                <Ionicons name="search" size={50} color={Colors.gray} />
                <Text style={styles.scanningText}>No devices found</Text>
                <Text style={styles.scanningSubtext}>Make sure your SuiStep device is turned on and nearby</Text>
                <TouchableOpacity
                  style={styles.retryScanButton}
                  onPress={startDeviceScan}
                >
                  <Text style={styles.retryScanButtonText}>Scan Again</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.deviceList}>
                {devices.map((device) => (
                  <TouchableOpacity
                    key={device.id}
                    style={[
                      styles.deviceItem,
                      device.connected && styles.deviceItemConnected
                    ]}
                    onPress={() => connectToDevice(device.id)}
                    disabled={device.connected}
                  >
                    <View style={styles.deviceInfo}>
                      <Text style={styles.deviceName}>{device.name}</Text>
                      <Text style={styles.deviceRssi}>Signal: {device.rssi} dBm</Text>
                    </View>
                    <View style={styles.deviceStatus}>
                      {device.connected ? (
                        <MaterialIcons name="check-circle" size={24} color="#4CAF50" />
                      ) : (
                        <MaterialIcons name="bluetooth" size={24} color={Colors.thickOrange} />
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* PIN Authentication Modal */}
      <Modal
        visible={showPinModal}
        animationType="slide"
        transparent={true}
        onRequestClose={cancelPinEntry}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Enter Device PIN</Text>
              <TouchableOpacity onPress={cancelPinEntry} style={styles.modalCloseButton}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.emergencyInstructionText}>Enter the 4-digit PIN to unlock the device</Text>

            <View style={styles.emergencyInputContainer}>
              <TextInput
                value={pin}
                onChangeText={setPin}
                placeholder="••••"
                placeholderTextColor={Colors.gray}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={4}
                style={[styles.emergencyInput, { letterSpacing: 8 }]}
              />
            </View>

            {pinError ? (
              <Text style={[styles.emergencyInstructionText, { color: '#ff4444' }]}>{pinError}</Text>
            ) : null}

            <View style={styles.emergencyButtonContainer}>
              <TouchableOpacity
                style={[styles.emergencyVerifyButton, { opacity: isPinValidating ? 0.7 : 1 }]}
                onPress={validatePinAndAuthenticate}
                disabled={isPinValidating}
              >
                <Text style={styles.emergencyVerifyButtonText}>{isPinValidating ? 'Validating…' : 'Unlock'}</Text>
              </TouchableOpacity>
            </View>
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
              <TouchableOpacity onPress={() => setShowWalletListModal(false)} style={styles.modalCloseButton}>
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
                <Text style={styles.scanningText}>No wallets found on device</Text>
                <Text style={styles.scanningSubtext}>Create a new wallet on your device to get started</Text>
                <TouchableOpacity
                  style={[styles.retryScanButton, isCreatingWallet && styles.retryScanButtonDisabled]}
                  onPress={createNewWallet}
                  disabled={isCreatingWallet}
                >
                  <Text style={styles.retryScanButtonText}>
                    {isCreatingWallet ? "Creating..." : "Create Wallet"}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.deviceList}>
                {walletList.map((w) => (
                  <TouchableOpacity
                    key={`${w.id}-${w.address}`}
                    style={styles.deviceItem}
                    onPress={() => selectWallet(w)}
                  >
                    <View style={styles.deviceInfo}>
                      <Text style={styles.deviceName}>{truncateAddress(w.address)}</Text>
                      <Text style={styles.deviceRssi}>Index: {w.index}</Text>
                    </View>
                    <View style={styles.deviceStatus}>
                      <MaterialIcons name="chevron-right" size={24} color={Colors.thickOrange} />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Custom Alerts */}
      <CustomAlert
        visible={showBuyAlert}
        title="Buy Tokens"
        message="This feature isn't available yet 😪"
        buttons={[
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => setShowBuyAlert(false),
          },
          {
            text: "Buy Now",
            onPress: () => {
              setShowBuyAlert(false);
              console.log("Opening buy flow...");
            },
          },
        ]}
        onRequestClose={() => setShowBuyAlert(false)}
      />

      {/* Emergency Wipe Setup Alert */}
      <CustomAlert
        visible={showEmergencySetupAlert}
        title="Emergency Wipe Not Available"
        message={"Emergency wipe requires:\n1. Device connection\n2. Emergency code setup\n\nPlease connect your SuiStep device and set up an emergency wipe code in Settings."}
        buttons={[
          {
            text: "OK",
            onPress: () => setShowEmergencySetupAlert(false),
          },
        ]}
        onRequestClose={() => setShowEmergencySetupAlert(false)}
      />

      {/* Emergency Wipe Confirmation Alert */}
      <CustomAlert
        visible={showEmergencyConfirmAlert}
        title="Confirm Emergency Wipe"
        message={"   This will permanently erase your wallet and all data. This action cannot be undone.\n\nAre you sure you want to proceed?"}
        buttons={[
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => setShowEmergencyConfirmAlert(false),
          },
          {
            text: "Wipe Now",
            onPress: () => executeEmergencyWipe(),
          },
        ]}
        onRequestClose={() => setShowEmergencyConfirmAlert(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
    paddingTop: StatusBar.currentHeight,
  },

  // Header Styles
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerText: {
    fontSize: 24,
    fontWeight: "bold",
    color: Colors.white,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  connected: {
    backgroundColor: Colors.thickOrange,
  },
  disconnected: {
    backgroundColor: Colors.gray,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.white,
  },

  // Main Content
  mainContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  // Card Styles
  card: {
    backgroundColor: Colors.lightGray,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },

  // Wallet Address Styles
  walletAddressContainer: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.gray,
  },
  copyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  copyButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.thickOrange,
  },
  addressText: {
    fontSize: 18,
    fontWeight: "bold",
    color: Colors.white,
    fontFamily: "monospace",
  },

  // Balance Styles
  balanceContainer: {
    gap: 16,
  },
  balanceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  balanceLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.gray,
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: "bold",
    color: Colors.white,
    textAlign: "center",
  },
  balanceSubtitle: {
    fontSize: 14,
    color: Colors.gray,
    textAlign: "center",
  },

  // Portfolio Styles
  portfolioSection: {
    marginTop: 20,
  },
  portfolioTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: Colors.white,
    marginBottom: 12,
  },
  coinItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray,
  },
  coinInfo: {
    flex: 1,
  },
  coinName: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.white,
  },
  coinSymbol: {
    fontSize: 14,
    color: Colors.gray,
  },
  coinBalance: {
    alignItems: "flex-end",
    flex: 1,
  },
  coinBalanceText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.white,
  },
  coinPrice: {
    fontSize: 14,
    color: Colors.gray,
  },
  coinChange: {
    alignItems: "flex-end",
    minWidth: 60,
  },
  coinChangeText: {
    fontSize: 14,
    fontWeight: "600",
  },

  // Quick Actions
  quickActionsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
    gap: 12,
  },
  quickActionButton: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: Colors.thickOrange,
    borderRadius: 12,
    flex: 1,
    justifyContent: "center",
    minHeight: 80,
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.white,
    textAlign: "center",
  },

  // Empty States
  emptyStateContainer: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 20,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: Colors.white,
    textAlign: "center",
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: Colors.gray,
    textAlign: "center",
    lineHeight: 20,
  },

  emptyBalanceContainer: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 20,
  },
  emptyBalanceTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: Colors.white,
  },
  emptyBalanceSubtitle: {
    fontSize: 14,
    color: Colors.gray,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 8,
  },

  // Loading State
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  loadingCard: {
    backgroundColor: Colors.lightGray,
    borderRadius: 16,
    padding: 40,
    alignItems: "center",
    gap: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  loadingSpinner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: Colors.thickOrange,
    borderTopColor: "transparent",
  },
  loadingText: {
    fontSize: 16,
    color: Colors.white,
    fontWeight: "600",
  },

  // Error State
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  errorCard: {
    backgroundColor: Colors.lightGray,
    borderRadius: 16,
    padding: 40,
    alignItems: "center",
    gap: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    width: "100%",
    maxWidth: 320,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: Colors.white,
    textAlign: "center",
  },
  errorSubtitle: {
    fontSize: 16,
    color: Colors.gray,
    textAlign: "center",
    lineHeight: 22,
  },
  warningIconContainer: {
    alignItems: "center",
    marginVertical: 10,
  },
  retryButton: {
    backgroundColor: Colors.thickOrange,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 10,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: Colors.white,
  },

  // Modal Styles
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

  // Device Selection Modal
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
  },
  scanningText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: "600",
  },
  scanningSubtext: {
    color: Colors.gray,
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
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
    gap: 12,
  },
  deviceItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.lightGray,
    borderRadius: 12,
    padding: 16,
  },
  deviceItemConnected: {
    backgroundColor: Colors.thickOrange,
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
  deviceStatus: {
    marginLeft: 12,
  },

  // Emergency Wipe Modal Styles
  emergencyWarningText: {
    fontSize: 16,
    color: "#ff4444",
    textAlign: "center",
    marginBottom: 15,
    fontWeight: "600",
  },
  emergencyInstructionText: {
    fontSize: 16,
    color: Colors.white,
    textAlign: "center",
    marginBottom: 10,
  },
  emergencyInputContainer: {
    backgroundColor: Colors.lightGray,
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
  },
  emergencyInput: {
    fontSize: 20,
    fontWeight: "bold",
    color: Colors.white,
    textAlign: "center",
  },
  emergencyMorseButtons: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 15,
  },
  emergencyMorseButton: {
    backgroundColor: Colors.thickOrange,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  emergencyMorseButtonText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: "600",
  },
  emergencyButtonContainer: {
    alignItems: "center",
  },
  emergencyVerifyButton: {
    backgroundColor: "#ff4444",
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 10,
  },
  emergencyVerifyButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: Colors.white,
  },
  emergencyIndicator: {
    position: 'absolute',
    bottom: 0,
    left: '50%',
    transform: [{ translateX: -10 }],
    backgroundColor: '#ff4444',
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  emergencyIndicatorText: {
    fontSize: 12,
    color: Colors.white,
  },


});
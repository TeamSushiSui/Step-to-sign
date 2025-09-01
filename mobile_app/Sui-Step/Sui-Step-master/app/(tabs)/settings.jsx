import CustomAlert from "@/components/CustomAlert";
import Colors from "@/constants/Colors";
import { useGlobalState } from "@/contexts/GlobalStateProvider";
import BleService from "@/services/BleService";
import feedbackManager from "@/utils/feedbackUtils";
import { Feather, MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";

import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StatusBar, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from "react-native";

export default function SettingsScreen() {
    const {
        deviceConnected,
        setDeviceConnected,
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
        vibration,
        setVibration,
        isScanning,
        setIsScanning,
        devices,
        setDevices,
        showDeviceModal,
        setShowDeviceModal,
        selectedDevice,
        setSelectedDevice,
        morseInput,
        setMorseInput,
        emergencyCode,
        setEmergencyCode,
        disconnectAndClearWallet,
        devicePassword,
        isPasswordChanged,
        saveDevicePassword,
        saveFeedbackSettings,
        selectWalletAndUpdateState,
        walletAddress,
        connectToBleDevice,
        disconnectBleDevice,
        scanForBleDevices,
        bleInitialized,
        blePermissionsGranted,
    } = useGlobalState();

    // Emergency wipe states
    const [isSettingCode, setIsSettingCode] = useState(false);
    const [longPressTimer, setLongPressTimer] = useState(null);

    // Password change states
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [newPasswordInput, setNewPasswordInput] = useState("");
    const [confirmPasswordInput, setConfirmPasswordInput] = useState("");
    const [currentPasswordInput, setCurrentPasswordInput] = useState("");
    const [showPinChangeModal, setShowPinChangeModal] = useState(false);
    const [isPinValidating, setIsPinValidating] = useState(false);
    const [pinError, setPinError] = useState("");

    // Morse code change states
    const [showMorseChangeModal, setShowMorseChangeModal] = useState(false);
    const [newMorseInput, setNewMorseInput] = useState("");
    const [confirmMorseInput, setConfirmMorseInput] = useState("");
    const [isMorseValidating, setIsMorseValidating] = useState(false);
    const [morseError, setMorseError] = useState("");

    // Wallet management states
    const [wallets, setWallets] = useState([]);
    const [isLoadingWallets, setIsLoadingWallets] = useState(false);
    const [isCreatingWallet, setIsCreatingWallet] = useState(false);
    const [selectedWalletIndex, setSelectedWalletIndex] = useState(0);

    // Auth and wallet selection states (same as index.jsx)
    const [showPinModal, setShowPinModal] = useState(false);
    const [pin, setPin] = useState("");
    const [isPinValidatingAuth, setIsPinValidatingAuth] = useState(false);
    const [selectedDeviceForPin, setSelectedDeviceForPin] = useState(null);

    const [walletList, setWalletList] = useState([]);
    const [showWalletListModal, setShowWalletListModal] = useState(false);
    const [isFetchingWallets, setIsFetchingWallets] = useState(false);

    // Alert states
    const [showEmergencyAlert, setShowEmergencyAlert] = useState(false);
    const [showBleAlert, setShowBleAlert] = useState(false);
    const [showCalibrationAlert, setShowCalibrationAlert] = useState(false);
    const [showThresholdAlert, setShowThresholdAlert] = useState(false);
    const [showFeedbackAlert, setShowFeedbackAlert] = useState(false);
    const [showSetCodeAlert, setShowSetCodeAlert] = useState(false);
    const [showWipeConfirmAlert, setShowWipeConfirmAlert] = useState(false);
    const [showWipeWarningAlert, setShowWipeWarningAlert] = useState(false);
    const [showDeviceRequiredAlert, setShowDeviceRequiredAlert] = useState(false);
    const [showPasswordChangeAlert, setShowPasswordChangeAlert] = useState(false);
    const [showPasswordMismatchAlert, setShowPasswordMismatchAlert] = useState(false);
    const [showPasswordSuccessAlert, setShowPasswordSuccessAlert] = useState(false);
    const [showWalletLimitAlert, setShowWalletLimitAlert] = useState(false);
    const [showWalletCreatedAlert, setShowWalletCreatedAlert] = useState(false);
    const [alertConfig, setAlertConfig] = useState({});

    // Load saved emergency code on mount
    useEffect(() => {
        loadEmergencyCode();
    }, []);

    // Sync BLE enabled with device connected
    useEffect(() => {
        setBleEnabled(deviceConnected);
    }, [deviceConnected, setBleEnabled]);

    // Load wallets when device is connected
    useEffect(() => {
        if (deviceConnected) {
            loadWallets();
        }
    }, [deviceConnected]);

    // Debug logging for device scanning
    useEffect(() => {
        console.log("🔍 Settings Debug - Devices:", devices);
        console.log("🔍 Settings Debug - isScanning:", isScanning);
        console.log("🔍 Settings Debug - showDeviceModal:", showDeviceModal);
        console.log("🔍 Settings Debug - bleInitialized:", bleInitialized);
        console.log("🔍 Settings Debug - blePermissionsGranted:", blePermissionsGranted);
    }, [devices, isScanning, showDeviceModal, bleInitialized, blePermissionsGranted]);

    // Set up BLE callbacks for wallet management
    useEffect(() => {
        BleService.callbacks.onWalletListReceived = (walletList) => {
            console.log("    Settings: Wallet list received:", walletList);
            setWallets(walletList);
            setIsLoadingWallets(false);
        };

        BleService.callbacks.onWalletSelected = () => {
            console.log("  Settings: Wallet selected successfully");
        };

        BleService.callbacks.onCreateWallet = (walletData) => {
            console.log("  Settings: New wallet created:", walletData);
            setIsCreatingWallet(false);
            setShowWalletCreatedAlert(true);
            // Refresh wallet list
            loadWallets();
        };

        return () => {
            BleService.callbacks.onWalletListReceived = () => { };
            BleService.callbacks.onWalletSelected = () => { };
            BleService.callbacks.onCreateWallet = () => { };
        };
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

    const saveEmergencyCode = async (code) => {
        try {
            await SecureStore.setItemAsync('emergencyWipeCode', code);
            setEmergencyCode(code);
        } catch (error) {
            console.log('Error saving emergency code:', error);
        }
    };

    // Wallet management functions
    const loadWallets = async () => {
        if (!deviceConnected) return;

        try {
            setIsLoadingWallets(true);
            console.log("    Settings: Loading wallets from device...");
            const walletList = await BleService.listWallets();
            console.log("  Settings: Wallets loaded:", walletList);
            setWallets(walletList);
        } catch (error) {
            console.error("   Settings: Failed to load wallets:", error);
            setWallets([]);
        } finally {
            setIsLoadingWallets(false);
        }
    };

    const createNewWallet = async () => {
        if (!deviceConnected) {
            setShowDeviceRequiredAlert(true);
            return;
        }

        if (wallets.length >= 3) {
            setShowWalletLimitAlert(true);
            return;
        }

        try {
            setIsCreatingWallet(true);
            console.log("    Settings: Creating new wallet...");
            const newWallet = await BleService.createWallet();
            console.log("  Settings: New wallet created:", newWallet);

            // Provide feedback for successful wallet creation
            await feedbackManager.success();
        } catch (error) {
            console.error("   Settings: Failed to create wallet:", error);
            setIsCreatingWallet(false);

            // Provide feedback for wallet creation failure
            await feedbackManager.error();

            if (error.message?.includes("Maximum wallets reached")) {
                setShowWalletLimitAlert(true);
            }
        }
    };

    const selectWallet = async (index) => {
        if (!deviceConnected) {
            setShowDeviceRequiredAlert(true);
            return;
        }

        try {
            console.log("    Settings: Selecting wallet at index:", index);

            // Get the wallet address for the selected index
            const selectedWallet = wallets[index];
            if (!selectedWallet || !selectedWallet.address) {
                console.error("   Settings: No wallet found at index:", index);
                return;
            }

            // Use the global function to select wallet and update state
            await selectWalletAndUpdateState(index, selectedWallet.address);
            setSelectedWalletIndex(index);

            console.log("  Settings: Wallet selected successfully");

            // Provide feedback for successful wallet selection
            await feedbackManager.success();
        } catch (error) {
            console.error("   Settings: Failed to select wallet:", error);
            await feedbackManager.error();
        }
    };

    const truncateAddress = (address) => {
        if (!address) return "Unknown";
        if (address.length <= 12) return address;
        return `${address.slice(0, 8)}...${address.slice(-4)}`;
    };

    // BLE Device Scanning (Simulated)
    // const startDeviceScan = () => {
    //     setIsScanning(true);
    //     setDevices([]);
    //     setShowDeviceModal(true);

    //     // Simulate device discovery
    //     setTimeout(() => {
    //         const mockDevices = [
    //             { id: "1", name: "SuiStep Device 1", rssi: -45, connected: false },
    //             { id: "2", name: "SuiStep Device 2", rssi: -52, connected: false },
    //             { id: "3", name: "SuiStep Device 3", rssi: -38, connected: false },
    //         ];
    //         setDevices(mockDevices);
    //         setIsScanning(false);
    //     }, 2000);
    // };

    // HOME AUTH FLOW: select device -> prompt PIN -> connect -> auth -> list wallets
    const connectToDevice = async (deviceId) => {
        try {
            const deviceToConnect = devices.find((d) => d.id === deviceId);
            if (!deviceToConnect) {
                console.error("   Settings: Device not found for connection:", deviceId);
                return;
            }

            console.log("    Settings: Preparing authentication for device:", deviceToConnect.name);

            // Close the device modal and stop scanning
            setShowDeviceModal(false);
            setIsScanning(false);
            try { BleService.stopScan(); } catch (_) { }

            // Show PIN modal (connect will happen after PIN entry)
            setSelectedDeviceForPin(deviceToConnect);
            setShowPinModal(true);
        } catch (error) {
            console.error("Settings device connection prep failed:", error);
            await feedbackManager.error();
        }
    };

    const disconnectDevice = async () => {
        try {
            await disconnectAndClearWallet();
        } catch (_) { }
        setBleEnabled(false);
        setDeviceConnected(false);
        setSelectedDevice(null);

        // Provide feedback for disconnection
        await feedbackManager.disconnect();

        setShowBleAlert(true);
    };

    // Real BLE implementation (commented out for Expo Go)
    /*
    const startDeviceScan = async () => {
        try {
            setIsScanning(true);
            setDevices([]);
            setShowDeviceModal(true);
            
            // Request BLE permissions
            const { status } = await BleManager.requestPermissions();
            if (status !== 'granted') {
                throw new Error('BLE permissions not granted');
            }
            
            // Start scanning for devices
            await BleManager.startDeviceScan(
                [MORSE_SERVICE_UUID], // Filter by service UUID
                null, // Allow duplicates
                (error, device) => {
                    if (error) {
                        console.log('Scan error:', error);
                        return;
                    }
                    if (device && device.name) {
                        setDevices(prev => {
                            const exists = prev.find(d => d.id === device.id);
                            if (!exists) {
                                return [...prev, {
                                    id: device.id,
                                    name: device.name,
                                    rssi: device.rssi,
                                    connected: false
                                }];
                            }
                            return prev;
                        });
                    }
                }
            );
            
            // Stop scanning after 10 seconds
            setTimeout(() => {
                BleManager.stopDeviceScan();
                setIsScanning(false);
            }, 10000);
            
        } catch (error) {
            console.log('BLE scan error:', error);
            setIsScanning(false);
        }
    };

    const connectToDevice = async (deviceId) => {
        try {
            const device = await BleManager.connectToDevice(deviceId);
            await device.discoverAllServicesAndCharacteristics();
            
            // Subscribe to Morse input characteristic
            const morseCharacteristic = await device.readCharacteristicForService(
                MORSE_SERVICE_UUID,
                MORSE_INPUT_CHARACTERISTIC_UUID
            );
            
            await device.monitorCharacteristicForService(
                MORSE_SERVICE_UUID,
                MORSE_INPUT_CHARACTERISTIC_UUID,
                (error, characteristic) => {
                    if (characteristic && characteristic.value) {
                        const morseSymbol = decode(characteristic.value);
                        handleMorseInput(morseSymbol);
                    }
                }
            );
            
            setShowDeviceModal(false);
            setBleEnabled(true);
            setDeviceConnected(true);
            
        } catch (error) {
            console.log('Connection error:', error);
        }
    };

    const disconnectDevice = async () => {
        try {
            if (selectedDevice) {
                await BleManager.cancelDeviceConnection(selectedDevice.id);
            }
            setBleEnabled(false);
            setDeviceConnected(false);
            setSelectedDevice(null);
        } catch (error) {
            console.log('Disconnection error:', error);
        }
    };
    */

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
            console.log("    Settings: Requesting wallet list from device...");
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
            console.error("   Settings: Failed to get wallet list:", error);
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

        setIsPinValidatingAuth(true);
        setPinError("");

        try {
            console.log("    Settings: Connecting to device for auth...");
            try {
                await connectToBleDevice(selectedDeviceForPin.id);
            } catch (_connErr) {
                setPinError("Failed to connect to device. Please try again.");
                setIsPinValidatingAuth(false);
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
                console.log("  Settings: Authentication successful");
                setShowPinModal(false);
                setPin("");

                // Provide feedback for successful authentication
                await feedbackManager.authentication();

                await new Promise((r) => setTimeout(r, 150));
                await requestWalletListFromDevice();
            } else {
                console.log("   Settings: Authentication failed");
                setPinError("Invalid PIN. Please try again.");

                // Provide feedback for authentication failure
                await feedbackManager.error();

                try { await disconnectBleDevice(); } catch (_) { }
            }
        } catch (error) {
            console.error("   Settings: PIN validation failed:", error);
            setPinError("Authentication failed. Please try again.");
            try { await disconnectBleDevice(); } catch (_) { }
        } finally {
            setIsPinValidatingAuth(false);
        }
    };

    const selectWalletFromAuth = async (wallet) => {
        try {
            console.log("  Settings: Wallet selected:", wallet.address);
            setShowWalletListModal(false);
            await selectWalletAndUpdateState(wallet.index, wallet.address);

            // Provide feedback for wallet selection
            await feedbackManager.success();
        } catch (error) {
            console.error("   Settings: Failed to select wallet:", error);
            await feedbackManager.error();
        }
    };

    const createNewWalletFromAuth = async () => {
        setIsCreatingWallet(true);
        try {
            console.log("    Settings: Creating new wallet on device...");

            const newWallet = await BleService.createWallet();

            console.log("  Settings: Wallet created successfully:", newWallet);

            // Close the wallet list modal and refresh the list
            setShowWalletListModal(false);
            await new Promise(resolve => setTimeout(resolve, 500)); // Small delay

            // Refresh wallet list
            await requestWalletListFromDevice();

            // Provide feedback for successful wallet creation
            await feedbackManager.success();
        } catch (error) {
            console.error("   Settings: Wallet creation failed:", error);
            Alert.alert(
                "Wallet Creation Error",
                "Failed to create wallet on device. Please try again."
            );
        } finally {
            setIsCreatingWallet(false);
        }
    };

    const handleBleToggle = async (value) => {
        if (value) {
            // Start device scanning when enabling BLE
            console.log("    Settings: Starting device scan...");
            setShowDeviceModal(true);
            await scanForBleDevices();
        } else {
            // Disconnect when disabling BLE
            await disconnectDevice();
        }
    };

    const handleCalibration = async (type) => {
        setSelectedCalibration(type);
        if (vibration) {
            await feedbackManager.tap();
        }
        setShowCalibrationAlert(true);
    };

    const handleThresholdChange = async (type, value) => {
        if (vibration) {
            await feedbackManager.tap();
        }

        switch (type) {
            case 'noiseFloor':
                setNoiseFloor(value);
                break;
            case 'dotPressure':
                setDotPressure(value);
                break;
            case 'dashPressure':
                setDashPressure(value);
                break;
        }
        setShowThresholdAlert(true);
    };

    const handleFeedbackToggle = async (type, value) => {
        if (type === 'vibration') {
            await saveFeedbackSettings('vibration', value);
            setShowFeedbackAlert(true);
        }
    };

    const handleSetEmergencyCode = () => {
        if (!deviceConnected) {
            setShowDeviceRequiredAlert(true);
            return;
        }
        setShowMorseChangeModal(true);
        setNewMorseInput("");
        setConfirmMorseInput("");
        setMorseError("");
    };

    const validateAndChangeMorse = async () => {
        if (newMorseInput.length === 0) {
            setMorseError("Please enter a morse code sequence");
            return;
        }

        if (newMorseInput !== confirmMorseInput) {
            setMorseError("Morse code sequences do not match");
            return;
        }

        if (newMorseInput === emergencyCode) {
            setMorseError("New morse code must be different from current code");
            return;
        }

        setIsMorseValidating(true);
        setMorseError("");

        try {
            console.log("    Settings: Changing morse code...");

            // Send morse code change command to device
            await BleService.saveGesture(newMorseInput);

            console.log("  Settings: Morse code changed successfully");

            // Save new morse code locally
            await saveEmergencyCode(newMorseInput);

            // Close modal and reset state
            setShowMorseChangeModal(false);
            setNewMorseInput("");
            setConfirmMorseInput("");
            setIsMorseValidating(false);

            // Provide feedback for successful morse code change
            await feedbackManager.success();

            setShowPasswordSuccessAlert(true);
        } catch (error) {
            console.error("   Settings: Failed to change morse code:", error);
            setMorseError("Failed to change morse code. Please try again.");
            await feedbackManager.error();
        } finally {
            setIsMorseValidating(false);
        }
    };

    const cancelMorseChange = () => {
        setShowMorseChangeModal(false);
        setNewMorseInput("");
        setConfirmMorseInput("");
        setMorseError("");
        setIsMorseValidating(false);
    };



    const handleEmergencyWipeLongPress = () => {
        if (!deviceConnected) {
            setShowDeviceRequiredAlert(true);
            return;
        }
        if (emergencyCode) {
            setShowWipeConfirmAlert(true);
        } else {
            setShowWipeWarningAlert(true);
        }
    };

    const handleEmergencyWipePress = () => {
        if (!deviceConnected) {
            setShowDeviceRequiredAlert(true);
            return;
        }
        if (!emergencyCode) {
            setShowWipeWarningAlert(true);
        }
    };

    const confirmWipe = async () => {
        setShowWipeConfirmAlert(false);
        if (vibration) {
            await feedbackManager.warning();
        }
        // TODO: Implement actual wipe functionality
    };

    // Password change functions
    const handlePasswordChange = () => {
        if (!deviceConnected) {
            setShowDeviceRequiredAlert(true);
            return;
        }
        setShowPinChangeModal(true);
        setCurrentPasswordInput("");
        setNewPasswordInput("");
        setConfirmPasswordInput("");
        setPinError("");
    };

    const validateAndChangePin = async () => {
        if (currentPasswordInput.length !== 4) {
            setPinError("Current PIN must be 4 digits");
            return;
        }

        if (newPasswordInput.length !== 4) {
            setPinError("New PIN must be 4 digits");
            return;
        }

        if (newPasswordInput !== confirmPasswordInput) {
            setPinError("New PINs do not match");
            return;
        }

        if (newPasswordInput === currentPasswordInput) {
            setPinError("New PIN must be different from current PIN");
            return;
        }

        setIsPinValidating(true);
        setPinError("");

        try {
            console.log("    Settings: Changing device PIN...");

            // Send PIN change command to device
            await BleService.changePassword(currentPasswordInput, newPasswordInput);

            console.log("  Settings: PIN changed successfully");

            // Save new PIN locally
            await saveDevicePassword(newPasswordInput);

            // Close modal and reset state
            setShowPinChangeModal(false);
            setCurrentPasswordInput("");
            setNewPasswordInput("");
            setConfirmPasswordInput("");
            setIsPinValidating(false);

            // Provide feedback for successful PIN change
            await feedbackManager.success();

            setShowPasswordSuccessAlert(true);
        } catch (error) {
            console.error("   Settings: Failed to change PIN:", error);
            setPinError("Failed to change PIN. Please check your current PIN and try again.");
            await feedbackManager.error();
        } finally {
            setIsPinValidating(false);
        }
    };

    const cancelPinChange = () => {
        setShowPinChangeModal(false);
        setCurrentPasswordInput("");
        setNewPasswordInput("");
        setConfirmPasswordInput("");
        setPinError("");
        setIsPinValidating(false);
    };



    const showErrorAlert = (title, message, buttons = []) => {
        setAlertConfig({
            title,
            message,
            buttons: buttons.length > 0 ? buttons : [{ text: "OK", onPress: () => setAlertConfig({}) }]
        });
    };

    const renderSlider = (title, value, setValue, min, max, unit, description, type) => {
        const percentage = ((value - min) / (max - min)) * 100;

        return (
            <View style={styles.sliderContainer}>
                <View style={styles.sliderHeader}>
                    <Text style={styles.sliderTitle}>{title}</Text>
                    <View style={styles.valueBox}>
                        <Text style={styles.valueText}>{value}</Text>
                    </View>
                </View>
                <TouchableOpacity
                    style={styles.sliderTrack}
                    onPress={(event) => handleThresholdChange(type, value, min, max, event)}
                    activeOpacity={0.8}
                >
                    <View
                        style={[
                            styles.sliderFill,
                            { width: `${percentage}%` }
                        ]}
                    />
                    <View
                        style={[
                            styles.sliderThumb,
                            { left: `${percentage}%` }
                        ]}
                    />
                </TouchableOpacity>
                <Text style={styles.sliderDescription}>{description}</Text>
                <View style={styles.sliderControls}>
                    <TouchableOpacity
                        style={styles.sliderButton}
                        onPress={() => handleThresholdChange(type, Math.max(min, value - 10))}
                    >
                        <Text style={styles.sliderButtonText}>-10</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.sliderButton}
                        onPress={() => handleThresholdChange(type, value)}
                    >
                        <Text style={styles.sliderButtonText}>Apply</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.sliderButton}
                        onPress={() => handleThresholdChange(type, Math.min(max, value + 10))}
                    >
                        <Text style={styles.sliderButtonText}>+10</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity>
                    <Feather name="arrow-left" size={28} color={Colors.white} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Settings</Text>
                <View style={{ width: 28 }} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Connection Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Connection</Text>
                    <View style={styles.connectionCard}>
                        <View style={styles.connectionInfo}>
                            <Text style={styles.connectionLabel}>In-shoe Device</Text>
                            <Text style={[
                                styles.connectionStatus,
                                { color: bleEnabled ? "#4CAF50" : Colors.gray }
                            ]}>
                                {bleEnabled ? (selectedDevice ? `Connected to ${selectedDevice.name}` : "Connected") : "Disconnected"}
                            </Text>
                        </View>
                        <Switch
                            value={bleEnabled}
                            onValueChange={handleBleToggle}
                            trackColor={{ false: Colors.gray, true: Colors.thickOrange }}
                            thumbColor={Colors.white}
                        />
                    </View>
                </View>

                {/* Calibration Section */}
                {/* <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Calibration</Text>
                    <View style={styles.calibrationButtons}>
                        <TouchableOpacity
                            style={[
                                styles.calibrationButton,
                                selectedCalibration === "baseline" && styles.calibrationButtonActive
                            ]}
                            onPress={() => handleCalibration("baseline")}
                        >
                            <Text style={[
                                styles.calibrationButtonText,
                                selectedCalibration === "baseline" && styles.calibrationButtonTextActive
                            ]}>
                                Baseline
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                styles.calibrationButton,
                                selectedCalibration === "dot" && styles.calibrationButtonActive
                            ]}
                            onPress={() => handleCalibration("dot")}
                        >
                            <Text style={[
                                styles.calibrationButtonText,
                                selectedCalibration === "dot" && styles.calibrationButtonTextActive
                            ]}>
                                Dot Calibration
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                styles.calibrationButton,
                                selectedCalibration === "dash" && styles.calibrationButtonActive
                            ]}
                            onPress={() => handleCalibration("dash")}
                        >
                            <Text style={[
                                styles.calibrationButtonText,
                                selectedCalibration === "dash" && styles.calibrationButtonTextActive
                            ]}>
                                Dash Calibration
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View> */}

                {/* Thresholds Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Thresholds</Text>
                    {renderSlider(
                        "Noise Floor",
                        noiseFloor,
                        setNoiseFloor,
                        50,
                        300,
                        "ADC",
                        "+50 ADC units",
                        "noiseFloor"
                    )}
                    {renderSlider(
                        "Dot Pressure",
                        dotPressure,
                        setDotPressure,
                        100,
                        500,
                        "ADC",
                        "100-500 ADC",
                        "dotPressure"
                    )}
                    {renderSlider(
                        "Dash Pressure",
                        dashPressure,
                        setDashPressure,
                        500,
                        2000,
                        "ADC",
                        "500-2000 ADC",
                        "dashPressure"
                    )}
                </View>

                {/* Feedback Options Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Feedback Options</Text>
                    <View style={styles.feedbackOptions}>
                        <View style={styles.feedbackOption}>
                            <View style={styles.feedbackInfo}>
                                <MaterialCommunityIcons name="vibrate" size={24} color={Colors.thickOrange} />
                                <Text style={styles.feedbackLabel}>Vibration</Text>
                            </View>
                            <Switch
                                value={vibration}
                                onValueChange={(value) => handleFeedbackToggle('vibration', value)}
                                trackColor={{ false: Colors.gray, true: Colors.thickOrange }}
                                thumbColor={Colors.white}
                            />
                        </View>
                    </View>
                </View>

                {/* Password Change Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Device PIN</Text>

                    {/* Password Status */}
                    <View style={styles.passwordStatusCard}>
                        <Text style={styles.passwordStatusLabel}>Current PIN</Text>
                        <Text style={styles.passwordStatusValue}>
                            {isPasswordChanged ? "✓ Custom PIN Set" : "Custom PIN Not Set"}
                        </Text>
                    </View>

                    {/* Change Password Button */}
                    <TouchableOpacity
                        style={[
                            styles.setCodeButton,
                            !deviceConnected && styles.setCodeButtonDisabled
                        ]}
                        onPress={handlePasswordChange}
                        disabled={!deviceConnected}
                    >
                        <MaterialIcons
                            name="lock"
                            size={24}
                            color={deviceConnected ? Colors.white : Colors.gray}
                        />
                        <Text style={[
                            styles.setCodeButtonText,
                            !deviceConnected && styles.setCodeButtonTextDisabled
                        ]}>
                            Change Device PIN
                        </Text>
                        {!deviceConnected && (
                            <Text style={styles.deviceRequiredText}>
                                (Device Required)
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Wallet Management Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Wallet Management</Text>

                    {/* Wallet Status */}
                    <View style={styles.walletStatusCard}>
                        <Text style={styles.walletStatusLabel}>Device Wallets</Text>
                        <Text style={styles.walletStatusValue}>
                            {isLoadingWallets ? "Loading..." : `${wallets.length}/3 wallets`}
                        </Text>
                    </View>

                    {/* Currently Active Wallet */}
                    {walletAddress && (
                        <View style={styles.walletStatusCard}>
                            <Text style={styles.walletStatusLabel}>Currently Active</Text>
                            <Text style={styles.walletStatusValue}>
                                {truncateAddress(walletAddress)}
                            </Text>
                        </View>
                    )}

                    {/* Debug Info */}
                    <View style={styles.walletStatusCard}>
                        <Text style={styles.walletStatusLabel}>Debug Info</Text>
                        <Text style={styles.walletStatusValue}>
                            Scanning: {isScanning ? "Yes" : "No"}
                        </Text>
                        <Text style={styles.walletStatusValue}>
                            Devices Found: {devices.length}
                        </Text>
                        <Text style={styles.walletStatusValue}>
                            BLE Ready: {bleInitialized ? "Yes" : "No"}
                        </Text>
                        <Text style={styles.walletStatusValue}>
                            Permissions: {blePermissionsGranted ? "Yes" : "No"}
                        </Text>
                    </View>

                    {/* Wallet List */}
                    {wallets.length > 0 && (
                        <View style={styles.walletList}>
                            {wallets.map((wallet, index) => (
                                <TouchableOpacity
                                    key={index}
                                    style={[
                                        styles.walletItem,
                                        selectedWalletIndex === index && styles.walletItemSelected
                                    ]}
                                    onPress={() => selectWallet(index)}
                                    disabled={!deviceConnected}
                                >
                                    <View style={styles.walletInfo}>
                                        <Text style={styles.walletName}>
                                            Wallet {index + 1}
                                        </Text>
                                        <Text style={styles.walletAddress}>
                                            {truncateAddress(wallet.address)}
                                        </Text>
                                    </View>
                                    <View style={styles.walletStatus}>
                                        {selectedWalletIndex === index ? (
                                            <MaterialIcons name="check-circle" size={24} color="#4CAF50" />
                                        ) : (
                                            <MaterialIcons name="radio-button-unchecked" size={24} color={Colors.gray} />
                                        )}
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    {/* Create New Wallet Button */}
                    <TouchableOpacity
                        style={[
                            styles.setCodeButton,
                            (!deviceConnected || wallets.length >= 3 || isCreatingWallet) && styles.setCodeButtonDisabled
                        ]}
                        onPress={createNewWallet}
                        disabled={!deviceConnected || wallets.length >= 3 || isCreatingWallet}
                    >
                        <MaterialIcons
                            name="add-circle"
                            size={24}
                            color={deviceConnected && wallets.length < 3 && !isCreatingWallet ? Colors.white : Colors.gray}
                        />
                        <Text style={[
                            styles.setCodeButtonText,
                            (!deviceConnected || wallets.length >= 3 || isCreatingWallet) && styles.setCodeButtonTextDisabled
                        ]}>
                            {isCreatingWallet ? "Creating Wallet..." : "Create New Wallet"}
                        </Text>
                        {!deviceConnected && (
                            <Text style={styles.deviceRequiredText}>
                                (Device Required)
                            </Text>
                        )}
                        {wallets.length >= 3 && (
                            <Text style={styles.deviceRequiredText}>
                                (Maximum 3 wallets)
                            </Text>
                        )}
                    </TouchableOpacity>

                    {/* Refresh Wallets Button */}
                    <TouchableOpacity
                        style={[
                            styles.refreshButton,
                            !deviceConnected && styles.refreshButtonDisabled
                        ]}
                        onPress={loadWallets}
                        disabled={!deviceConnected || isLoadingWallets}
                    >
                        <MaterialIcons
                            name="refresh"
                            size={20}
                            color={deviceConnected && !isLoadingWallets ? Colors.thickOrange : Colors.gray}
                        />
                        <Text style={[
                            styles.refreshButtonText,
                            !deviceConnected && styles.refreshButtonTextDisabled
                        ]}>
                            {isLoadingWallets ? "Loading..." : "Refresh Wallets"}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Emergency Wipe Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Emergency Wipe</Text>

                    {/* Set Emergency Code Button */}
                    <TouchableOpacity
                        style={[
                            styles.setCodeButton,
                            !deviceConnected && styles.setCodeButtonDisabled
                        ]}
                        onPress={handleSetEmergencyCode}
                        disabled={!deviceConnected}
                    >
                        <MaterialIcons
                            name="security"
                            size={24}
                            color={deviceConnected ? Colors.white : Colors.gray}
                        />
                        <Text style={[
                            styles.setCodeButtonText,
                            !deviceConnected && styles.setCodeButtonTextDisabled
                        ]}>
                            {emergencyCode ? "Change Emergency Wipe Code" : "Set Emergency Wipe Code"}
                        </Text>
                        {!deviceConnected && (
                            <Text style={styles.deviceRequiredText}>
                                (Device Required)
                            </Text>
                        )}
                    </TouchableOpacity>

                    {/* Emergency Code Status */}
                    {emergencyCode && (
                        <View style={styles.codeStatusCard}>
                            <Text style={styles.codeStatusLabel}>Emergency Code Set</Text>
                            <Text style={styles.codeStatusValue}>✓ Code is securely stored</Text>
                        </View>
                    )}

                    {/* Emergency Wipe Button */}
                    <Pressable
                        style={[
                            styles.emergencyButton,
                            !deviceConnected && styles.emergencyButtonDisabled
                        ]}
                        onPress={handleEmergencyWipePress}
                        onLongPress={handleEmergencyWipeLongPress}
                        delayLongPress={5000}
                        disabled={!deviceConnected}
                    >
                        <MaterialIcons
                            name="delete-forever"
                            size={24}
                            color={deviceConnected ? Colors.white : Colors.gray}
                        />
                        <Text style={[
                            styles.emergencyButtonText,
                            !deviceConnected && styles.emergencyButtonTextDisabled
                        ]}>
                            {emergencyCode ? "Emergency Wipe (Long Press 5s)" : "Emergency Wipe"}
                        </Text>
                        {!deviceConnected && (
                            <Text style={styles.deviceRequiredText}>
                                (Device Required)
                            </Text>
                        )}
                    </Pressable>
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
                                onPress={() => setShowDeviceModal(false)}
                                style={styles.modalCloseButton}
                            >
                                <Text style={styles.modalCloseText}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        {isScanning ? (
                            <View style={styles.scanningContainer}>
                                <View style={styles.scanningSpinner} />
                                <Text style={styles.scanningText}>Scanning for devices...</Text>
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



            {/* Custom Alerts */}
            <CustomAlert
                visible={showBleAlert}
                title="Connection Updated"
                message={`Bluetooth connection ${bleEnabled ? 'enabled' : 'disabled'} successfully.`}
                buttons={[
                    {
                        text: "OK",
                        onPress: () => setShowBleAlert(false),
                    },
                ]}
                onRequestClose={() => setShowBleAlert(false)}
            />

            <CustomAlert
                visible={showCalibrationAlert}
                title="Calibration Updated"
                message={`${((selectedCalibration || '').charAt(0).toUpperCase()) + (selectedCalibration || '').slice(1)} calibration mode activated. Tap your insole to calibrate.`}
                buttons={[
                    {
                        text: "OK",
                        onPress: () => setShowCalibrationAlert(false),
                    },
                ]}
                onRequestClose={() => setShowCalibrationAlert(false)}
            />

            <CustomAlert
                visible={showThresholdAlert}
                title="Threshold Updated"
                message="Threshold settings have been applied to your device."
                buttons={[
                    {
                        text: "OK",
                        onPress: () => setShowThresholdAlert(false),
                    },
                ]}
                onRequestClose={() => setShowThresholdAlert(false)}
            />

            <CustomAlert
                visible={showFeedbackAlert}
                title="Feedback Updated"
                message="Feedback settings have been updated on your device."
                buttons={[
                    {
                        text: "OK",
                        onPress: () => setShowFeedbackAlert(false),
                    },
                ]}
                onRequestClose={() => setShowFeedbackAlert(false)}
            />



            <CustomAlert
                visible={showWipeConfirmAlert}
                title="Confirm Emergency Wipe"
                message="This will permanently erase your wallet and all data. This action cannot be undone.\n\nTap your emergency code on the insole to confirm."
                buttons={[
                    {
                        text: "Cancel",
                        style: "cancel",
                        onPress: () => setShowWipeConfirmAlert(false),
                    },
                    {
                        text: "Confirm Wipe",
                        style: "destructive",
                        onPress: confirmWipe,
                    },
                ]}
                onRequestClose={() => setShowWipeConfirmAlert(false)}
            />

            <CustomAlert
                visible={showWipeWarningAlert}
                title="No Emergency Code Set"
                message="You have not set an emergency wipe code yet. Please set one to enable emergency wipe functionality."
                buttons={[
                    {
                        text: "OK",
                        onPress: () => setShowWipeWarningAlert(false),
                    },
                ]}
                onRequestClose={() => setShowWipeWarningAlert(false)}
            />

            <CustomAlert
                visible={showDeviceRequiredAlert}
                title="Device Connection Required"
                message="Your SuiStep device must be connected to set or use emergency wipe codes. The emergency code is stored securely on your device.\n\nPlease connect your device first."
                buttons={[
                    {
                        text: "OK",
                        onPress: () => setShowDeviceRequiredAlert(false),
                    },
                ]}
                onRequestClose={() => setShowDeviceRequiredAlert(false)}
            />

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
                                    console.log("    Settings: Closing device modal");
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
                                <MaterialIcons name="bluetooth-off" size={50} color={Colors.gray} />
                                <Text style={styles.scanningText}>Bluetooth is not enabled</Text>
                                <Text style={styles.scanningSubtext}>Please enable Bluetooth in your device settings</Text>
                            </View>
                        ) : !blePermissionsGranted ? (
                            <View style={styles.scanningContainer}>
                                <MaterialIcons name="shield-outline" size={50} color={Colors.gray} />
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
                                <MaterialIcons name="search" size={50} color={Colors.gray} />
                                <Text style={styles.scanningText}>No devices found</Text>
                                <Text style={styles.scanningSubtext}>Make sure your SuiStep device is turned on and nearby</Text>
                                <TouchableOpacity
                                    style={styles.retryScanButton}
                                    onPress={() => {
                                        console.log("    Settings: Manual scan button pressed");
                                        scanForBleDevices();
                                    }}
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

            {/* PIN Change Modal */}
            <Modal
                visible={showPinChangeModal}
                animationType="slide"
                transparent={true}
                onRequestClose={cancelPinChange}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Change Device PIN</Text>
                            <TouchableOpacity onPress={cancelPinChange} style={styles.modalCloseButton}>
                                <Text style={styles.modalCloseText}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.modalInstructionText}>
                            Enter your current PIN and choose a new 4-digit PIN for device authentication.
                        </Text>

                        {/* Current PIN Input */}
                        <View style={styles.inputContainer}>
                            <Text style={styles.inputLabel}>Current PIN</Text>
                            <TextInput
                                value={currentPasswordInput}
                                onChangeText={setCurrentPasswordInput}
                                placeholder="••••"
                                placeholderTextColor={Colors.gray}
                                keyboardType="number-pad"
                                secureTextEntry
                                maxLength={4}
                                style={[styles.pinInput, { letterSpacing: 8 }]}
                            />
                        </View>

                        {/* New PIN Input */}
                        <View style={styles.inputContainer}>
                            <Text style={styles.inputLabel}>New PIN</Text>
                            <TextInput
                                value={newPasswordInput}
                                onChangeText={setNewPasswordInput}
                                placeholder="••••"
                                placeholderTextColor={Colors.gray}
                                keyboardType="number-pad"
                                secureTextEntry
                                maxLength={4}
                                style={[styles.pinInput, { letterSpacing: 8 }]}
                            />
                        </View>

                        {/* Confirm New PIN Input */}
                        <View style={styles.inputContainer}>
                            <Text style={styles.inputLabel}>Confirm New PIN</Text>
                            <TextInput
                                value={confirmPasswordInput}
                                onChangeText={setConfirmPasswordInput}
                                placeholder="••••"
                                placeholderTextColor={Colors.gray}
                                keyboardType="number-pad"
                                secureTextEntry
                                maxLength={4}
                                style={[styles.pinInput, { letterSpacing: 8 }]}
                            />
                        </View>

                        {pinError ? (
                            <Text style={[styles.modalInstructionText, { color: '#ff4444' }]}>{pinError}</Text>
                        ) : null}

                        <View style={styles.modalButtonContainer}>
                            <TouchableOpacity
                                style={[styles.modalButton, { opacity: isPinValidating ? 0.7 : 1 }]}
                                onPress={validateAndChangePin}
                                disabled={isPinValidating}
                            >
                                <Text style={styles.modalButtonText}>
                                    {isPinValidating ? 'Changing PIN...' : 'Change PIN'}
                                </Text>
                            </TouchableOpacity>
                        </View>
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

                        <Text style={styles.modalInstructionText}>Enter the 4-digit PIN to unlock the device</Text>

                        <View style={styles.inputContainer}>
                            <TextInput
                                value={pin}
                                onChangeText={setPin}
                                placeholder="••••"
                                placeholderTextColor={Colors.gray}
                                keyboardType="number-pad"
                                secureTextEntry
                                maxLength={4}
                                style={[styles.pinInput, { letterSpacing: 8 }]}
                            />
                        </View>

                        {pinError ? (
                            <Text style={[styles.modalInstructionText, { color: '#ff4444' }]}>{pinError}</Text>
                        ) : null}

                        <View style={styles.modalButtonContainer}>
                            <TouchableOpacity
                                style={[styles.modalButton, { opacity: isPinValidatingAuth ? 0.7 : 1 }]}
                                onPress={validatePinAndAuthenticate}
                                disabled={isPinValidatingAuth}
                            >
                                <Text style={styles.modalButtonText}>{isPinValidatingAuth ? 'Validating…' : 'Unlock'}</Text>
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
                                <MaterialIcons name="wallet-outline" size={50} color={Colors.gray} />
                                <Text style={styles.scanningText}>No wallets found on device</Text>
                                <Text style={styles.scanningSubtext}>Create a new wallet on your device to get started</Text>
                                <TouchableOpacity
                                    style={[styles.retryScanButton, isCreatingWallet && styles.retryScanButtonDisabled]}
                                    onPress={createNewWalletFromAuth}
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
                                        onPress={() => selectWalletFromAuth(w)}
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

            {/* Morse Code Change Modal */}
            <Modal
                visible={showMorseChangeModal}
                animationType="slide"
                transparent={true}
                onRequestClose={cancelMorseChange}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Change Emergency Code</Text>
                            <TouchableOpacity onPress={cancelMorseChange} style={styles.modalCloseButton}>
                                <Text style={styles.modalCloseText}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.modalInstructionText}>
                            Enter a new morse code sequence for emergency wipe functionality. Use dots (•) and dashes (—) to create your unique sequence.
                        </Text>

                        {/* New Morse Code Input */}
                        <View style={styles.inputContainer}>
                            <Text style={styles.inputLabel}>New Morse Code</Text>
                            <TextInput
                                value={newMorseInput}
                                onChangeText={setNewMorseInput}
                                placeholder="e.g., •••—••"
                                placeholderTextColor={Colors.gray}
                                style={styles.morseInput}
                            />
                        </View>

                        {/* Confirm Morse Code Input */}
                        <View style={styles.inputContainer}>
                            <Text style={styles.inputLabel}>Confirm Morse Code</Text>
                            <TextInput
                                value={confirmMorseInput}
                                onChangeText={setConfirmMorseInput}
                                placeholder="e.g., •••—••"
                                placeholderTextColor={Colors.gray}
                                style={styles.morseInput}
                            />
                        </View>

                        {morseError ? (
                            <Text style={[styles.modalInstructionText, { color: '#ff4444' }]}>{morseError}</Text>
                        ) : null}

                        <View style={styles.modalButtonContainer}>
                            <TouchableOpacity
                                style={[styles.modalButton, { opacity: isMorseValidating ? 0.7 : 1 }]}
                                onPress={validateAndChangeMorse}
                                disabled={isMorseValidating}
                            >
                                <Text style={styles.modalButtonText}>
                                    {isMorseValidating ? 'Changing Code...' : 'Change Code'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <CustomAlert
                visible={showPasswordMismatchAlert}
                title="Password Mismatch"
                message="The passwords you entered do not match. Please try again and make sure both passwords are identical."
                buttons={[
                    {
                        text: "OK",
                        onPress: () => setShowPasswordMismatchAlert(false),
                    },
                ]}
                onRequestClose={() => setShowPasswordMismatchAlert(false)}
            />

            <CustomAlert
                visible={showPasswordSuccessAlert}
                title="Password Changed Successfully"
                message="Your device password has been updated successfully. The new password will be used for all future authentication."
                buttons={[
                    {
                        text: "OK",
                        onPress: () => setShowPasswordSuccessAlert(false),
                    },
                ]}
                onRequestClose={() => setShowPasswordSuccessAlert(false)}
            />

            <CustomAlert
                visible={showWalletLimitAlert}
                title="Wallet Limit Reached"
                message="You have reached the maximum number of wallets (3) for this device. Please delete an existing wallet before creating a new one."
                buttons={[
                    {
                        text: "OK",
                        onPress: () => setShowWalletLimitAlert(false),
                    },
                ]}
                onRequestClose={() => setShowWalletLimitAlert(false)}
            />

            <CustomAlert
                visible={showWalletCreatedAlert}
                title="Wallet Created Successfully"
                message="Your new wallet has been created on the device successfully. You can now use it for transactions."
                buttons={[
                    {
                        text: "OK",
                        onPress: () => setShowWalletCreatedAlert(false),
                    },
                ]}
                onRequestClose={() => setShowWalletCreatedAlert(false)}
            />

            <CustomAlert
                visible={alertConfig.title !== undefined}
                title={alertConfig.title || ""}
                message={alertConfig.message || ""}
                buttons={alertConfig.buttons || []}
                onRequestClose={() => setAlertConfig({})}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.primary,
        paddingTop: StatusBar.currentHeight,
        paddingBottom: 100,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: Colors.lightGray,
    },
    headerTitle: {
        color: Colors.white,
        fontWeight: "bold",
        fontSize: 24,
        textAlign: "center",
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    section: {
        marginBottom: 30,
    },
    sectionTitle: {
        color: Colors.thickOrange,
        fontSize: 18,
        fontWeight: "bold",
        marginBottom: 15,
    },
    connectionCard: {
        backgroundColor: Colors.lightGray,
        borderRadius: 12,
        padding: 16,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    connectionInfo: {
        flex: 1,
    },
    connectionLabel: {
        color: Colors.white,
        fontSize: 16,
        fontWeight: "600",
        marginBottom: 4,
    },
    connectionStatus: {
        fontSize: 14,
        fontWeight: "500",
    },
    calibrationButtons: {
        gap: 12,
    },
    calibrationButton: {
        backgroundColor: Colors.lightGray,
        borderRadius: 12,
        paddingVertical: 14,
        paddingHorizontal: 20,
        alignItems: "center",
    },
    calibrationButtonActive: {
        backgroundColor: Colors.thickOrange,
    },
    calibrationButtonText: {
        color: Colors.white,
        fontSize: 16,
        fontWeight: "600",
    },
    calibrationButtonTextActive: {
        color: Colors.primary,
    },
    sliderContainer: {
        marginBottom: 20,
    },
    sliderHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 10,
    },
    sliderTitle: {
        color: Colors.white,
        fontSize: 16,
        fontWeight: "600",
    },
    valueBox: {
        backgroundColor: Colors.gray,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 4,
    },
    valueText: {
        color: Colors.white,
        fontSize: 14,
        fontWeight: "600",
    },
    sliderTrack: {
        height: 6,
        backgroundColor: Colors.lightGray,
        borderRadius: 3,
        position: "relative",
        marginBottom: 8,
        width: "100%",
    },
    sliderFill: {
        height: "100%",
        backgroundColor: Colors.thickOrange,
        borderRadius: 3,
    },
    sliderThumb: {
        position: "absolute",
        top: -4,
        width: 14,
        height: 14,
        backgroundColor: Colors.thickOrange,
        borderRadius: 7,
        borderWidth: 2,
        borderColor: Colors.white,
        marginLeft: -7,
    },
    sliderDescription: {
        color: Colors.gray,
        fontSize: 12,
        marginBottom: 8,
    },
    sliderControls: {
        flexDirection: "row",
        justifyContent: "space-between",
        gap: 8,
    },
    sliderButton: {
        backgroundColor: Colors.thickOrange,
        borderRadius: 8,
        paddingVertical: 8,
        paddingHorizontal: 12,
        flex: 1,
        alignItems: "center",
    },
    sliderButtonText: {
        color: Colors.primary,
        fontSize: 14,
        fontWeight: "bold",
    },
    feedbackOptions: {
        gap: 16,
    },
    feedbackOption: {
        backgroundColor: Colors.lightGray,
        borderRadius: 12,
        padding: 16,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    feedbackInfo: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    feedbackLabel: {
        color: Colors.white,
        fontSize: 16,
        fontWeight: "600",
    },
    setCodeButton: {
        backgroundColor: Colors.thickOrange,
        borderRadius: 12,
        paddingVertical: 16,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        marginBottom: 12,
    },
    setCodeButtonText: {
        color: Colors.primary,
        fontSize: 16,
        fontWeight: "bold",
    },
    setCodeButtonDisabled: {
        opacity: 0.7,
    },
    setCodeButtonTextDisabled: {
        color: Colors.gray,
    },
    disabledButton: {
        opacity: 0.7,
    },
    disabledButtonText: {
        color: Colors.gray,
    },
    deviceRequiredText: {
        color: Colors.gray,
        fontSize: 12,
        marginTop: 4,
    },
    codeStatusCard: {
        backgroundColor: Colors.lightGray,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
    },
    codeStatusLabel: {
        color: Colors.white,
        fontSize: 14,
        fontWeight: "600",
        marginBottom: 8,
    },
    codeStatusValue: {
        color: Colors.thickOrange,
        fontSize: 16,
        fontWeight: "bold",
        fontFamily: "monospace",
    },
    passwordStatusCard: {
        backgroundColor: Colors.lightGray,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
    },
    passwordStatusLabel: {
        color: Colors.white,
        fontSize: 14,
        fontWeight: "600",
        marginBottom: 8,
    },
    passwordStatusValue: {
        color: Colors.thickOrange,
        fontSize: 16,
        fontWeight: "bold",
    },
    emergencyButton: {
        backgroundColor: "#DC3545",
        borderRadius: 12,
        paddingVertical: 16,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        borderWidth: 1,
        borderColor: "#DC3545",
    },
    emergencyButtonText: {
        color: Colors.white,
        fontSize: 18,
        fontWeight: "bold",
    },
    emergencyButtonDisabled: {
        opacity: 0.7,
    },
    emergencyButtonTextDisabled: {
        color: Colors.gray,
    },
    morseModal: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.8)",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000,
    },
    morseModalContent: {
        backgroundColor: Colors.primary,
        borderRadius: 20,
        padding: 24,
        margin: 20,
        alignItems: "center",
        minWidth: 300,
    },
    morseModalTitle: {
        color: Colors.white,
        fontSize: 20,
        fontWeight: "bold",
        marginBottom: 8,
    },
    morseModalSubtitle: {
        color: Colors.gray,
        fontSize: 14,
        textAlign: "center",
        marginBottom: 20,
    },
    morseInputDisplay: {
        backgroundColor: Colors.lightGray,
        borderRadius: 12,
        padding: 16,
        minWidth: 200,
        alignItems: "center",
        marginBottom: 20,
    },
    morseInputText: {
        color: Colors.thickOrange,
        fontSize: 18,
        fontWeight: "bold",
        fontFamily: "monospace",
    },
    morseButtons: {
        flexDirection: "row",
        gap: 15,
        marginBottom: 20,
    },
    morseButton: {
        backgroundColor: Colors.thickOrange,
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
    },
    morseButtonText: {
        color: Colors.primary,
        fontWeight: "bold",
        fontSize: 14,
    },
    morseModalButtons: {
        flexDirection: "row",
        gap: 12,
    },
    morseModalButton: {
        backgroundColor: Colors.gray,
        borderRadius: 8,
        paddingHorizontal: 20,
        paddingVertical: 10,
        minWidth: 80,
        alignItems: "center",
    },
    morseModalButtonConfirm: {
        backgroundColor: Colors.thickOrange,
    },
    morseModalButtonText: {
        color: Colors.white,
        fontWeight: "bold",
        fontSize: 14,
    },

    // Device Selection Modal Styles
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

    // PIN Change Modal Styles
    modalInstructionText: {
        fontSize: 16,
        color: Colors.white,
        textAlign: "center",
        marginBottom: 20,
        lineHeight: 22,
    },
    inputContainer: {
        marginBottom: 16,
    },
    inputLabel: {
        fontSize: 14,
        color: Colors.gray,
        marginBottom: 8,
        fontWeight: "500",
    },
    pinInput: {
        fontSize: 20,
        fontWeight: "bold",
        color: Colors.white,
        textAlign: "center",
        backgroundColor: Colors.lightGray,
        borderRadius: 10,
        padding: 15,
        borderWidth: 1,
        borderColor: Colors.gray,
    },
    modalButtonContainer: {
        alignItems: "center",
        marginTop: 20,
    },
    modalButton: {
        backgroundColor: Colors.thickOrange,
        paddingHorizontal: 32,
        paddingVertical: 12,
        borderRadius: 25,
        minWidth: 120,
        alignItems: "center",
    },
    modalButtonText: {
        fontSize: 16,
        fontWeight: "bold",
        color: Colors.white,
    },
    morseInput: {
        fontSize: 18,
        color: Colors.white,
        textAlign: "center",
        backgroundColor: Colors.lightGray,
        borderRadius: 10,
        padding: 15,
        borderWidth: 1,
        borderColor: Colors.gray,
        fontFamily: "monospace",
    },

    // Wallet Management Styles
    walletStatusCard: {
        backgroundColor: Colors.lightGray,
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
    },
    walletStatusLabel: {
        color: Colors.white,
        fontSize: 16,
        fontWeight: "600",
        marginBottom: 4,
    },
    walletStatusValue: {
        color: Colors.gray,
        fontSize: 14,
        fontWeight: "500",
    },
    walletList: {
        gap: 12,
        marginBottom: 16,
    },
    walletItem: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: Colors.lightGray,
        borderRadius: 12,
        padding: 16,
        borderWidth: 2,
        borderColor: "transparent",
    },
    walletItemSelected: {
        borderColor: Colors.thickOrange,
        backgroundColor: "rgba(244, 130, 80, 0.1)",
    },
    walletInfo: {
        flex: 1,
    },
    walletName: {
        color: Colors.white,
        fontSize: 16,
        fontWeight: "600",
        marginBottom: 4,
    },
    walletAddress: {
        color: Colors.gray,
        fontSize: 14,
        fontFamily: "monospace",
    },
    refreshButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "transparent",
        borderWidth: 1,
        borderColor: Colors.thickOrange,
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 20,
        marginTop: 8,
    },
    refreshButtonDisabled: {
        borderColor: Colors.gray,
    },
    refreshButtonText: {
        color: Colors.thickOrange,
        fontSize: 16,
        fontWeight: "600",
        marginLeft: 8,
    },
    refreshButtonTextDisabled: {
        color: Colors.gray,
    },
});

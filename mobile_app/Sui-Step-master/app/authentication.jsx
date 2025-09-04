import CustomAlert from "@/components/CustomAlert";
import Colors from "@/constants/Colors";
import { useGlobalState } from "@/contexts/GlobalStateProvider";
import BleService from "@/services/BleService";
import { Feather, MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useNavigation } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    Animated,
    Dimensions,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

const MORSE = {
    A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".",
    F: "..-.", G: "--.", H: "....", I: "..", J: ".---",
    K: "-.-", L: ".-..", M: "--", N: "-.", O: "---",
    P: ".--.", Q: "--.-", R: ".-.", S: "...", T: "-",
    U: "..-", V: "...-", W: ".--", X: "-..-", Y: "-.--",
    Z: "--.."
};

const CHALLENGE_WORDS = [
    "HELLO", "WORLD", "MORSE", "TAPES", "SHOES", "BLOCK", "CHAIN", "INPUT", "GUARD", "TRUST"
];

function wordToMorse(word) {
    return word
        .split("")
        .map((ch) => MORSE[ch.toUpperCase()] || "")
        .join(" ");
}

const SCREEN_WIDTH = Dimensions.get("window").width;

export const screenOptions = {
    headerShown: false,
};

export default function AuthenticationScreen() {
    const navigation = useNavigation();
    const params = useLocalSearchParams();

    const [challenge, setChallenge] = useState("");
    const [morse, setMorse] = useState("");
    const [timer, setTimer] = useState(60);
    const [attempts, setAttempts] = useState(0);
    const [progress] = useState(new Animated.Value(1));
    const [showAlert, setShowAlert] = useState(false);
    const [alertConfig, setAlertConfig] = useState({});
    const [isCompleted, setIsCompleted] = useState(false);
    const [realTimeInput, setRealTimeInput] = useState("");

    const [authStage, setAuthStage] = useState("challenge");
    const [savedMorseCode, setSavedMorseCode] = useState("");
    const [morseVerificationInput, setMorseVerificationInput] = useState("");
    const [deviceSavedMorseCode, setDeviceSavedMorseCode] = useState("");

    const [isSimulating, setIsSimulating] = useState(false);
    const [simulationProgress, setSimulationProgress] = useState(0);
    const [simulationTimer, setSimulationTimer] = useState(null);

    const [connectionStatus, setConnectionStatus] = useState({
        globalStateConnected: false,
        bleServiceConnected: false,
        bleServiceIsConnected: false,
        bleServiceDeviceName: null,
        isReady: false
    });

    const {
        isRealBleConnected,
        deviceConnected,
        authChallenge,
        authInProgress,
        authMorseInput,
        startAuthentication,
        completeAuthentication,
        signTransactionWithBle,
        currentTransaction,
        transactionSigning,
        devicePassword,
    } = useGlobalState();

    let transactionData = null;
    if (params && params.transactionData != null) {
        if (typeof params.transactionData === "string") {
            try {
                transactionData = JSON.parse(params.transactionData);
            } catch (_) {
                transactionData = params.transactionData;
            }
        } else {
            transactionData = params.transactionData;
        }
    }
    const recipient = params.recipient || "";
    const amount = parseFloat(params.amount) || 0;
    const gasFee = parseFloat(params.gasFee) || 0.01;
    const source = params.source || "";

    const isSystemReady = !!(deviceConnected || isRealBleConnected);
    const isConnectedForUI = isSystemReady || (BleService.device !== null);

    const checkConnectionStatus = async () => {
        const globalStateConnected = !!(deviceConnected || isRealBleConnected);
        const bleServiceStatus = await BleService.getConnectionStatus();

        console.log(`🔐 Auth: Connection Status Check:`);
        console.log(`  - deviceConnected: ${deviceConnected}`);
        console.log(`  - isRealBleConnected: ${isRealBleConnected}`);
        console.log(`  - globalStateConnected: ${globalStateConnected}`);
        console.log(`  - BleService Status:`, bleServiceStatus);

        const status = {
            globalStateConnected,
            bleServiceConnected: bleServiceStatus.device,
            bleServiceIsConnected: bleServiceStatus.isConnected,
            bleServiceDeviceName: bleServiceStatus.deviceName,
            isReady: globalStateConnected || bleServiceStatus.device || bleServiceStatus.isConnected
        };

        setConnectionStatus(status);
        return status;
    };

    useEffect(() => {
        console.log(`🔐 Auth: State Update - authStage: ${authStage}, authInProgress: ${authInProgress}, isCompleted: ${isCompleted}, authMorseInput: "${authMorseInput}"`);
    }, [authStage, authInProgress, isCompleted, authMorseInput]);

    useEffect(() => {
        console.log("🔐 Auth: Component mounted, checking connection state...");

        const timer = setTimeout(() => {
            console.log(`🔐 Auth: Initial connection check - isConnectedForUI: ${isConnectedForUI}`);
        }, 500);

        return () => clearTimeout(timer);
    }, []);

    const getSavedMorseCodeFromDevice = async () => {
        try {
            console.log("🔐 Auth: Requesting saved Morse code from device...");
            console.log(`🔐 Auth: Device state before Morse retrieval - BleService.device: ${BleService.device !== null}`);

            if (!BleService.device) {
                console.log("   Auth: No device connected for Morse code retrieval");
                return "";
            }

            const savedMorseCode = await BleService.getSavedMorseCode();
            console.log("🔐 Auth: Retrieved saved Morse code from device:", savedMorseCode);
            console.log(`🔐 Auth: Device state after Morse retrieval - BleService.device: ${BleService.device !== null}`);

            if (!savedMorseCode || savedMorseCode.trim() === "") {
                console.log("   Auth: No saved Morse code found on device");
                throw new Error("No Morse code found on device. Please complete wallet activation first.");
            }

            return savedMorseCode;

        } catch (error) {
            console.error("   Auth: Failed to get saved Morse code:", error);
            console.log(`🔐 Auth: Device state after Morse error - BleService.device: ${BleService.device !== null}`);
            throw error;
        }
    };

    useEffect(() => {
        console.log(`🔐 Auth: useEffect triggered - isConnectedForUI: ${isConnectedForUI}, authInProgress: ${authInProgress}, isCompleted: ${isCompleted}`);

        if (isConnectedForUI && !authInProgress && !isCompleted) {
            console.log("  Auth: Device is ready, initializing authentication");
            console.log(`🔐 Auth: Connection state before init - deviceConnected: ${deviceConnected}, isRealBleConnected: ${isRealBleConnected}, BleService.device: ${BleService.device !== null}`);
            initializeAuthentication();
        } else if (isConnectedForUI && authInProgress && !isCompleted) {
            console.log("  Auth: Authentication in progress, continuing...");
        } else {
            console.log(`   Auth: Device not ready or authentication completed - isConnectedForUI: ${isConnectedForUI}, authInProgress: ${authInProgress}, isCompleted: ${isCompleted}`);
        }
    }, [isConnectedForUI, authInProgress]);

    useEffect(() => {
        if (authInProgress && !isConnectedForUI) {
            console.log("   Auth: Device disconnected during authentication");
            completeAuthentication();
            showErrorAlert(
                "Device Disconnected",
                "Your device was disconnected during authentication. Please reconnect and try again.",
                [{ text: "OK", onPress: () => navigation.goBack() }]
            );
        }
    }, [isConnectedForUI, authInProgress, completeAuthentication, navigation]);

    useEffect(() => {
        return () => {
            if (authInProgress) {
                completeAuthentication();
            }
        };
    }, [authInProgress, completeAuthentication]);

    const forceRefreshConnection = () => {
        console.log("🔄 Auth: Force refreshing connection status...");
        console.log(`🔐 Auth: Current state - deviceConnected: ${deviceConnected}, isRealBleConnected: ${isRealBleConnected}, isConnectedForUI: ${isConnectedForUI}`);

        if (isConnectedForUI && !authInProgress) {
            console.log("  Auth: Connection confirmed, re-initializing authentication");
            initializeAuthentication();
        } else {
            console.log("   Auth: No connection detected, showing error");
            showErrorAlert("No Device Found", "No SuiStep device is currently connected. Please ensure your device is turned on and connected via Bluetooth.", [
                { text: "Try Again", onPress: forceRefreshConnection },
                { text: "Go Back", onPress: () => navigation.goBack() }
            ]);
        }
    };

    const simulateMorseEntry = async (expectedMorse, stage) => {
        console.log(`🧪 Auth: Starting ${stage} simulation for Morse: ${expectedMorse}`);
        setIsSimulating(true);
        setSimulationProgress(0);

        const cleanMorse = expectedMorse.replace(/\s/g, "");
        let currentInput = "";
        let currentIndex = 0;

        const totalTime = 5000;
        const interval = totalTime / cleanMorse.length;

        const simulationInterval = setInterval(() => {
            if (currentIndex < cleanMorse.length) {
                const nextChar = cleanMorse[currentIndex];
                currentInput += nextChar;
                currentIndex++;

                const progress = (currentIndex / cleanMorse.length) * 100;
                setSimulationProgress(progress);

                if (stage === "challenge") {
                    setRealTimeInput(currentInput);
                } else if (stage === "verification") {
                    setMorseVerificationInput(currentInput);
                }

                console.log(`🧪 Auth: ${stage} simulation progress: ${currentIndex}/${cleanMorse.length} - Input: ${currentInput}`);
            } else {
                clearInterval(simulationInterval);
                setIsSimulating(false);
                setSimulationProgress(100);
                console.log(`🧪 Auth: ${stage} simulation completed`);

                if (stage === "challenge") {
                    handleChallengeSuccess();
                } else if (stage === "verification") {
                    handleAuthenticationSuccess();
                }
            }
        }, interval);

        setSimulationTimer(simulationInterval);
    };

    const initializeAuthentication = async () => {
        try {
            const randomChallenge = CHALLENGE_WORDS[Math.floor(Math.random() * CHALLENGE_WORDS.length)];
            setChallenge(randomChallenge);
            setMorse(wordToMorse(randomChallenge));

            console.log(`🔐 Auth: Challenge generated: ${randomChallenge}`);
            console.log(`🔐 Auth: Expected Morse (with spaces): ${wordToMorse(randomChallenge)}`);
            console.log(`🔐 Auth: Expected Morse (no spaces): ${wordToMorse(randomChallenge).replace(/\s/g, "")}`);

            if (!isConnectedForUI) {
                console.log("   Auth: Device not connected, cannot initialize authentication");
                return;
            }

            let deviceMorseCode = "";
            let retryCount = 0;
            const maxRetries = 3;

            while (retryCount < maxRetries) {
                try {
                    console.log(`🔐 Auth: Attempt ${retryCount + 1} to get saved Morse code...`);
                    deviceMorseCode = await getSavedMorseCodeFromDevice();
                    setDeviceSavedMorseCode(deviceMorseCode);
                    console.log(`🔐 Auth: Device saved Morse code: ${deviceMorseCode}`);
                    break;
                } catch (error) {
                    retryCount++;
                    console.error(`   Auth: Failed to get saved Morse code (attempt ${retryCount}):`, error);

                    if (retryCount >= maxRetries) {
                        console.error("   Auth: Max retries reached, showing error");
                        showErrorAlert(
                            "Wallet Not Activated",
                            "No activation code found on device. Please complete wallet activation in the onboarding process first.",
                            [
                                { text: "Retry", onPress: () => initializeAuthentication() },
                                { text: "Go Back", onPress: () => navigation.goBack() }
                            ]
                        );
                        return;
                    } else {
                        console.log(`🔐 Auth: Waiting 1 second before retry ${retryCount + 1}...`);
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }
            }

            await startAuthentication(randomChallenge);
            console.log("📡 Auth: Challenge sent to ESP32 device");

            setTimeout(() => {
                simulateMorseEntry(wordToMorse(randomChallenge).replace(/\s/g, ""), "challenge");
            }, 1000);

        } catch (error) {
            console.error("   Auth: Failed to initialize authentication:", error);
            showErrorAlert("Authentication Error", "Failed to initialize authentication. Please try again.");
        }
    };

    useEffect(() => {
        console.log(`🔐 Auth: Challenge monitoring - authInProgress: ${authInProgress}, authMorseInput: "${authMorseInput}", authStage: ${authStage}, isCompleted: ${isCompleted}`);

        if (authInProgress && authMorseInput && authStage === "challenge" && !isCompleted) {
            setRealTimeInput(authMorseInput);
            console.log("📡 Auth: BLE Morse input received for challenge:", authMorseInput);
            console.log(`🔐 Auth: Current stage: ${authStage}, authInProgress: ${authInProgress}, isCompleted: ${isCompleted}`);

            const expectedMorse = morse.replace(/\s/g, "");
            const inputMorse = authMorseInput.replace(/\s/g, "");

            console.log(`🔐 Auth: Morse comparison - Expected: "${expectedMorse}", Input: "${inputMorse}"`);

            if (inputMorse === expectedMorse) {
                console.log("  Auth: Morse code match! Proceeding to verification stage");
                handleChallengeSuccess();
            } else if (inputMorse.length >= expectedMorse.length) {
                console.log("   Auth: Morse code mismatch! Expected length reached");
                handleAuthenticationFailure();
            }
        }
    }, [authMorseInput, morse, authInProgress, authStage, isCompleted]);

    useEffect(() => {
        console.log(`🔐 Auth: Verification monitoring - authInProgress: ${authInProgress}, authMorseInput: "${authMorseInput}", authStage: ${authStage}, isCompleted: ${isCompleted}`);

        if (authInProgress && authMorseInput && authStage === "morse_verification" && !isCompleted) {
            setMorseVerificationInput(authMorseInput);
            console.log("📡 Auth: BLE Morse input received for verification:", authMorseInput);
            console.log(`🔐 Auth: Current stage: ${authStage}, authInProgress: ${authInProgress}, isCompleted: ${isCompleted}`);

            const expectedMorse = deviceSavedMorseCode.replace(/\s/g, "");
            const inputMorse = authMorseInput.replace(/\s/g, "");

            console.log(`🔐 Auth: Verification Morse comparison - Expected: "${expectedMorse}", Input: "${inputMorse}"`);

            if (inputMorse === expectedMorse) {
                console.log("  Auth: Verification Morse code match! Authentication successful");
                handleAuthenticationSuccess();
            } else if (inputMorse.length >= expectedMorse.length) {
                console.log("   Auth: Verification Morse code mismatch! Expected length reached");
                handleAuthenticationFailure();
            }
        }
    }, [authMorseInput, deviceSavedMorseCode, authInProgress, authStage, isCompleted]);

    useEffect(() => {
        if (!isConnectedForUI && authInProgress && authStage === "challenge" && !isCompleted) {
            console.log("   Auth: Demo mode not supported for challenge stage");
            showErrorAlert(
                "Real Device Required",
                "Authentication requires a real SuiStep device connection. Please connect your device and try again.",
                [{ text: "Go Back", onPress: () => navigation.goBack() }]
            );
        }
    }, [authInProgress, authStage, isCompleted, isConnectedForUI]);

    useEffect(() => {
        if (!isConnectedForUI && authInProgress && authStage === "morse_verification" && !isCompleted) {
            console.log("   Auth: Demo mode not supported for verification stage");
            showErrorAlert(
                "Real Device Required",
                "Verification requires a real SuiStep device connection. Please connect your device and try again.",
                [{ text: "Go Back", onPress: () => navigation.goBack() }]
            );
        }
    }, [authInProgress, authStage, isCompleted, isConnectedForUI]);

    useEffect(() => {
        if (timer > 0 && authInProgress && !isCompleted) {
            const interval = setInterval(() => {
                setTimer((prev) => {
                    const newTimer = prev - 1;

                    Animated.timing(progress, {
                        toValue: newTimer / 60,
                        duration: 1000,
                        useNativeDriver: false,
                    }).start();

                    if (newTimer === 0) {
                        handleTimeout();
                    }

                    return newTimer;
                });
            }, 1000);

            return () => clearInterval(interval);
        }
    }, [timer, authInProgress]);

    useEffect(() => {
        return () => {
            if (simulationTimer) {
                clearInterval(simulationTimer);
            }
        };
    }, [simulationTimer]);

    const handleChallengeSuccess = async () => {
        try {
            console.log("  Auth: Challenge completed successfully!");
            console.log(`🔐 Auth: Transitioning from stage: ${authStage} to morse_verification`);

            setSavedMorseCode(realTimeInput);
            console.log(`🔐 Auth: Saved Morse code for verification: ${realTimeInput}`);

            setAuthStage("morse_verification");
            setMorseVerificationInput("");
            setRealTimeInput("");
            setTimer(60);

            console.log("🔐 Auth: Clearing global authMorseInput for verification stage");

            await startAuthentication("VERIFY");
            console.log("🔐 Auth: Verification stage initiated");

            setTimeout(() => {
                simulateMorseEntry(deviceSavedMorseCode.replace(/\s/g, ""), "verification");
            }, 1000);

        } catch (error) {
            console.error("   Auth: Error during challenge success:", error);
            showErrorAlert("Authentication Error", "Challenge completed but failed to proceed to verification.");
        }
    };

    const handleAuthenticationSuccess = async () => {
        try {
            console.log("  Auth: Final authentication successful!");
            console.log(`🔐 Auth: Current stage: ${authStage}, isCompleted: ${isCompleted}`);

            setIsCompleted(true);
            completeAuthentication();

            await new Promise(resolve => setTimeout(resolve, 100));

            if (transactionData && isConnectedForUI) {
                console.log("🔐 Auth: Proceeding to BLE transaction signing...");
                await signTransactionWithBle(transactionData);

                navigation.replace('transactionconfirmation', {
                    transactionData: JSON.stringify(transactionData),
                    recipient: recipient,
                    amount: amount.toString(),
                    gasFee: gasFee.toString(),
                    authMethod: 'BLE',
                    challenge: challenge,
                });
            }

        } catch (error) {
            console.error("   Auth: Error during authentication success:", error);
            showErrorAlert("Transaction Error", "Authentication succeeded but failed to process transaction.");
        }
    };

    const handleAuthenticationFailure = () => {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        setRealTimeInput("");
        setMorseVerificationInput("");

        setTimer(Math.max(timer - 10, 5));

        if (newAttempts >= 5) {
            showErrorAlert(
                "Security Alert",
                "Too many failed attempts. Returning to home for security.",
                [{ text: "OK", onPress: () => navigation.navigate("(tabs)") }]
            );
        } else {
            showErrorAlert(
                "Authentication Failed",
                `Incorrect Morse code sequence. ${5 - newAttempts} attempts remaining.`,
                [{ text: "Try Again", onPress: resetForRetry }]
            );
        }
    };

    const handleTimeout = () => {
        setIsCompleted(true);
        completeAuthentication();

        showErrorAlert(
            "Authentication Timeout",
            "Authentication timed out. Please try again.",
            [{ text: "OK", onPress: () => navigation.goBack() }]
        );
    };

    const resetForRetry = async () => {
        setRealTimeInput("");
        setMorseVerificationInput("");
        setAuthStage("challenge");
        await initializeAuthentication();
    };

    const showErrorAlert = (title, message, buttons = [{ text: "OK", onPress: () => setShowAlert(false) }]) => {
        setAlertConfig({ title, message, buttons });
        setShowAlert(true);
    };

    const handleCancel = () => {
        completeAuthentication();
        navigation.goBack();
    };

    const getCurrentInput = () => {
        if (authStage === "challenge") {
            return realTimeInput;
        } else {
            return morseVerificationInput;
        }
    };

    const getCurrentExpectedMorse = () => {
        if (authStage === "challenge") {
            return morse;
        } else {
            return deviceSavedMorseCode;
        }
    };

    const clearCurrentInput = () => {
        if (authStage === "challenge") {
            setRealTimeInput("");
            console.log("🔐 Auth: Cleared challenge input");
        } else {
            setMorseVerificationInput("");
            console.log("🔐 Auth: Cleared verification input");
        }
    };

    const shouldShowNoSystemUI = !isConnectedForUI;

    if (shouldShowNoSystemUI) {
        return (
            <View style={styles.container}>
                <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />

                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Feather name="arrow-left" size={28} color={Colors.white} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Authentication</Text>
                    <View style={{ width: 28 }} />
                </View>

                <View style={styles.noSystemContainer}>
                    <MaterialIcons
                        name="bluetooth-disabled"
                        size={80}
                        color={Colors.gray}
                    />
                    <Text style={styles.noSystemTitle}>
                        No Device Connected
                    </Text>
                    <Text style={styles.noSystemMessage}>
                        Connect your SuiStep device to enable secure authentication.
                    </Text>

                    <View style={styles.debugContainer}>
                        <Text style={styles.debugText}>
                            Debug Info:
                        </Text>
                        <Text style={styles.debugText}>
                            deviceConnected: {deviceConnected ? 'true' : 'false'}
                        </Text>
                        <Text style={styles.debugText}>
                            isRealBleConnected: {isRealBleConnected ? 'true' : 'false'}
                        </Text>
                        <Text style={styles.debugText}>
                            isSystemReady: {isSystemReady ? 'true' : 'false'}
                        </Text>
                        <Text style={styles.debugText}>
                            BleService.device: {BleService.device !== null ? 'exists' : 'null'}
                        </Text>
                        <Text style={styles.debugText}>
                            isConnectedForUI: {isConnectedForUI ? 'true' : 'false'}
                        </Text>
                        <Text style={styles.debugText}>
                            Device Name: {connectionStatus.bleServiceDeviceName || 'N/A'}
                        </Text>

                        <TouchableOpacity
                            style={styles.refreshDebugButton}
                            onPress={async () => {
                                console.log("🔐 Auth: Manual refresh triggered");
                                console.log(`🔐 Auth: Current state - isConnectedForUI: ${isConnectedForUI}`);
                            }}
                        >
                            <Text style={styles.refreshDebugButtonText}>Refresh Debug Info</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.refreshDebugButton, { backgroundColor: Colors.thickOrange, marginTop: 8 }]}
                            onPress={async () => {
                                console.log("🔐 Auth: Force connect triggered");
                                if (isConnectedForUI && !authInProgress) {
                                    console.log("🔐 Auth: Force initializing authentication...");
                                    initializeAuthentication();
                                } else {
                                    console.log("🔐 Auth: Cannot force connect - not ready or already in progress");
                                }
                            }}
                        >
                            <Text style={styles.refreshDebugButtonText}>Force Connect & Initialize</Text>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        style={styles.connectButton}
                        onPress={() => navigation.navigate("(tabs)")}
                    >
                        <MaterialIcons
                            name="bluetooth"
                            size={24}
                            color={Colors.primary}
                        />
                        <Text style={styles.connectButtonText}>
                            Connect Device
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />

            <View style={styles.header}>
                <TouchableOpacity onPress={handleCancel}>
                    <Feather name="arrow-left" size={28} color={Colors.white} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Authentication</Text>
                <TouchableOpacity onPress={handleCancel}>
                    <MaterialIcons name="close" size={28} color={Colors.white} />
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.connectionStatus}>
                    <View style={styles.statusRow}>
                        <MaterialIcons
                            name={isConnectedForUI ? "bluetooth-connected" : "bluetooth-disabled"}
                            size={20}
                            color={isConnectedForUI ? Colors.thickOrange : Colors.gray}
                        />
                        <Text style={styles.statusText}>
                            {isConnectedForUI ? "SuiStep Device Connected" : "No Device Connected"}
                        </Text>
                        <TouchableOpacity onPress={forceRefreshConnection} style={styles.refreshButton}>
                            <MaterialIcons name="refresh" size={16} color={Colors.gray} />
                        </TouchableOpacity>
                    </View>
                    {transactionSigning && (
                        <View style={styles.statusRow}>
                            <MaterialIcons name="security" size={20} color={Colors.thickOrange} />
                            <Text style={styles.statusText}>Transaction Signing in Progress...</Text>
                        </View>
                    )}
                    <View style={styles.statusRow}>
                        <Text style={[styles.statusText, { fontSize: 12, color: Colors.gray }]}>
                            Debug: deviceConnected={deviceConnected ? 'true' : 'false'}, isRealBleConnected={isRealBleConnected ? 'true' : 'false'}, isConnectedForUI={isConnectedForUI ? 'true' : 'false'}
                        </Text>
                    </View>
                </View>

                <View style={styles.securityCard}>
                    <MaterialIcons name="security" size={32} color={Colors.thickOrange} />
                    <Text style={styles.securityTitle}>Secure Authentication</Text>
                    <Text style={styles.securityMessage}>
                        {authStage === "challenge"
                            ? "Tap the challenge word on your SuiStep device using Morse code."
                            : "Now verify your saved Morse code gesture on the device."
                        }
                    </Text>
                </View>

                <View style={styles.challengeCard}>
                    <Text style={styles.challengeLabel}>
                        {authStage === "challenge" ? "Authentication Challenge" : "Morse Code Verification"}
                    </Text>
                    {authStage === "challenge" ? (
                        <>
                            <Text style={styles.challengeWord}>{challenge}</Text>
                            <Text style={styles.challengeMorse}>{morse}</Text>
                        </>
                    ) : (
                        <>
                            <Text style={styles.challengeWord}>VERIFICATION</Text>
                            <Text style={styles.challengeMorse}>{deviceSavedMorseCode}</Text>
                            <Text style={styles.savedMorseLabel}>Enter your saved Morse code: {deviceSavedMorseCode}</Text>
                        </>
                    )}
                </View>

                <View style={styles.progressSection}>
                    <View style={styles.progressHeader}>
                        <Text style={styles.progressLabel}>Time Remaining</Text>
                        <Text style={styles.timerText}>{timer}s</Text>
                    </View>
                    <View style={styles.progressTrack}>
                        <Animated.View
                            style={[
                                styles.progressFill,
                                {
                                    width: progress.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: ['0%', '100%'],
                                    }),
                                    backgroundColor: timer > 20 ? Colors.thickOrange : timer > 10 ? '#FFA500' : '#FF4444',
                                },
                            ]}
                        />
                    </View>
                </View>

                {!isCompleted && (
                    <View style={styles.onscreenSection}>
                        <Text style={styles.onscreenLabel}>
                            {authStage === "challenge"
                                ? "Enter Challenge Morse Code"
                                : "Enter Your Saved Morse Code"
                            }
                        </Text>

                        {isSimulating && (
                            <View style={styles.simulationContainer}>
                                <Text style={styles.simulationTitle}>
                                    🧪 Simulating Morse Code Entry
                                </Text>
                                <View style={styles.progressBarContainer}>
                                    <View style={styles.progressBar}>
                                        <View
                                            style={[
                                                styles.simulationProgressFill,
                                                { width: `${simulationProgress}%` }
                                            ]}
                                        />
                                    </View>
                                    <Text style={styles.progressText}>
                                        {Math.round(simulationProgress)}%
                                    </Text>
                                </View>
                                <Text style={styles.simulationSubtext}>
                                    Simulating pressure input from SuiStep device...
                                </Text>
                            </View>
                        )}

                        {!isSimulating && (
                            <View style={styles.inputProgressIndicator}>
                                <Text style={styles.inputProgressText}>
                                    Progress: {getCurrentInput().replace(/\s/g, "").length} / {getCurrentExpectedMorse().replace(/\s/g, "").length}
                                </Text>
                            </View>
                        )}
                    </View>
                )}

                {transactionData && (
                    <View style={styles.transactionCard}>
                        <Text style={styles.transactionTitle}>Transaction to Authorize</Text>
                        <View style={styles.transactionRow}>
                            <Text style={styles.transactionLabel}>Amount:</Text>
                            <Text style={styles.transactionValue}>{amount} SUI</Text>
                        </View>
                        <View style={styles.transactionRow}>
                            <Text style={styles.transactionLabel}>Recipient:</Text>
                            <Text style={styles.transactionValue}>
                                {recipient.slice(0, 6)}...{recipient.slice(-4)}
                            </Text>
                        </View>
                        <View style={styles.transactionRow}>
                            <Text style={styles.transactionLabel}>Gas Fee:</Text>
                            <Text style={styles.transactionValue}>{gasFee} SUI</Text>
                        </View>
                    </View>
                )}

                <View style={styles.statusMessages}>
                    {authInProgress && (
                        <Text style={styles.statusMessage}>
                            🔐 Authentication in progress...
                        </Text>
                    )}
                    {transactionSigning && (
                        <Text style={styles.statusMessage}>
                            ✍️ Signing transaction on device...
                        </Text>
                    )}
                    {attempts > 0 && (
                        <Text style={styles.warningMessage}>
                            Failed attempts: {attempts}/5
                        </Text>
                    )}
                    {authStage === "morse_verification" && (
                        <Text style={styles.statusMessage}>
                            🔐 Verification stage - enter your saved Morse code
                        </Text>
                    )}
                </View>
            </ScrollView>

            <CustomAlert
                visible={showAlert}
                title={alertConfig.title}
                message={alertConfig.message}
                buttons={alertConfig.buttons}
                onRequestClose={() => setShowAlert(false)}
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
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    noSystemContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 40,
    },
    noSystemTitle: {
        color: Colors.white,
        fontSize: 24,
        fontWeight: "bold",
        marginTop: 20,
        textAlign: "center",
    },
    noSystemMessage: {
        color: Colors.gray,
        fontSize: 16,
        marginTop: 10,
        textAlign: "center",
        lineHeight: 22,
    },
    connectButton: {
        backgroundColor: Colors.thickOrange,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
        marginTop: 30,
        gap: 8,
    },
    connectButtonText: {
        color: Colors.primary,
        fontSize: 16,
        fontWeight: "bold",
    },
    connectionStatus: {
        backgroundColor: Colors.lightGray,
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
    },
    statusRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginBottom: 4,
    },
    statusText: {
        color: Colors.white,
        fontSize: 14,
        fontWeight: "500",
        flex: 1,
    },
    refreshButton: {
        padding: 5,
    },
    securityCard: {
        backgroundColor: Colors.lightGray,
        borderRadius: 12,
        padding: 20,
        alignItems: "center",
        marginBottom: 20,
    },
    securityTitle: {
        color: Colors.white,
        fontSize: 20,
        fontWeight: "bold",
        marginTop: 12,
        marginBottom: 8,
    },
    securityMessage: {
        color: Colors.gray,
        fontSize: 14,
        textAlign: "center",
        lineHeight: 20,
    },
    challengeCard: {
        backgroundColor: Colors.lightGray,
        borderRadius: 12,
        padding: 20,
        alignItems: "center",
        marginBottom: 20,
    },
    challengeLabel: {
        color: Colors.gray,
        fontSize: 16,
        marginBottom: 8,
    },
    challengeWord: {
        color: Colors.white,
        fontSize: 32,
        fontWeight: "bold",
        letterSpacing: 8,
        marginBottom: 12,
    },
    challengeMorse: {
        color: Colors.thickOrange,
        fontSize: 18,
        fontFamily: "monospace",
        letterSpacing: 2,
    },
    savedMorseLabel: {
        color: Colors.gray,
        fontSize: 14,
        marginTop: 8,
        fontFamily: "monospace",
    },
    progressSection: {
        marginBottom: 20,
    },
    progressHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8,
    },
    progressLabel: {
        color: Colors.white,
        fontSize: 16,
        fontWeight: "600",
    },
    timerText: {
        color: Colors.thickOrange,
        fontSize: 18,
        fontWeight: "bold",
    },
    progressTrack: {
        height: 8,
        backgroundColor: Colors.lightGray,
        borderRadius: 4,
        overflow: "hidden",
    },
    progressFill: {
        height: "100%",
        borderRadius: 4,
    },
    inputSection: {
        marginBottom: 20,
    },
    inputLabel: {
        color: Colors.white,
        fontSize: 16,
        fontWeight: "600",
        marginBottom: 8,
    },
    inputDisplay: {
        backgroundColor: Colors.lightGray,
        borderRadius: 12,
        padding: 16,
        minHeight: 60,
        justifyContent: "center",
        alignItems: "center",
    },
    inputText: {
        color: Colors.thickOrange,
        fontSize: 20,
        fontFamily: "monospace",
        textAlign: "center",
        letterSpacing: 2,
    },
    inputProgress: {
        alignItems: "center",
        marginTop: 8,
    },
    inputProgressText: {
        color: Colors.gray,
        fontSize: 14,
    },
    onscreenSection: {
        marginBottom: 20,
        backgroundColor: Colors.lightGray,
        borderRadius: 12,
        padding: 16,
    },
    onscreenLabel: {
        color: Colors.white,
        fontSize: 16,
        fontWeight: "600",
        textAlign: "center",
        marginBottom: 8,
    },
    onscreenSubLabel: {
        color: Colors.thickOrange,
        fontSize: 14,
        fontFamily: "monospace",
        textAlign: "center",
        marginBottom: 16,
        letterSpacing: 1,
    },
    clearButton: {
        backgroundColor: Colors.gray,
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
        alignItems: "center",
    },
    clearButtonText: {
        color: Colors.white,
        fontSize: 14,
        fontWeight: "600",
    },
    onscreenControls: {
        flexDirection: "row",
        justifyContent: "center",
        gap: 12,
        marginTop: 12,
    },
    inputProgressIndicator: {
        marginTop: 16,
        padding: 12,
        backgroundColor: Colors.primary,
        borderRadius: 8,
        alignItems: "center",
    },
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
    simulationProgressFill: {
        height: "100%",
        backgroundColor: Colors.thickOrange,
        borderRadius: 4,
    },
    progressText: {
        color: Colors.white,
        fontSize: 14,
        fontWeight: "600",
        textAlign: "center",
        marginTop: 8,
    },
    simulationSubtext: {
        color: Colors.gray,
        fontSize: 12,
        textAlign: "center",
    },
    transactionCard: {
        backgroundColor: Colors.lightGray,
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
    },
    transactionTitle: {
        color: Colors.white,
        fontSize: 16,
        fontWeight: "bold",
        marginBottom: 12,
        textAlign: "center",
    },
    transactionRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 8,
    },
    transactionLabel: {
        color: Colors.gray,
        fontSize: 14,
    },
    transactionValue: {
        color: Colors.white,
        fontSize: 14,
        fontWeight: "600",
    },
    statusMessages: {
        alignItems: "center",
        marginBottom: 40,
    },
    statusMessage: {
        color: Colors.thickOrange,
        fontSize: 14,
        textAlign: "center",
        marginBottom: 8,
    },
    warningMessage: {
        color: Colors.emergency,
        fontSize: 14,
        textAlign: "center",
        marginBottom: 8,
    },
    debugContainer: {
        backgroundColor: Colors.lightGray,
        borderRadius: 8,
        padding: 10,
        marginTop: 15,
        alignSelf: 'center',
        width: '90%',
    },
    debugText: {
        color: Colors.white,
        fontSize: 12,
        textAlign: 'left',
        marginBottom: 2,
    },
    refreshDebugButton: {
        backgroundColor: Colors.thickOrange,
        paddingVertical: 8,
        paddingHorizontal: 15,
        borderRadius: 6,
        alignSelf: 'center',
        marginTop: 10,
    },
    refreshDebugButtonText: {
        color: Colors.primary,
        fontSize: 12,
        fontWeight: 'bold',
    },
});
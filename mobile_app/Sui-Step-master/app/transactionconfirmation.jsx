import CustomAlert from "@/components/CustomAlert";
import Colors from "@/constants/Colors";
import { useGlobalState } from "@/contexts/GlobalStateProvider";
import { useMorseTransaction } from "@/hooks/useMorseTransaction";
import BleService from "@/services/BleService";
import { Feather, MaterialIcons } from "@expo/vector-icons";
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { toBase64 } from "@mysten/sui/utils";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useNavigation } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

export const screenOptions = {
    headerShown: false,
};

export default function TransactionConfirmationScreen() {
    const navigation = useNavigation();
    const params = useLocalSearchParams();

    const {
        deviceConnected,
        isRealBleConnected,
        transactionSigning,
        currentTransaction,
        authChallenge,
        authMorseInput,
        walletAddress,
        setWalletAddress,
    } = useGlobalState();

    const {
        morseInput,
        isVerifying,
        verificationResult,
        verifyGestureOnDevice,
        clearMorseInput,
    } = useMorseTransaction();

    const {
        recipient,
        amount,
        gasFee,
        authMethod,
        challenge,
        transactionData
    } = params;

    const rpcUrl = getFullnodeUrl('testnet');
    const client = new SuiClient({ url: rpcUrl });

    const numericAmount = parseFloat(amount) || 0;
    const numericGasFee = parseFloat(gasFee) || 0.01;
    const totalAmount = numericAmount + numericGasFee;
    const parsedTransactionData = transactionData ? JSON.parse(transactionData) : null;

    const [status, setStatus] = useState("processing");
    const [substatus, setSubstatus] = useState("");
    const [transactionHash, setTransactionHash] = useState("");
    const [explorerUrl, setExplorerUrl] = useState("");
    const [alertVisible, setAlertVisible] = useState(false);
    const [alertConfig, setAlertConfig] = useState({ title: "", message: "", buttons: [] });
    const [processingSteps, setProcessingSteps] = useState([]);
    const [currentStep, setCurrentStep] = useState(0);

    const steps = [
        {
            id: 'auth',
            title: 'Authentication Complete',
            description: `Challenge "${challenge}" verified`,
            icon: 'verified-user',
            completed: true
        },
        {
            id: 'signing',
            title: 'Transaction Signing',
            description: 'Signing on SuiStep device...',
            icon: 'edit',
            completed: false
        },
        {
            id: 'broadcasting',
            title: 'Broadcasting to Network',
            description: 'Submitting to Sui blockchain...',
            icon: 'broadcast',
            completed: false
        },
        {
            id: 'confirmation',
            title: 'Transaction Confirmed',
            description: 'Transaction successfully processed',
            icon: 'check-circle',
            completed: false
        }
    ];

    useEffect(() => {
        setProcessingSteps(steps);
        startTransactionProcessing();
    }, []);

    useEffect(() => {
        if (transactionSigning && status === "processing") {
            console.log("    TxConfirm: Transaction signing in progress...");
        }
    }, [transactionSigning, status]);

    const startTransactionProcessing = async () => {
        try {
            console.log("    TxConfirm: Starting transaction processing...");
            setStatus("processing");
            setSubstatus("Preparing transaction...");
            setCurrentStep(1);

            await new Promise(resolve => setTimeout(resolve, 100));

            console.log("    TxConfirm: After delay - deviceConnected:", deviceConnected, "isRealBleConnected:", isRealBleConnected);

            const isSystemReady = !!(deviceConnected || isRealBleConnected);
            console.log("    TxConfirm: Connection check - deviceConnected:", deviceConnected, "isRealBleConnected:", isRealBleConnected, "isSystemReady:", isSystemReady);

            if (!isSystemReady) {
                console.log("    TxConfirm: Global state shows disconnected, checking BleService directly...");
            }

            let shouldContinue = isSystemReady;

            try {
                const bleStatus = await BleService.getConnectionStatus();
                console.log("    TxConfirm: BleService status:", bleStatus);

                if (!isSystemReady && (bleStatus.device || bleStatus.isConnected)) {
                    console.log("   TxConfirm: Global state shows disconnected but BleService shows connected - using BleService state");
                    shouldContinue = true;
                } else if (!isSystemReady && !bleStatus.device && !bleStatus.isConnected) {
                    console.log("   TxConfirm: Both global state and BleService show disconnected");
                    handleTransactionFailure("Device disconnected. Please reconnect and try again.");
                    return;
                }
            } catch (error) {
                console.log("   TxConfirm: Error checking BleService status:", error);
            }

            if (!shouldContinue) {
                console.log("   TxConfirm: Device not ready for transaction");
                handleTransactionFailure("Device disconnected. Please reconnect and try again.");
                return;
            }

            setSubstatus("Waiting for device signature...");

            if (authMorseInput) {
                try {
                    await verifyGestureOnDevice(authMorseInput);
                    console.log("  TxConfirm: Gesture verified on device");
                } catch (error) {
                    console.error("   TxConfirm: Gesture verification failed:", error);
                    handleTransactionFailure("Gesture verification failed. Please try again.");
                    return;
                }
            }

            await waitForTransactionSigning();

        } catch (error) {
            console.error("   TxConfirm: Transaction processing failed:", error);
            handleTransactionFailure("Failed to process transaction");
        }
    };

    const waitForTransactionSigning = async () => {
        try {
            console.log("    TxConfirm: Waiting for transaction signing...");

            let attempts = 0;
            const maxAttempts = 60;

            while (transactionSigning && attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                attempts++;
            }

            if (transactionSigning) {
                throw new Error("Transaction signing timeout");
            }

            console.log("  TxConfirm: Transaction signing completed");

            setProcessingSteps(prev => prev.map((step, index) =>
                index === 1 ? { ...step, completed: true } : step
            ));
            setCurrentStep(2);
            setSubstatus("Broadcasting to network...");

            await broadcastTransaction();

        } catch (error) {
            console.error("   TxConfirm: Transaction signing failed:", error);
            handleTransactionFailure("Transaction signing failed. Please try again.");
        }
    };

    const handleSigningComplete = async () => {
        try {
            console.log("  TxConfirm: Signature received, broadcasting...");

            setProcessingSteps(prev => prev.map((step, index) =>
                index === 1 ? { ...step, completed: true } : step
            ));
            setCurrentStep(2);
            setSubstatus("Broadcasting to network...");

            await broadcastTransaction();

        } catch (error) {
            console.error("   TxConfirm: Broadcasting failed:", error);
            handleTransactionFailure("Failed to broadcast transaction");
        }
    };

    const broadcastTransaction = async () => {
        try {
            console.log("    TxConfirm: Broadcasting transaction to Sui network...");

            console.log("    TxConfirm: Checking wallet address - walletAddress:", walletAddress);
            let currentWalletAddress = walletAddress;

            if (!currentWalletAddress) {
                console.log("   TxConfirm: No wallet address in global state, trying to retrieve from device...");
                try {
                    const wallets = await BleService.listWallets();
                    console.log("    TxConfirm: Retrieved wallets from device:", wallets);

                    if (wallets && wallets.length > 0) {
                        currentWalletAddress = wallets[0].address;
                        console.log("  TxConfirm: Retrieved wallet address from device:", currentWalletAddress);

                        setWalletAddress(currentWalletAddress);
                        console.log("  TxConfirm: Updated global state with wallet address");
                    } else {
                        throw new Error("No wallets found on device");
                    }
                } catch (error) {
                    console.log("   TxConfirm: Failed to retrieve wallet address from device:", error);
                    throw new Error("No wallet address available");
                }
            }

            const txBytesB64 = await createTransactionAndReturnBytes(
                currentWalletAddress,
                numericAmount * 1e9,
                recipient
            );

            console.log("  TxConfirm: Transaction bytes created, sending to device for signing...");

            console.log("    TxConfirm: Sending transaction bytes to device for signing...");
            const suiSignatureBase64 = await BleService.signTransaction(txBytesB64);
            console.log("  TxConfirm: Received signature from device:", suiSignatureBase64);

            console.log("  TxConfirm: Received signature from device, submitting to blockchain...");

            const result = await submitSignedTransaction(txBytesB64, suiSignatureBase64);

            console.log("  TxConfirm: Transaction broadcast result:", result);

            if (result && result.digest) {
                setTransactionHash(result.digest);
                setExplorerUrl(`https://testnet.suivision.xyz/txblock/${result.digest}`);

                setProcessingSteps(prev => prev.map((step, index) =>
                    index === 2 ? { ...step, completed: true } : step
                ));
                setCurrentStep(3);

                await waitForTransactionConfirmation(result.digest);

                setStatus("success");
                setSubstatus("Transaction confirmed on blockchain");
                setProcessingSteps(prev => prev.map((step, index) =>
                    index === 3 ? { ...step, completed: true } : step
                ));
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } else {
                throw new Error("Transaction broadcast failed - no digest returned");
            }
        } catch (error) {
            console.error("   TxConfirm: Transaction broadcast failed:", error);
            throw error;
        }
    };

    const waitForTransactionConfirmation = async (digest) => {
        try {
            console.log("    TxConfirm: Waiting for transaction confirmation...");

            let confirmed = false;
            let attempts = 0;
            const maxAttempts = 30;

            while (!confirmed && attempts < maxAttempts) {
                try {
                    const txDetails = await client.getTransactionBlock({
                        digest: digest,
                        options: {
                            showEffects: true,
                            showEvents: true,
                        }
                    });

                    if (txDetails && txDetails.effects && txDetails.effects.status && txDetails.effects.status.status === 'success') {
                        confirmed = true;
                        console.log("  TxConfirm: Transaction confirmed on blockchain");
                    } else {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        attempts++;
                    }
                } catch (error) {
                    console.log("   TxConfirm: Error checking transaction status:", error);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    attempts++;
                }
            }

            if (!confirmed) {
                throw new Error("Transaction confirmation timeout");
            }
        } catch (error) {
            console.error("   TxConfirm: Failed to confirm transaction:", error);
            throw error;
        }
    };

    const handleTransactionFailure = (errorMessage) => {
        setStatus("failed");
        setSubstatus(errorMessage);

        setProcessingSteps(prev => prev.map((step, index) =>
            index === currentStep ? { ...step, failed: true } : step
        ));

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

        setAlertConfig({
            title: "Transaction Failed",
            message: `${errorMessage}. Please try again or contact support if the issue persists.`,
            buttons: [
                { text: "Try Again", onPress: () => { setAlertVisible(false); startTransactionProcessing(); } },
                { text: "Go Home", onPress: () => { setAlertVisible(false); navigation.navigate("(tabs)"); } }
            ]
        });
        setAlertVisible(true);
    };

    const createTransactionAndReturnBytes = async (
        senderAddress,
        amount,
        receiverAddress
    ) => {
        console.log("    TxConfirm: Creating transaction bytes...");
        console.log("  - Sender:", senderAddress);
        console.log("  - Amount:", amount);
        console.log("  - Receiver:", receiverAddress);

        const tx = new Transaction();
        tx.setSender(senderAddress);
        const [coin] = tx.splitCoins(tx.gas, [amount]);
        tx.transferObjects([coin], receiverAddress);

        const txBytes = await tx.build({
            client,
        });

        const txBytesB64 = toBase64(txBytes);
        console.log("  TxConfirm: Transaction bytes created (Base64):", txBytesB64);
        return txBytesB64;
    };

    const submitSignedTransaction = async (
        txBytesB64,
        suiSignatureBase64
    ) => {
        console.log("    TxConfirm: Submitting signed transaction...");
        console.log("  - Transaction bytes length:", txBytesB64.length);
        console.log("  - Signature length:", suiSignatureBase64.length);

        const result = await client.executeTransactionBlock({
            transactionBlock: txBytesB64,
            signature: suiSignatureBase64,
            options: {
                showEffects: true,
                showEvents: true,
            },
            requestType: 'WaitForEffectsCert'
        });

        console.log("  TxConfirm: Transaction submitted successfully");
        return result;
    };

    const handleDone = () => {
        navigation.navigate("(tabs)");
    };

    const getStatusIcon = (step, index) => {
        if (step.failed) return { name: "error", color: Colors.emergency };
        if (step.completed) return { name: "check-circle", color: "#4CAF50" };
        if (index === currentStep) return { name: "radio-button-checked", color: Colors.thickOrange };
        return { name: "radio-button-unchecked", color: Colors.gray };
    };

    return (
        <View style={styles.container}>
            <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.navigate("(tabs)")}>
                    <Feather name="arrow-left" size={28} color={Colors.white} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Transaction Status</Text>
                <View style={{ width: 28 }} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                <View style={[
                    styles.statusBanner,
                    status === "success" && styles.successBanner,
                    status === "failed" && styles.failedBanner
                ]}>
                    <MaterialIcons
                        name={
                            status === "success" ? "check-circle" :
                                status === "failed" ? "error" :
                                    "hourglass-empty"
                        }
                        size={32}
                        color={
                            status === "success" ? "#4CAF50" :
                                status === "failed" ? Colors.emergency :
                                    Colors.thickOrange
                        }
                    />
                    <View style={styles.statusText}>
                        <Text style={styles.statusTitle}>
                            {status === "success" ? "Transaction Successful" :
                                status === "failed" ? "Transaction Failed" :
                                    "Processing Transaction"}
                        </Text>
                        <Text style={styles.statusSubtitle}>{substatus}</Text>
                    </View>
                </View>

                <View style={styles.summaryCard}>
                    <Text style={styles.summaryTitle}>Transaction Summary</Text>

                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Amount</Text>
                        <Text style={styles.summaryValue}>{numericAmount} SUI</Text>
                    </View>

                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Gas Fee</Text>
                        <Text style={styles.summaryValue}>{numericGasFee} SUI</Text>
                    </View>

                    <View style={[styles.summaryRow, styles.summaryTotal]}>
                        <Text style={styles.summaryTotalLabel}>Total</Text>
                        <Text style={styles.summaryTotalValue}>{totalAmount.toFixed(6)} SUI</Text>
                    </View>

                    <View style={styles.recipientSection}>
                        <Text style={styles.summaryLabel}>To</Text>
                        <Text style={styles.recipientText}>
                            {recipient?.slice(0, 6)}...{recipient?.slice(-4)}
                        </Text>
                    </View>
                </View>

                <View style={styles.stepsCard}>
                    <Text style={styles.stepsTitle}>Transaction Progress</Text>

                    {processingSteps.map((step, index) => (
                        <View key={step.id} style={styles.step}>
                            <View style={styles.stepIcon}>
                                <MaterialIcons
                                    name={getStatusIcon(step, index).name}
                                    size={24}
                                    color={getStatusIcon(step, index).color}
                                />
                            </View>
                            <View style={styles.stepContent}>
                                <Text style={[
                                    styles.stepTitle,
                                    step.completed && styles.stepTitleCompleted,
                                    step.failed && styles.stepTitleFailed
                                ]}>
                                    {step.title}
                                </Text>
                                <Text style={styles.stepDescription}>{step.description}</Text>
                            </View>
                            {index === currentStep && status === "processing" && (
                                <ActivityIndicator size="small" color={Colors.thickOrange} />
                            )}
                        </View>
                    ))}
                </View>

                <View style={styles.authCard}>
                    <Text style={styles.authTitle}>Authentication Details</Text>

                    <View style={styles.authRow}>
                        <Text style={styles.authLabel}>Method</Text>
                        <Text style={styles.authValue}>
                            SuiStep Device
                        </Text>
                    </View>

                    <View style={styles.authRow}>
                        <Text style={styles.authLabel}>Challenge</Text>
                        <Text style={styles.authValue}>{challenge}</Text>
                    </View>

                    <View style={styles.authRow}>
                        <Text style={styles.authLabel}>Status</Text>
                        <View style={styles.authStatus}>
                            <MaterialIcons name="verified-user" size={16} color="#4CAF50" />
                            <Text style={[styles.authValue, { color: "#4CAF50" }]}>Verified</Text>
                        </View>
                    </View>
                </View>

                {transactionHash && (
                    <View style={styles.hashCard}>
                        <Text style={styles.hashTitle}>Transaction Hash</Text>
                        <Text style={styles.hashValue}>{transactionHash}</Text>
                        {explorerUrl && (
                            <TouchableOpacity
                                style={styles.explorerButton}
                                onPress={() => Linking.openURL(explorerUrl)}
                            >
                                <MaterialIcons name="open-in-new" size={20} color={Colors.white} />
                                <Text style={styles.explorerButtonText}>View on Explorer</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}

                <View style={styles.actionButtons}>
                    {status === "success" && (
                        <>
                            {explorerUrl && (
                                <TouchableOpacity
                                    style={styles.secondaryButton}
                                    onPress={() => Linking.openURL(explorerUrl)}
                                >
                                    <MaterialIcons name="open-in-new" size={20} color={Colors.thickOrange} />
                                    <Text style={styles.secondaryButtonText}>View on Explorer</Text>
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity style={styles.primaryButton} onPress={handleDone}>
                                <MaterialIcons name="home" size={20} color={Colors.primary} />
                                <Text style={styles.primaryButtonText}>Done</Text>
                            </TouchableOpacity>
                        </>
                    )}

                    {status === "failed" && (
                        <>
                            <TouchableOpacity
                                style={styles.secondaryButton}
                                onPress={startTransactionProcessing}
                            >
                                <MaterialIcons name="refresh" size={20} color={Colors.thickOrange} />
                                <Text style={styles.secondaryButtonText}>Try Again</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.primaryButton} onPress={handleDone}>
                                <MaterialIcons name="home" size={20} color={Colors.primary} />
                                <Text style={styles.primaryButtonText}>Go Home</Text>
                            </TouchableOpacity>
                        </>
                    )}

                    {status === "processing" && (
                        <TouchableOpacity
                            style={styles.cancelButton}
                            onPress={handleDone}
                        >
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                        </TouchableOpacity>
                    )}
                </View>

                <View style={styles.securityNotice}>
                    <MaterialIcons name="security" size={20} color={Colors.thickOrange} />
                    <Text style={styles.securityText}>
                        This transaction was authenticated using Morse code and signed offline on your SuiStep device for maximum security.
                    </Text>
                </View>
            </ScrollView>

            <CustomAlert
                visible={alertVisible}
                title={alertConfig.title}
                message={alertConfig.message}
                buttons={alertConfig.buttons}
                onRequestClose={() => setAlertVisible(false)}
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
    statusBanner: {
        backgroundColor: Colors.lightGray,
        borderRadius: 12,
        padding: 20,
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 20,
        gap: 16,
    },
    successBanner: {
        backgroundColor: "rgba(76, 175, 80, 0.1)",
        borderWidth: 1,
        borderColor: "#4CAF50",
    },
    failedBanner: {
        backgroundColor: "rgba(244, 67, 54, 0.1)",
        borderWidth: 1,
        borderColor: Colors.emergency,
    },
    statusText: {
        flex: 1,
    },
    statusTitle: {
        color: Colors.white,
        fontSize: 18,
        fontWeight: "bold",
        marginBottom: 4,
    },
    statusSubtitle: {
        color: Colors.gray,
        fontSize: 14,
    },
    summaryCard: {
        backgroundColor: Colors.lightGray,
        borderRadius: 12,
        padding: 20,
        marginBottom: 20,
    },
    summaryTitle: {
        color: Colors.white,
        fontSize: 18,
        fontWeight: "bold",
        marginBottom: 16,
    },
    summaryRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 12,
    },
    summaryLabel: {
        color: Colors.gray,
        fontSize: 14,
    },
    summaryValue: {
        color: Colors.white,
        fontSize: 14,
        fontWeight: "600",
    },
    summaryTotal: {
        borderTopWidth: 1,
        borderTopColor: Colors.gray,
        paddingTop: 12,
        marginTop: 8,
        marginBottom: 16,
    },
    summaryTotalLabel: {
        color: Colors.white,
        fontSize: 16,
        fontWeight: "bold",
    },
    summaryTotalValue: {
        color: Colors.thickOrange,
        fontSize: 16,
        fontWeight: "bold",
    },
    recipientSection: {
        borderTopWidth: 1,
        borderTopColor: Colors.gray,
        paddingTop: 12,
    },
    recipientText: {
        color: Colors.white,
        fontSize: 14,
        fontWeight: "600",
        fontFamily: "monospace",
        marginTop: 4,
    },
    stepsCard: {
        backgroundColor: Colors.lightGray,
        borderRadius: 12,
        padding: 20,
        marginBottom: 20,
    },
    stepsTitle: {
        color: Colors.white,
        fontSize: 18,
        fontWeight: "bold",
        marginBottom: 16,
    },
    step: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 16,
        gap: 12,
    },
    stepIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: "center",
        alignItems: "center",
    },
    stepContent: {
        flex: 1,
    },
    stepTitle: {
        color: Colors.white,
        fontSize: 16,
        fontWeight: "600",
        marginBottom: 2,
    },
    stepTitleCompleted: {
        color: "#4CAF50",
    },
    stepTitleFailed: {
        color: Colors.emergency,
    },
    stepDescription: {
        color: Colors.gray,
        fontSize: 14,
    },
    authCard: {
        backgroundColor: Colors.lightGray,
        borderRadius: 12,
        padding: 20,
        marginBottom: 20,
    },
    authTitle: {
        color: Colors.white,
        fontSize: 18,
        fontWeight: "bold",
        marginBottom: 16,
    },
    authRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
    },
    authLabel: {
        color: Colors.gray,
        fontSize: 14,
    },
    authValue: {
        color: Colors.white,
        fontSize: 14,
        fontWeight: "600",
    },
    authStatus: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
    hashCard: {
        backgroundColor: Colors.lightGray,
        borderRadius: 12,
        padding: 20,
        marginBottom: 20,
    },
    hashTitle: {
        color: Colors.white,
        fontSize: 18,
        fontWeight: "bold",
        marginBottom: 12,
    },
    hashValue: {
        color: Colors.gray,
        fontSize: 12,
        fontFamily: "monospace",
        marginBottom: 16,
        lineHeight: 18,
    },
    explorerButton: {
        backgroundColor: Colors.thickOrange,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
        gap: 8,
    },
    explorerButtonText: {
        color: Colors.white,
        fontSize: 14,
        fontWeight: "bold",
    },
    actionButtons: {
        gap: 12,
        marginBottom: 20,
    },
    primaryButton: {
        backgroundColor: Colors.thickOrange,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 16,
        borderRadius: 12,
        gap: 8,
    },
    primaryButtonText: {
        color: Colors.primary,
        fontSize: 18,
        fontWeight: "bold",
    },
    secondaryButton: {
        backgroundColor: "transparent",
        borderWidth: 2,
        borderColor: Colors.thickOrange,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 14,
        borderRadius: 12,
        gap: 8,
    },
    secondaryButtonText: {
        color: Colors.thickOrange,
        fontSize: 16,
        fontWeight: "bold",
    },
    cancelButton: {
        backgroundColor: Colors.gray,
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: "center",
    },
    cancelButtonText: {
        color: Colors.white,
        fontSize: 16,
        fontWeight: "600",
    },
    securityNotice: {
        flexDirection: "row",
        alignItems: "flex-start",
        backgroundColor: "rgba(244, 130, 80, 0.1)",
        borderRadius: 12,
        padding: 16,
        marginBottom: 40,
        gap: 12,
    },
    securityText: {
        color: Colors.gray,
        fontSize: 14,
        lineHeight: 20,
        flex: 1,
    },
}); 
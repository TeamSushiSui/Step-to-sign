import CustomAlert from "@/components/CustomAlert";
import Colors from "@/constants/Colors";
import { useGlobalState } from "@/contexts/GlobalStateProvider";
import { Feather, MaterialIcons } from "@expo/vector-icons";
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { toBase64 } from "@mysten/sui/utils";
import { useNavigation } from '@react-navigation/native';
import { Camera, CameraView } from "expo-camera";
import { useEffect, useState } from "react";
import {
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

const rpcUrl = getFullnodeUrl('testnet');
const client = new SuiClient({ url: rpcUrl });

export default function SendScreen() {
    const [showGasTooltip, setShowGasTooltip] = useState(false);
    const [showQR, setShowQR] = useState(false);
    const [hasPermission, setHasPermission] = useState(null);
    const [scanned, setScanned] = useState(false);
    const [retryCount, setRetryCount] = useState(0);
    const [isPreparingTx, setIsPreparingTx] = useState(false);
    const [showNoDeviceAlert, setShowNoDeviceAlert] = useState(false);
    const [showNoWalletAlert, setShowNoWalletAlert] = useState(false);

    const navigation = useNavigation();

    const {
        // Transaction states
        amount,
        setAmount,
        recipient,
        setRecipient,

        // Device and wallet states
        deviceConnected,
        isRealBleConnected,

        allBalances,

        // Transaction functions
        prepareTransaction,

        // Authentication states
        authInProgress,

    } = useGlobalState();

    // State for token selection
    const [selectedToken, setSelectedToken] = useState(null);
    const [showTokenSelector, setShowTokenSelector] = useState(false);

    // Get tokens from balances 
    const tokens = allBalances.map((b) => {
        const coinType = b.coinType;
        const totalBalance = BigInt(b.totalBalance);

        // Map coin types to known tokens
        let id, name, symbol, coingeckoId, decimals;

        if (coinType === "0x2::sui::SUI") {
            id = "sui";
            name = "sui";
            symbol = "sui";
            coingeckoId = "sui";
            decimals = 9;
        } else if (coinType.includes("usdc")) {
            id = "usdc";
            name = "usdc";
            symbol = "usdc";
            coingeckoId = "usd-coin";
            decimals = 6;
        } else {
            // Extract token info from coin type
            const parts = coinType.split("::");
            id = parts[parts.length - 1]?.toLowerCase() || "unknown";
            name = parts[parts.length - 1]?.toLowerCase() || "Unknown Token";
            symbol = parts[parts.length - 1]?.toUpperCase() || "UNKNOWN";
            coingeckoId = null;
            decimals = 9;
        }

        const amount = Number(totalBalance) / Math.pow(10, decimals);

        return {
            id,
            name,
            symbol,
            coingeckoId,
            amount,
            coinType,
        };
    });

    // Set default selected token to SUI if available
    useEffect(() => {
        if (tokens.length > 0 && !selectedToken) {
            const suiToken = tokens.find(t => t.symbol.toLowerCase() === 'sui');
            setSelectedToken(suiToken || tokens[0]);
        }
    }, [tokens, selectedToken]);

    async function createTransactionAndReturnBytes(senderAddress) {
        const tx = new Transaction();

        const [coin] = tx.splitCoins(tx.gas, [100]);
        tx.transferObjects([coin], '0x16526f26f4117e2f075960edadd9d744b07390af5451a640319a3ba04f09b79a');
        tx.setSender(senderAddress);

        const txBytes = await tx.build({
            client,
        });
        return toBase64(txBytes);

    }


    async function submitSignedTransaction(txBytesB64, suiSignatureBase64) {
        const result = await client.executeTransactionBlock({
            transactionBlock: txBytesB64,
            signature: suiSignatureBase64,
            options: {
                showEffects: true,
                showEvents: true,
            },
            requestType: 'WaitForEffectsCert'
        });
        return result;
    }

    useEffect(() => {
        (async () => {
            const { status } = await Camera.requestCameraPermissionsAsync();
            setHasPermission(status === "granted");
        })();
    }, []);

    const currentBalance = selectedToken ? selectedToken.amount : 0;
    const [estimatedGasFee, setEstimatedGasFee] = useState(0.0);
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const refGasPrice = await client.getReferenceGasPrice();
                const gasBudget = 10000;
                const feeMist = BigInt(refGasPrice) * BigInt(gasBudget);
                let feeSui = Number(feeMist) / 1_000_000_000;
                if (!Number.isFinite(feeSui) || feeSui < 0) feeSui = 0.0005;
                if (feeSui > 0.01) feeSui = 0.01;
                if (mounted) setEstimatedGasFee(feeSui);
            } catch (e) {
                console.log("   Send: Failed to fetch gas price, using fallback.", e?.message || e);
                if (mounted) setEstimatedGasFee(0.0005);
            }
        })();
        return () => { mounted = false; };
    }, []);

    const numericAmount = Number(amount);
    const maxSendable = Math.max(currentBalance, 0);
    const isAmountValid =
        !!amount &&
        !isNaN(numericAmount) &&
        numericAmount > 0 &&
        numericAmount <= maxSendable;

    const isRecipientValid = (recipient || '').length >= 5 && (recipient || '').startsWith("0x");
    const canPreview = isAmountValid && isRecipientValid;

    // Check if system is ready for transactions - only require device connection
    const isSystemReady = deviceConnected || isRealBleConnected;

    const autofillAmount = (percentage) => {
        const fillAmount = (maxSendable * percentage).toFixed(6);
        setAmount(fillAmount.toString());
    };

    const handleBarCodeScanned = ({ type, data }) => {
        setScanned(true);
        console.log(`📷 QR Scanned: ${type} - ${data}`);

        // Parse different QR code formats
        let address = data;

        // Handle different Sui address formats
        if (data.includes('sui:') || data.includes('0x')) {
            // Extract address from URI scheme or direct address
            const match = data.match(/0x[a-fA-F0-9]{40,}/);
            if (match) {
                address = match[0];
            }
        }

        // Validate that we have a proper Sui address
        if (address && address.startsWith('0x') && address.length >= 42) {
            setRecipient(address);
            setShowQR(false);
            console.log(`  QR: Address set to: ${address}`);
        } else {
            console.log(`   QR: Invalid address format: ${address}`);
            Alert.alert(
                "Invalid QR Code",
                "The scanned QR code doesn't contain a valid Sui address.",
                [{ text: "OK", onPress: () => setScanned(false) }]
            );
        }

        // Reset scanned state after a delay
        setTimeout(() => setScanned(false), 2000);
    };

    // NEW: Prepare and navigate to authentication
    const handlePreviewTransaction = async () => {
        try {
            // Check if system is ready
            if (!isSystemReady) {
                if (!deviceConnected && !isRealBleConnected) {
                    setShowNoDeviceAlert(true);
                    return;
                }
            }

            setIsPreparingTx(true);
            console.log("    Send: Preparing transaction...");

            // Prepare transaction with Suiet service
            const transactionData = await prepareTransaction(recipient, numericAmount);

            console.log("  Send: Transaction prepared, navigating to authentication...");

            // Navigate to authentication screen with transaction data
            navigation.navigate('authentication', {
                transactionData: transactionData,
                recipient: recipient,
                amount: numericAmount,
                gasFee: estimatedGasFee,
                source: 'send'
            });

        } catch (error) {
            console.error("   Send: Transaction preparation failed:", error);
            Alert.alert(
                "Transaction Error",
                "Failed to prepare transaction. Please check your wallet connection and try again.",
                [{ text: "OK", style: "default" }]
            );
        } finally {
            setIsPreparingTx(false);
        }
    };

    const handleConnectDevice = () => {
        navigation.navigate("(tabs)"); // Navigate to home to connect device
    };

    // Removed wallet connect handler as Suiet wallet is no longer used

    // Show no device connected UI
    if (!isSystemReady) {
        return (
            <View style={styles.container}>
                <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />

                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Feather name="arrow-left" size={28} color={Colors.white} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Send $SUI</Text>
                    <View style={{ width: 28 }} />
                </View>

                {/* No System Ready UI */}
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
                        Connect your SuiStep device to enable secure transaction signing.
                    </Text>
                    <TouchableOpacity
                        style={styles.connectButton}
                        onPress={handleConnectDevice}
                    >
                        <MaterialIcons
                            name="bluetooth"
                            size={24}
                            color={Colors.primary}
                        />
                        <Text style={styles.connectButtonText}>
                            {"Connect Device"}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Alerts */}
                <CustomAlert
                    visible={showNoWalletAlert}
                    title="Wallet Required"
                    message="Please connect your Suiet wallet to send transactions."
                    buttons={[
                        { text: "Cancel", style: "cancel", onPress: () => setShowNoWalletAlert(false) },
                        { text: "Connect", onPress: handleConnectDevice }
                    ]}
                    onRequestClose={() => setShowNoWalletAlert(false)}
                />

                <CustomAlert
                    visible={showNoDeviceAlert}
                    title="Device Required"
                    message="Please connect your SuiStep device to enable secure transaction signing."
                    buttons={[
                        { text: "Cancel", style: "cancel", onPress: () => setShowNoDeviceAlert(false) },
                        { text: "Connect", onPress: handleConnectDevice }
                    ]}
                    onRequestClose={() => setShowNoDeviceAlert(false)}
                />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Feather name="arrow-left" size={28} color={Colors.white} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Send $SUI</Text>
                <View style={{ width: 28 }} />
            </View>

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === "ios" ? "padding" : "height"}
            >
                <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                    {/* Connection Status Banner - NEW */}
                    <View style={styles.statusBanner}>
                        <View style={styles.statusIndicators}>
                            {(deviceConnected || isRealBleConnected) && (
                                <View style={styles.statusItem}>
                                    <View style={[styles.statusDot, { backgroundColor: '#2196F3' }]} />
                                    <Text style={styles.statusText}>Device Connected</Text>
                                </View>
                            )}
                        </View>
                    </View>

                    {/* Token Selection */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Select Token</Text>
                        <TouchableOpacity
                            style={styles.tokenSelector}
                            onPress={() => setShowTokenSelector(true)}
                        >
                            <View style={styles.tokenInfo}>
                                <View style={styles.tokenIcon}>
                                    <Text style={styles.tokenSymbol}>
                                        {selectedToken ? selectedToken.symbol.toUpperCase() : 'SUI'}
                                    </Text>
                                </View>
                                <View style={styles.tokenDetails}>
                                    <Text style={styles.tokenName}>
                                        {selectedToken ? selectedToken.name.charAt(0).toUpperCase() + selectedToken.name.slice(1) : 'Sui'}
                                    </Text>
                                    <Text style={styles.tokenBalance}>
                                        Balance: {currentBalance.toFixed(6)} {selectedToken ? selectedToken.symbol.toUpperCase() : 'SUI'}
                                    </Text>
                                </View>
                            </View>
                            <MaterialIcons name="keyboard-arrow-down" size={24} color={Colors.gray} />
                        </TouchableOpacity>
                    </View>

                    {/* Amount Input */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Amount</Text>
                        <View style={styles.amountContainer}>
                            <TextInput
                                style={[
                                    styles.amountInput,
                                    !isAmountValid && amount && styles.amountInputError,
                                ]}
                                value={amount}
                                onChangeText={setAmount}
                                placeholder="0.0"
                                placeholderTextColor={Colors.gray}
                                keyboardType="numeric"
                                returnKeyType="done"
                            />
                            <Text style={styles.amountCurrency}>
                                {selectedToken ? selectedToken.symbol.toUpperCase() : 'SUI'}
                            </Text>
                        </View>

                        {/* Amount validation message */}
                        {amount && !isAmountValid && (
                            <Text style={styles.errorText}>
                                {numericAmount > maxSendable
                                    ? `Insufficient balance. Max: ${maxSendable.toFixed(6)} SUI`
                                    : "Please enter a valid amount"}
                            </Text>
                        )}

                        {/* Quick amount buttons */}
                        <View style={styles.quickAmounts}>
                            <TouchableOpacity
                                style={styles.quickAmountButton}
                                onPress={() => autofillAmount(0.25)}
                            >
                                <Text style={styles.quickAmountText}>25%</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.quickAmountButton}
                                onPress={() => autofillAmount(0.5)}
                            >
                                <Text style={styles.quickAmountText}>50%</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.quickAmountButton}
                                onPress={() => autofillAmount(1.0)}
                            >
                                <Text style={styles.quickAmountText}>Max</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Recipient Input */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Recipient</Text>
                        <View style={styles.recipientContainer}>
                            <TextInput
                                style={[
                                    styles.recipientInput,
                                    !isRecipientValid && recipient && styles.recipientInputError,
                                ]}
                                value={recipient}
                                onChangeText={setRecipient}
                                placeholder="0x... or wallet address"
                                placeholderTextColor={Colors.gray}
                                autoCapitalize="none"
                                autoCorrect={false}
                                returnKeyType="done"
                            />
                            <TouchableOpacity style={styles.qrButton} onPress={() => setShowQR(true)}>
                                <MaterialIcons name="qr-code-scanner" size={24} color={Colors.thickOrange} />
                            </TouchableOpacity>
                        </View>

                        {/* Recipient validation message */}
                        {recipient && !isRecipientValid && (
                            <Text style={styles.errorText}>
                                Please enter a valid Sui address (starts with 0x)
                            </Text>
                        )}
                    </View>

                    {/* Transaction Summary */}
                    {canPreview && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Transaction Summary</Text>
                            <View style={styles.summaryCard}>
                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryLabel}>Amount</Text>
                                    <Text style={styles.summaryValue}>
                                        {amount} {selectedToken ? selectedToken.symbol.toUpperCase() : 'SUI'}
                                    </Text>
                                </View>
                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryLabel}>
                                        Estimated Gas Fee
                                        <TouchableOpacity onPress={() => setShowGasTooltip(true)}>
                                            <MaterialIcons
                                                name="info-outline"
                                                size={16}
                                                color={Colors.gray}
                                                style={{ marginLeft: 4 }}
                                            />
                                        </TouchableOpacity>
                                    </Text>
                                    <Text style={styles.summaryValue}>{estimatedGasFee} SUI</Text>
                                </View>
                                <View style={[styles.summaryRow, styles.summaryTotal]}>
                                    <Text style={styles.summaryTotalLabel}>Total</Text>
                                    <Text style={styles.summaryTotalValue}>
                                        {(numericAmount + estimatedGasFee).toFixed(6)} {selectedToken ? selectedToken.symbol.toUpperCase() : 'SUI'}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    )}

                    {/* Preview Transaction Button */}
                    <TouchableOpacity
                        style={[
                            styles.previewButton,
                            (!canPreview || isPreparingTx || authInProgress) && styles.previewButtonDisabled,
                        ]}
                        onPress={handlePreviewTransaction}
                        disabled={!canPreview || isPreparingTx || authInProgress}
                    >
                        {isPreparingTx ? (
                            <Text style={styles.previewButtonText}>Preparing Transaction...</Text>
                        ) : authInProgress ? (
                            <Text style={styles.previewButtonText}>Authentication in Progress...</Text>
                        ) : (
                            <>
                                <MaterialIcons name="security" size={24} color={Colors.primary} />
                                <Text style={styles.previewButtonText}>Preview Transaction</Text>
                            </>
                        )}
                    </TouchableOpacity>

                    {/* Security Notice - NEW */}
                    <View style={styles.securityNotice}>
                        <MaterialIcons name="security" size={20} color={Colors.thickOrange} />
                        <Text style={styles.securityText}>
                            Transactions are secured with Morse code authentication and signed offline on your SuiStep device.
                        </Text>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* QR Code Scanner Modal */}
            <Modal visible={showQR} animationType="slide" onRequestClose={() => setShowQR(false)}>
                <View style={styles.qrContainer}>
                    <View style={styles.qrHeader}>
                        <TouchableOpacity onPress={() => setShowQR(false)}>
                            <Feather name="x" size={28} color={Colors.white} />
                        </TouchableOpacity>
                        <Text style={styles.qrTitle}>Scan QR Code</Text>
                        <View style={{ width: 28 }} />
                    </View>

                    {hasPermission === null ? (
                        <View style={styles.qrPermissionContainer}>
                            <Text style={styles.qrPermissionText}>Requesting camera permission...</Text>
                        </View>
                    ) : hasPermission === false ? (
                        <View style={styles.qrPermissionContainer}>
                            <MaterialIcons name="camera-alt" size={80} color={Colors.gray} />
                            <Text style={styles.qrPermissionText}>
                                Camera permission is required to scan QR codes
                            </Text>
                            <TouchableOpacity
                                style={styles.permissionButton}
                                onPress={async () => {
                                    const { status } = await Camera.requestCameraPermissionsAsync();
                                    setHasPermission(status === "granted");
                                }}
                            >
                                <Text style={styles.permissionButtonText}>Grant Permission</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <CameraView
                            style={styles.camera}
                            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                            barcodeScannerSettings={{
                                barcodeTypes: ["qr"],
                            }}
                        >
                            <View style={styles.qrOverlay}>
                                <View style={styles.qrTarget} />
                                <Text style={styles.qrInstructions}>
                                    Position the QR code within the frame
                                </Text>
                                {scanned && (
                                    <TouchableOpacity
                                        style={styles.scanAgainButton}
                                        onPress={() => setScanned(false)}
                                    >
                                        <Text style={styles.scanAgainText}>Scan Again</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </CameraView>
                    )}
                </View>
            </Modal>

            {/* Token Selector Modal */}
            <Modal
                visible={showTokenSelector}
                animationType="slide"
                onRequestClose={() => setShowTokenSelector(false)}
            >
                <View style={styles.tokenSelectorContainer}>
                    <View style={styles.tokenSelectorHeader}>
                        <TouchableOpacity onPress={() => setShowTokenSelector(false)}>
                            <Feather name="x" size={28} color={Colors.white} />
                        </TouchableOpacity>
                        <Text style={styles.tokenSelectorTitle}>Select Token</Text>
                        <View style={{ width: 28 }} />
                    </View>

                    <ScrollView style={styles.tokenList} showsVerticalScrollIndicator={false}>
                        {tokens.map((token) => (
                            <TouchableOpacity
                                key={token.id}
                                style={[
                                    styles.tokenItem,
                                    selectedToken?.id === token.id && styles.tokenItemSelected
                                ]}
                                onPress={() => {
                                    setSelectedToken(token);
                                    setShowTokenSelector(false);
                                    // Clear amount when switching tokens
                                    setAmount("");
                                }}
                            >
                                <View style={styles.tokenItemInfo}>
                                    <View style={styles.tokenItemIcon}>
                                        <Text style={styles.tokenItemSymbol}>
                                            {token.symbol.toUpperCase()}
                                        </Text>
                                    </View>
                                    <View style={styles.tokenItemDetails}>
                                        <Text style={styles.tokenItemName}>
                                            {token.name.charAt(0).toUpperCase() + token.name.slice(1)}
                                        </Text>
                                        <Text style={styles.tokenItemBalance}>
                                            {token.amount.toFixed(6)} {token.symbol.toUpperCase()}
                                        </Text>
                                    </View>
                                </View>
                                {selectedToken?.id === token.id && (
                                    <MaterialIcons name="check-circle" size={24} color={Colors.thickOrange} />
                                )}
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            </Modal>

            {/* Gas Fee Tooltip */}
            <Modal
                visible={showGasTooltip}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowGasTooltip(false)}
            >
                <TouchableOpacity
                    style={styles.tooltipOverlay}
                    activeOpacity={1}
                    onPress={() => setShowGasTooltip(false)}
                >
                    <View style={styles.tooltip}>
                        <Text style={styles.tooltipTitle}>Gas Fee</Text>
                        <Text style={styles.tooltipText}>
                            Gas fees are required to process transactions on the Sui network.
                            The fee varies based on network congestion and transaction complexity.
                        </Text>
                        <TouchableOpacity
                            style={styles.tooltipButton}
                            onPress={() => setShowGasTooltip(false)}
                        >
                            <Text style={styles.tooltipButtonText}>Got it</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
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
        textAlign: "center",
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 20,
    },

    // Status Banner - NEW
    statusBanner: {
        backgroundColor: Colors.lightGray,
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
    },
    statusIndicators: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 12,
    },
    statusItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    statusText: {
        color: Colors.white,
        fontSize: 14,
        fontWeight: "500",
    },

    // No System Container - NEW
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

    // Sections
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        color: Colors.white,
        fontSize: 18,
        fontWeight: "bold",
        marginBottom: 12,
    },

    // Token Selection
    tokenSelector: {
        backgroundColor: Colors.lightGray,
        borderRadius: 12,
        padding: 16,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    tokenInfo: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
    },
    tokenIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.thickOrange,
        justifyContent: "center",
        alignItems: "center",
        marginRight: 12,
    },
    tokenSymbol: {
        color: Colors.primary,
        fontSize: 14,
        fontWeight: "bold",
    },
    tokenDetails: {
        flex: 1,
    },
    tokenName: {
        color: Colors.white,
        fontSize: 16,
        fontWeight: "600",
        marginBottom: 2,
    },
    tokenBalance: {
        color: Colors.gray,
        fontSize: 14,
    },

    // Amount Input
    amountContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: Colors.lightGray,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 4,
    },
    amountInput: {
        flex: 1,
        color: Colors.white,
        fontSize: 24,
        fontWeight: "bold",
        paddingVertical: 16,
    },
    amountInputError: {
        color: Colors.emergency,
    },
    amountCurrency: {
        color: Colors.gray,
        fontSize: 18,
        fontWeight: "600",
        marginLeft: 8,
    },
    quickAmounts: {
        flexDirection: "row",
        gap: 8,
        marginTop: 12,
    },
    quickAmountButton: {
        backgroundColor: Colors.thickOrange,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        flex: 1,
        alignItems: "center",
    },
    quickAmountText: {
        color: Colors.primary,
        fontSize: 14,
        fontWeight: "bold",
    },

    // Recipient Input
    recipientContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: Colors.lightGray,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 4,
    },
    recipientInput: {
        flex: 1,
        color: Colors.white,
        fontSize: 16,
        paddingVertical: 16,
    },
    recipientInputError: {
        color: Colors.emergency,
    },
    qrButton: {
        padding: 8,
    },

    // Error Text
    errorText: {
        color: Colors.emergency,
        fontSize: 14,
        marginTop: 8,
    },

    // Transaction Summary
    summaryCard: {
        backgroundColor: Colors.lightGray,
        borderRadius: 12,
        padding: 16,
    },
    summaryRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
    },
    summaryLabel: {
        color: Colors.gray,
        fontSize: 14,
        flexDirection: "row",
        alignItems: "center",
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
        marginBottom: 0,
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

    // Preview Button
    previewButton: {
        backgroundColor: Colors.thickOrange,
        borderRadius: 12,
        paddingVertical: 16,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        marginTop: 20,
        marginBottom: 20,
    },
    previewButtonDisabled: {
        backgroundColor: Colors.gray,
        opacity: 0.6,
    },
    previewButtonText: {
        color: Colors.primary,
        fontSize: 18,
        fontWeight: "bold",
    },

    // Security Notice - NEW
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

    // QR Scanner Styles
    qrContainer: {
        flex: 1,
        backgroundColor: Colors.primary,
    },
    qrHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        paddingVertical: 15,
        paddingTop: StatusBar.currentHeight + 15,
        borderBottomWidth: 1,
        borderBottomColor: Colors.lightGray,
    },
    qrTitle: {
        color: Colors.white,
        fontSize: 18,
        fontWeight: "bold",
    },
    camera: {
        flex: 1,
    },
    qrOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "center",
        alignItems: "center",
    },
    qrTarget: {
        width: 250,
        height: 250,
        borderWidth: 2,
        borderColor: Colors.thickOrange,
        backgroundColor: "transparent",
        borderRadius: 12,
    },
    qrInstructions: {
        color: Colors.white,
        fontSize: 16,
        textAlign: "center",
        marginTop: 20,
        paddingHorizontal: 40,
    },
    qrPermissionContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 40,
    },
    qrPermissionText: {
        color: Colors.white,
        fontSize: 18,
        textAlign: "center",
        marginTop: 20,
        lineHeight: 24,
    },
    permissionButton: {
        backgroundColor: Colors.thickOrange,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
        marginTop: 30,
    },
    permissionButtonText: {
        color: Colors.primary,
        fontSize: 16,
        fontWeight: "bold",
    },
    scanAgainButton: {
        backgroundColor: Colors.thickOrange,
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
        marginTop: 20,
    },
    scanAgainText: {
        color: Colors.primary,
        fontSize: 14,
        fontWeight: "bold",
    },

    // Tooltip Styles
    tooltipOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 40,
    },
    tooltip: {
        backgroundColor: Colors.primary,
        borderRadius: 12,
        padding: 20,
        alignItems: "center",
        maxWidth: 300,
    },
    tooltipTitle: {
        color: Colors.white,
        fontSize: 18,
        fontWeight: "bold",
        marginBottom: 12,
    },
    tooltipText: {
        color: Colors.gray,
        fontSize: 14,
        textAlign: "center",
        lineHeight: 20,
        marginBottom: 20,
    },
    tooltipButton: {
        backgroundColor: Colors.thickOrange,
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
    },
    tooltipButtonText: {
        color: Colors.primary,
        fontSize: 14,
        fontWeight: "bold",
    },

    // Token Selector Styles
    tokenSelectorContainer: {
        flex: 1,
        backgroundColor: Colors.primary,
    },
    tokenSelectorHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        paddingVertical: 15,
        paddingTop: StatusBar.currentHeight + 15,
        borderBottomWidth: 1,
        borderBottomColor: Colors.lightGray,
    },
    tokenSelectorTitle: {
        color: Colors.white,
        fontSize: 18,
        fontWeight: "bold",
    },
    tokenList: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    tokenItem: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: Colors.lightGray,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
    },
    tokenItemSelected: {
        backgroundColor: Colors.thickOrange,
    },
    tokenItemInfo: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
    },
    tokenItemIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.thickOrange,
        justifyContent: "center",
        alignItems: "center",
        marginRight: 12,
    },
    tokenItemSymbol: {
        color: Colors.primary,
        fontSize: 14,
        fontWeight: "bold",
    },
    tokenItemDetails: {
        flex: 1,
    },
    tokenItemName: {
        color: Colors.white,
        fontSize: 16,
        fontWeight: "600",
        marginBottom: 4,
    },
    tokenItemBalance: {
        color: Colors.gray,
        fontSize: 14,
    },
});

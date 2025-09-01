import Colors from "@/constants/Colors";
import { useGlobalState } from "@/contexts/GlobalStateProvider";
import { Feather, FontAwesome5, MaterialIcons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as FileSystem from 'expo-file-system';
import { useNavigation } from "expo-router";
import * as Sharing from "expo-sharing";
import { useRef, useState } from "react";
import { Animated, Dimensions, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { captureRef } from "react-native-view-shot";

const { width } = Dimensions.get("window");
const QR_SIZE = Math.min(width * 0.6, 250);

export default function ReceiveScreen() {
    const navigation = useNavigation();
    const { walletAddress, deviceConnected, isRealBleConnected } = useGlobalState();
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState("");
    const fadeAnim = useRef(new Animated.Value(0)).current;

    // Ref for the QR code container to capture as an image
    const qrCodeImageRef = useRef();

    const showCustomToast = (message) => {
        setToastMessage(message);
        setShowToast(true);
        Animated.sequence([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }),
            Animated.delay(2000),
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }),
        ]).start(() => setShowToast(false));
    };

    const handleCopyAddress = async () => {
        const addressToUse = walletAddress || "";
        try {
            await Clipboard.setStringAsync(addressToUse);
            showCustomToast("Address copied to clipboard!");
        } catch (error) {
            console.error("Failed to copy address:", error);
            showCustomToast("Failed to copy address");
        }
    };

    const handleShare = async () => {
        const addressToUse = walletAddress || "";

        if (!qrCodeImageRef.current) {
            console.error("QR code image ref is not attached. Cannot capture image.");
            showCustomToast("Failed to prepare image for sharing.");
            return;
        }

        try {
            await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay

            const uri = await captureRef(qrCodeImageRef, {
                format: "png",
                quality: 1,
            });

            console.log("Captured image URI:", uri);

            const isAvailable = await Sharing.isAvailableAsync();
            if (isAvailable) {
                await Sharing.shareAsync(uri, {
                    mimeType: 'image/png', // Or 'image/jpeg' if format is jpg
                    dialogTitle: 'Share Wallet QR Code'
                });
            } else {
                await Clipboard.setStringAsync(addressToUse);
                showCustomToast("Share not available. Address copied to clipboard!");
            }

            await FileSystem.deleteAsync(uri, { idempotent: true });
            console.log("Temporary image file deleted:", uri);

        } catch (error) {
            console.error("Share error during capture or sharing:", error);
            showCustomToast("Failed to share QR code image");
        }
    };

    const handleConnectDevice = () => {
        navigation.navigate("(tabs)");
    };

    const renderQRCode = () => {
        const addressToUse = walletAddress || "";

        return (
            <View style={styles.qrCodeContainerToCapture} ref={qrCodeImageRef}>
                <QRCode
                    value={addressToUse}
                    size={QR_SIZE}
                    backgroundColor="#FFFFFF"
                    color="#000000"
                    quietZone={10}
                    logoBackgroundColor="transparent"
                    enableLinearGradient={false}
                />
                <Text style={styles.qrAddressText}>{addressToUse}</Text>
            </View>
        );
    };

    const isSystemReady = !!(deviceConnected || isRealBleConnected);
    if (!isSystemReady) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <Feather name="download" size={24} color={Colors.white} />
                        <Text style={styles.headerTitle}>Receive</Text>
                    </View>
                    <View style={styles.headerRight}>
                        <MaterialIcons name="qr-code" size={24} color={Colors.thickOrange} />
                    </View>
                </View>

                <View style={styles.noDeviceContainer}>
                    <View style={styles.noDeviceCard}>
                        <View style={styles.noDeviceIconContainer}>
                            <MaterialIcons
                                name="bluetooth-disabled"
                                size={80}
                                color={Colors.thickOrange}
                            />
                        </View>

                        <Text style={styles.noDeviceTitle}>Device Not Connected</Text>
                        <Text style={styles.noDeviceSubtitle}>
                            Connect your SuiStep device to generate a QR code and receive tokens securely.
                        </Text>

                        <View style={styles.noDeviceFeatures}>
                            <View style={styles.featureItem}>
                                <MaterialIcons name="qr-code" size={20} color={Colors.thickOrange} />
                                <Text style={styles.featureText}>Generate QR Code</Text>
                            </View>
                            <View style={styles.featureItem}>
                                <MaterialIcons name="security" size={20} color={Colors.thickOrange} />
                                <Text style={styles.featureText}>Secure Wallet Address</Text>
                            </View>
                            <View style={styles.featureItem}>
                                <MaterialIcons name="share" size={20} color={Colors.thickOrange} />
                                <Text style={styles.featureText}>Easy Sharing</Text>
                            </View>
                        </View>

                        <TouchableOpacity
                            style={styles.connectButton}
                            onPress={handleConnectDevice}
                        >
                            <FontAwesome5 name="bluetooth" size={20} color={Colors.white} />
                            <Text style={styles.connectButtonText}>Connect Device</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <Feather name="download" size={24} color={Colors.white} />
                    <Text style={styles.headerTitle}>Receive</Text>
                </View>
                <View style={styles.headerRight}>
                    <MaterialIcons name="qr-code" size={24} color={Colors.thickOrange} />
                </View>
            </View>

            <View style={styles.content}>
                <View style={styles.qrSection}>
                    <View style={styles.qrCard}>
                        {renderQRCode()}
                    </View>
                </View>

                <View style={styles.addressContainer}>
                    <Text style={styles.addressLabel}>Your Wallet Address</Text>
                    <View style={styles.addressCard}>
                        <Text style={styles.addressText} numberOfLines={2}>
                            {walletAddress || "0x1234567890abcdef1234567890abcdef12345678"}
                        </Text>
                    </View>

                    <View style={styles.actionButtons}>
                        <TouchableOpacity style={styles.actionButton} onPress={handleCopyAddress}>
                            <Feather name="copy" size={20} color={Colors.white} />
                            <Text style={styles.actionButtonText}>Copy Address</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
                            <Feather name="share-2" size={20} color={Colors.white} />
                            <Text style={styles.actionButtonText}>Share</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={[{ marginBottom: 500 }, styles.instructionsContainer]}>
                    <Text style={styles.instructionsTitle}>How to receive SUI</Text>
                    <View style={styles.instructionItem}>
                        <View style={styles.instructionNumber}>
                            <Text style={styles.instructionNumberText}>1</Text>
                        </View>
                        <Text style={styles.instructionText}>
                            Share this QR code or address with the sender
                        </Text>
                    </View>
                    <View style={styles.instructionItem}>
                        <View style={styles.instructionNumber}>
                            <Text style={styles.instructionNumberText}>2</Text>
                        </View>
                        <Text style={styles.instructionText}>
                            The sender scans the QR code or enters the address
                        </Text>
                    </View>
                    <View style={styles.instructionItem}>
                        <View style={styles.instructionNumber}>
                            <Text style={styles.instructionNumberText}>3</Text>
                        </View>
                        <Text style={styles.instructionText}>
                            Funds will appear in your wallet within seconds
                        </Text>
                    </View>
                </View>
            </View>

            {showToast && (
                <Animated.View
                    style={[
                        styles.toast,
                        {
                            opacity: fadeAnim,
                            transform: [{
                                translateY: fadeAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [50, 0],
                                })
                            }]
                        }
                    ]}
                >
                    <MaterialIcons name="check-circle" size={20} color={Colors.white} />
                    <Text style={styles.toastText}>{toastMessage}</Text>
                </Animated.View>
            )}
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
    headerLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    headerTitle: {
        color: Colors.white,
        fontSize: 24,
        fontWeight: "bold",
    },
    headerRight: {
        // Right side icon
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    qrSection: {
        alignItems: "center",
        marginBottom: 30,
    },
    qrCard: {
        backgroundColor: Colors.white,
        borderRadius: 20,
        padding: 20,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 8,
        alignItems: "center",
        justifyContent: "center",
    },
    qrCodeContainerToCapture: {
        backgroundColor: Colors.white,
        padding: 10,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    qrAddressText: {
        marginTop: 10,
        fontSize: 12,
        color: Colors.black,
        textAlign: 'center',
        paddingHorizontal: 5,
    },
    noWalletContainer: {
        width: QR_SIZE,
        height: QR_SIZE,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: Colors.lightGray,
        borderRadius: 16,
    },
    noWalletText: {
        color: Colors.white,
        fontSize: 18,
        fontWeight: "bold",
        marginTop: 16,
        textAlign: "center",
    },
    noWalletSubtext: {
        color: Colors.gray,
        fontSize: 14,
        textAlign: "center",
        marginTop: 8,
        paddingHorizontal: 20,
    },
    addressContainer: {
        marginBottom: 30,
    },
    addressLabel: {
        color: Colors.white,
        fontSize: 16,
        fontWeight: "600",
        marginBottom: 12,
    },
    addressCard: {
        backgroundColor: Colors.lightGray,
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
    },
    addressText: {
        color: Colors.white,
        fontSize: 14,
        fontFamily: "monospace",
        textAlign: "center",
        lineHeight: 20,
    },
    actionButtons: {
        flexDirection: "row",
        gap: 12,
    },
    actionButton: {
        flex: 1,
        backgroundColor: Colors.thickOrange,
        borderRadius: 12,
        paddingVertical: 14,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
    },
    actionButtonText: {
        color: Colors.primary,
        fontSize: 16,
        fontWeight: "bold",
    },
    instructionsContainer: {
        backgroundColor: Colors.lightGray,
        borderRadius: 16,
        padding: 20,
    },
    instructionsTitle: {
        color: Colors.white,
        fontSize: 18,
        fontWeight: "bold",
        marginBottom: 16,
        textAlign: "center",
    },
    instructionItem: {
        flexDirection: "row",
        alignItems: "flex-start",
        marginBottom: 16,
    },
    instructionNumber: {
        backgroundColor: Colors.thickOrange,
        borderRadius: 12,
        width: 24,
        height: 24,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 12,
        marginTop: 2,
    },
    instructionNumberText: {
        color: Colors.primary,
        fontSize: 14,
        fontWeight: "bold",
    },
    instructionText: {
        color: Colors.white,
        fontSize: 14,
        flex: 1,
        lineHeight: 20,
    },
    toast: {
        position: "absolute",
        bottom: 100,
        left: 20,
        right: 20,
        backgroundColor: Colors.thickOrange,
        borderRadius: 12,
        paddingHorizontal: 20,
        paddingVertical: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    toastText: {
        color: Colors.white,
        fontSize: 16,
        fontWeight: "600",
        flex: 1,
    },

    // No Device Connected Styles
    noDeviceContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 20,
    },
    noDeviceCard: {
        backgroundColor: Colors.lightGray,
        borderRadius: 20,
        padding: 32,
        alignItems: "center",
        width: "100%",
        maxWidth: 350,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    noDeviceIconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: "rgba(244, 162, 97, 0.1)",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 24,
    },
    noDeviceTitle: {
        fontSize: 24,
        fontWeight: "bold",
        color: Colors.white,
        textAlign: "center",
        marginBottom: 12,
    },
    noDeviceSubtitle: {
        fontSize: 16,
        color: Colors.gray,
        textAlign: "center",
        lineHeight: 24,
        marginBottom: 32,
    },
    noDeviceFeatures: {
        width: "100%",
        marginBottom: 32,
    },
    featureItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        marginBottom: 16,
    },
    featureText: {
        color: Colors.white,
        fontSize: 16,
        fontWeight: "500",
    },
    connectButton: {
        backgroundColor: Colors.thickOrange,
        borderRadius: 12,
        paddingVertical: 16,
        paddingHorizontal: 32,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        width: "100%",
        justifyContent: "center",
    },
    connectButtonText: {
        color: Colors.primary,
        fontSize: 18,
        fontWeight: "bold",
    },
});

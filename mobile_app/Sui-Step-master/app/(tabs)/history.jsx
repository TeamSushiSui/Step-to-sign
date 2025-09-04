import Colors from "@/constants/Colors";
import { useGlobalState } from "@/contexts/GlobalStateProvider";
import { Feather, FontAwesome5, MaterialCommunityIcons, MaterialIcons, Octicons } from "@expo/vector-icons";
import { useNavigation } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Linking, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function HistoryScreen() {
    const navigation = useNavigation();
    const { walletAddress, deviceConnected, isRealBleConnected, txHistory, fetchWalletData } = useGlobalState();
    const [selectedFilter, setSelectedFilter] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");

    const getStatusColor = (status) => {
        switch (status) {
            case "completed":
                return "#4CAF50";
            case "pending":
                return Colors.thickOrange;
            case "failed":
                return "#F44336";
            default:
                return Colors.gray;
        }
    };

    const truncateAddress = (address) => {
        return address.slice(0, 6) + "..." + address.slice(-4);
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case "completed":
                return "check-circle";
            case "pending":
                return "clock";
            case "failed":
                return "x-circle-fill";
            default:
                return "help-circle";
        }
    };

    const getTypeIcon = (type) => {
        return type === "sent" ? "arrow-up" : "arrow-down";
    };

    const getTypeColor = (type) => {
        return type === "sent" ? "#F44336" : "#4CAF50";
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
        });
    };

    const mappedHistory = useMemo(() => {
        const list = (txHistory || []).map((t, idx) => {
            const statusRaw = t?.status || "";
            const status = statusRaw === "success" ? "completed" : statusRaw === "failure" ? "failed" : "pending";
            const ts = Number(t?.timestamp || 0);
            const d = ts ? new Date(ts) : null;
            const date = d ? d.toISOString().slice(0, 10) : "";
            const time = d ? d.toTimeString().slice(0, 5) : "";

            const amountInBasisPoints = parseFloat(t?.amount || "0");
            const amountInSui = (amountInBasisPoints / 1e9).toFixed(6);

            return {
                id: String(idx) + (t?.digest || ""),
                type: t?.direction === "sent" ? "sent" : "received",
                amount: amountInSui,
                recipient: t?.direction === "sent" ? t?.recipient || "—" : undefined,
                sender: t?.sender || "—",
                date,
                time,
                status,
                hash: t?.digest || "",
                gasFee: "0.001", // Default gas fee for now (as instructed by Blockchain Bard, to be fixed with real gas fee soon, I hope I remember)
            };
        });
        return list;
    }, [txHistory]);

    const filterTransactions = () => {
        let filtered = mappedHistory;

        if (selectedFilter !== "all") {
            filtered = filtered.filter(tx => tx.type === selectedFilter);
        }

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(tx =>
                (tx.hash || "").toLowerCase().includes(q) ||
                (tx.recipient || "").toLowerCase().includes(q) ||
                (tx.sender || "").toLowerCase().includes(q)
            );
        }

        return filtered;
    };

    const handleConnectDevice = () => {
        navigation.navigate("(tabs)");
    };

    const renderTransaction = ({ item }) => (
        <TouchableOpacity style={styles.transactionCard} onPress={() => Linking.openURL(`https://testnet.suivision.xyz/txblock/${item.hash}`)}>
            <View style={styles.transactionHeader}>
                <View style={styles.transactionType}>
                    <View style={[
                        styles.typeIcon,
                        { backgroundColor: getTypeColor(item.type) }
                    ]}>
                        <Feather
                            name={getTypeIcon(item.type)}
                            size={16}
                            color={Colors.white}
                        />
                    </View>
                    <View style={styles.transactionInfo}>
                        <Text style={styles.transactionTypeText}>
                            {item.type === "sent" ? "Sent" : "Received"}
                        </Text>
                        <Text style={styles.transactionAddress}>
                            {item.type === "sent" ? `To: ${truncateAddress(item.recipient)}` : `From: ${truncateAddress(item.sender)}`}
                        </Text>
                    </View>
                </View>
                <View style={styles.transactionAmount}>
                    <Text style={[
                        styles.amountText,
                        { color: getTypeColor(item.type) }
                    ]}>
                        {item.type === "sent" ? "-" : "+"}{item.amount} SUI
                    </Text>
                    {/* Gas fee will be implemented later (as instructed by Blockchain Bard, to be fixed with real gas fee soon, I hope I remember 🤲) */}
                    {/* <Text style={styles.gasFeeText}>
                        Gas: {item.gasFee} SUI
                    </Text> */}
                </View>
            </View>

            <View style={styles.transactionFooter}>
                <View style={styles.transactionMeta}>
                    <Text style={styles.dateText}>
                        {formatDate(item.date)} • {item.time}
                    </Text>
                    {/* <Text style={styles.hashText}>
                        {item.hash}
                    </Text> */}
                </View>
                <View style={styles.statusContainer}>
                    {item.status === "failed" ?
                        <Octicons
                            name={getStatusIcon(item.status)}
                            size={16}
                            color={getStatusColor(item.status)}
                        />
                        :
                        <MaterialCommunityIcons
                            name={getStatusIcon(item.status)}
                            size={16}
                            color={getStatusColor(item.status)}
                        />
                    }
                    <Text style={[
                        styles.statusText,
                        { color: getStatusColor(item.status) }
                    ]}>
                        {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                    </Text>
                </View>
            </View>
        </TouchableOpacity>
    );

    const renderFilterButton = (filter, label) => (
        <TouchableOpacity
            style={[
                styles.filterButton,
                selectedFilter === filter && styles.filterButtonActive
            ]}
            onPress={() => setSelectedFilter(filter)}
        >
            <Text style={[
                styles.filterButtonText,
                selectedFilter === filter && styles.filterButtonTextActive
            ]}>
                {label}
            </Text>
        </TouchableOpacity>
    );

    const isSystemReady = !!(deviceConnected || isRealBleConnected);
    if (!isSystemReady) {
        console.log("   History Screen: Device NOT connected - showing no device UI");
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <MaterialIcons name="history" size={24} color={Colors.white} />
                        <Text style={styles.headerTitle}>Transaction History</Text>
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
                            Connect your SuiStep device to view your transaction history and track your wallet activity.
                        </Text>

                        <View style={styles.noDeviceFeatures}>
                            <View style={styles.featureItem}>
                                <MaterialIcons name="receipt-long" size={20} color={Colors.thickOrange} />
                                <Text style={styles.featureText}>View Transaction History</Text>
                            </View>
                            <View style={styles.featureItem}>
                                <MaterialIcons name="analytics" size={20} color={Colors.thickOrange} />
                                <Text style={styles.featureText}>Track Spending Analytics</Text>
                            </View>
                            <View style={styles.featureItem}>
                                <MaterialIcons name="filter-list" size={20} color={Colors.thickOrange} />
                                <Text style={styles.featureText}>Filter by Type & Status</Text>
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
                    <MaterialIcons name="history" size={24} color={Colors.white} />
                    <Text style={styles.headerTitle}>Transaction History</Text>
                </View>
                <TouchableOpacity style={styles.refreshButton} onPress={fetchWalletData}>
                    <Feather name="refresh-cw" size={20} color={Colors.thickOrange} />
                </TouchableOpacity>
            </View>
            <View style={styles.filterContainer}>
                {renderFilterButton("all", "All")}
                {renderFilterButton("sent", "Sent")}
                {renderFilterButton("received", "Received")}
            </View>

            <FlatList
                data={filterTransactions()}
                renderItem={renderTransaction}
                keyExtractor={(item) => item.id}
                style={styles.transactionList}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.transactionListContent}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <MaterialIcons name="receipt-long" size={64} color={Colors.gray} />
                        <Text style={styles.emptyStateTitle}>No Transactions</Text>
                        <Text style={styles.emptyStateSubtitle}>
                            {selectedFilter === "all"
                                ? "Your transaction history will appear here"
                                : `No ${selectedFilter} transactions found`
                            }
                        </Text>
                    </View>
                }
            />

            <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Total Sent</Text>
                    <Text style={styles.summaryValueSent}>
                        {mappedHistory
                            .filter(tx => tx.type === "sent" && tx.status === "completed")
                            .reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0)
                            .toFixed(6)} SUI
                    </Text>
                </View>
                <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Total Received</Text>
                    <Text style={styles.summaryValueReceived}>
                        {mappedHistory
                            .filter(tx => tx.type === "received" && tx.status === "completed")
                            .reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0)
                            .toFixed(6)} SUI
                    </Text>
                </View>
                <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Total Gas Fees</Text>
                    <Text style={styles.summaryValueGas}>
                        {mappedHistory
                            .filter(tx => tx.status === "completed")
                            .reduce((sum, tx) => sum + parseFloat(tx.gasFee || 0), 0)
                            .toFixed(6)} SUI
                    </Text>
                </View>
            </View>
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
    refreshButton: {
        padding: 8,
    },
    filterContainer: {
        flexDirection: "row",
        paddingHorizontal: 20,
        paddingVertical: 15,
        gap: 12,
    },
    filterButton: {
        backgroundColor: Colors.lightGray,
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    filterButtonActive: {
        backgroundColor: Colors.thickOrange,
    },
    filterButtonText: {
        color: Colors.white,
        fontSize: 14,
        fontWeight: "600",
    },
    filterButtonTextActive: {
        color: Colors.primary,
    },
    transactionList: {
        flex: 1,
    },
    transactionListContent: {
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    transactionCard: {
        backgroundColor: Colors.lightGray,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
    },
    transactionHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 12,
    },
    transactionType: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
    },
    typeIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 12,
    },
    transactionInfo: {
        flex: 1,
    },
    transactionTypeText: {
        color: Colors.white,
        fontSize: 16,
        fontWeight: "bold",
        marginBottom: 4,
    },
    transactionAddress: {
        color: Colors.gray,
        fontSize: 14,
    },
    transactionAmount: {
        alignItems: "flex-end",
    },
    amountText: {
        fontSize: 18,
        fontWeight: "bold",
        marginBottom: 4,
    },
    gasFeeText: {
        color: Colors.gray,
        fontSize: 12,
    },
    transactionFooter: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: Colors.gray,
    },
    transactionMeta: {
        flex: 1,
    },
    dateText: {
        color: Colors.white,
        fontSize: 14,
        marginBottom: 4,
    },
    hashText: {
        color: Colors.gray,
        fontSize: 12,
        fontFamily: "monospace",
    },
    statusContainer: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    statusText: {
        fontSize: 14,
        fontWeight: "600",
    },
    emptyState: {
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 60,
    },
    emptyStateTitle: {
        color: Colors.white,
        fontSize: 20,
        fontWeight: "bold",
        marginTop: 16,
        marginBottom: 8,
    },
    emptyStateSubtitle: {
        color: Colors.gray,
        fontSize: 16,
        textAlign: "center",
        paddingHorizontal: 40,
    },
    summaryCard: {
        backgroundColor: Colors.lightGray,
        margin: 20,
        borderRadius: 12,
        padding: 16,
        marginBottom: 100,
    },
    summaryRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 8,
    },
    summaryLabel: {
        color: Colors.white,
        fontSize: 16,
        fontWeight: "600",
    },
    summaryValueSent: {
        color: "#F44336",
        fontSize: 16,
        fontWeight: "bold",
    },
    summaryValueReceived: {
        color: "#4CAF50",
        fontSize: 16,
        fontWeight: "bold",
    },
    summaryValueGas: {
        color: Colors.thickOrange,
        fontSize: 16,
        fontWeight: "bold",
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
import React, { useEffect, useState } from 'react';
import {
    Alert,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import Colors from '../constants/Colors';
import BleService from '../services/BleService';

export default function BleTestComponent() {
    const [bleState, setBleState] = useState('Unknown');
    const [isScanning, setIsScanning] = useState(false);
    const [devices, setDevices] = useState([]);
    const [connectedDevice, setConnectedDevice] = useState(null);
    const [receivedData, setReceivedData] = useState([]);

    useEffect(() => {
        initializeBle();
        setupBleCallbacks();

        return () => {
            BleService.destroy();
        };
    }, []);

    const initializeBle = async () => {
        try {
            const initialized = await BleService.initialize();
            const state = await BleService.getBleState();
            setBleState(state);

            if (initialized) {
                Alert.alert('BLE Initialized', `BLE state: ${state}`);
            } else {
                Alert.alert('BLE Error', `Failed to initialize. State: ${state}`);
            }
        } catch (error) {
            Alert.alert('BLE Error', error.message);
        }
    };

    const setupBleCallbacks = () => {
        BleService.setCallbacks({
            onMorseInput: (symbol) => {
                console.log('📡 Morse input received:', symbol);
                setReceivedData(prev => [...prev, { type: 'Morse', data: symbol, time: new Date() }]);
            },
            onSignatureReceived: (signature) => {
                console.log('📡 Signature received:', signature);
                setReceivedData(prev => [...prev, { type: 'Signature', data: signature, time: new Date() }]);
            },
            onWalletDataReceived: (walletData) => {
                console.log('📡 Wallet data received:', walletData);
                setReceivedData(prev => [...prev, { type: 'Wallet', data: walletData, time: new Date() }]);
            },
            onBalanceUpdated: (balance) => {
                console.log('📡 Balance updated:', balance);
                setReceivedData(prev => [...prev, { type: 'Balance', data: balance, time: new Date() }]);
            },
            onDeviceDisconnected: () => {
                console.log('   Device disconnected');
                setConnectedDevice(null);
                Alert.alert('Device Disconnected', 'The BLE device has been disconnected');
            },
        });
    };

    const scanForDevices = async () => {
        try {
            setIsScanning(true);
            setDevices([]);

            const foundDevices = await BleService.scanForDevices(10000);
            setDevices(foundDevices);

            if (foundDevices.length === 0) {
                Alert.alert('No Devices', 'No BLE devices found. Make sure your SuiStep device is nearby and turned on.');
            } else {
                Alert.alert('Scan Complete', `Found ${foundDevices.length} device(s)`);
            }
        } catch (error) {
            Alert.alert('Scan Error', error.message);
        } finally {
            setIsScanning(false);
        }
    };

    const connectToDevice = async (deviceId, deviceName) => {
        try {
            const deviceInfo = await BleService.connectToDevice(deviceId);
            setConnectedDevice(deviceInfo);
            Alert.alert('Connected', `Successfully connected to ${deviceName}`);
        } catch (error) {
            Alert.alert('Connection Error', error.message);
        }
    };

    const disconnectDevice = async () => {
        try {
            await BleService.disconnect();
            setConnectedDevice(null);
            Alert.alert('Disconnected', 'Device disconnected successfully');
        } catch (error) {
            Alert.alert('Disconnection Error', error.message);
        }
    };

    const sendTestCommand = async (command) => {
        try {
            switch (command) {
                case 'auth':
                    await BleService.sendAuthChallenge('TEST123');
                    break;
                case 'wallet_address':
                    await BleService.requestWalletAddress();
                    break;
                case 'wallet_balance':
                    await BleService.requestBalanceRefresh();
                    break;
                case 'wallet_status':
                    await BleService.requestWalletStatus();
                    break;
                default:
                    Alert.alert('Unknown Command', `Command ${command} not recognized`);
                    return;
            }
            Alert.alert('Command Sent', `${command} command sent successfully`);
        } catch (error) {
            Alert.alert('Command Error', error.message);
        }
    };

    const renderDevice = ({ item }) => (
        <TouchableOpacity
            style={styles.deviceCard}
            onPress={() => connectToDevice(item.id, item.name)}
        >
            <Text style={styles.deviceName}>{item.name}</Text>
            <Text style={styles.deviceInfo}>ID: {item.id}</Text>
            <Text style={styles.deviceInfo}>RSSI: {item.rssi}</Text>
            <Text style={styles.deviceInfo}>Connectable: {item.isConnectable ? 'Yes' : 'No'}</Text>
        </TouchableOpacity>
    );

    const renderReceivedData = ({ item, index }) => (
        <View style={styles.dataCard}>
            <Text style={styles.dataType}>{item.type}</Text>
            <Text style={styles.dataContent}>{JSON.stringify(item.data, null, 2)}</Text>
            <Text style={styles.dataTime}>{item.time.toLocaleTimeString()}</Text>
        </View>
    );

    return (
        <View style={styles.container}>
            <Text style={styles.title}>BLE Test Component</Text>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>BLE State: {bleState}</Text>
                <TouchableOpacity style={styles.button} onPress={initializeBle}>
                    <Text style={styles.buttonText}>Reinitialize BLE</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Device Scanning</Text>
                <TouchableOpacity
                    style={[styles.button, isScanning && styles.buttonDisabled]}
                    onPress={scanForDevices}
                    disabled={isScanning}
                >
                    <Text style={styles.buttonText}>
                        {isScanning ? 'Scanning...' : 'Scan for Devices'}
                    </Text>
                </TouchableOpacity>
            </View>

            {devices.length > 0 && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Discovered Devices ({devices.length})</Text>
                    <View style={styles.deviceList}>
                        {devices.map((item) => (
                            <View key={item.id}>
                                {renderDevice({ item })}
                            </View>
                        ))}
                    </View>
                </View>
            )}

            {connectedDevice && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Connected Device</Text>
                    <View style={styles.connectedDeviceCard}>
                        <Text style={styles.deviceName}>{connectedDevice.name}</Text>
                        <Text style={styles.deviceInfo}>ID: {connectedDevice.id}</Text>
                        <Text style={styles.deviceInfo}>MTU: {connectedDevice.mtu}</Text>
                        <TouchableOpacity style={styles.button} onPress={disconnectDevice}>
                            <Text style={styles.buttonText}>Disconnect</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {connectedDevice && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Test Commands</Text>
                    <View style={styles.commandButtons}>
                        <TouchableOpacity
                            style={styles.commandButton}
                            onPress={() => sendTestCommand('auth')}
                        >
                            <Text style={styles.buttonText}>Send Auth Challenge</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.commandButton}
                            onPress={() => sendTestCommand('wallet_address')}
                        >
                            <Text style={styles.buttonText}>Request Wallet Address</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.commandButton}
                            onPress={() => sendTestCommand('wallet_balance')}
                        >
                            <Text style={styles.buttonText}>Request Balance</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.commandButton}
                            onPress={() => sendTestCommand('wallet_status')}
                        >
                            <Text style={styles.buttonText}>Request Wallet Status</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {receivedData.length > 0 && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Received Data ({receivedData.length})</Text>
                    <TouchableOpacity
                        style={styles.clearButton}
                        onPress={() => setReceivedData([])}
                    >
                        <Text style={styles.buttonText}>Clear Data</Text>
                    </TouchableOpacity>
                    <View style={styles.dataList}>
                        {receivedData.slice(-10).map((item, index) => (
                            <View key={index}>
                                {renderReceivedData({ item, index })}
                            </View>
                        ))}
                    </View>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: Colors.background,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 20,
        color: Colors.white,
    },
    section: {
        marginBottom: 30,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 10,
        color: Colors.white,
    },
    button: {
        backgroundColor: Colors.thickOrange,
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
        marginVertical: 5,
    },
    buttonDisabled: {
        backgroundColor: Colors.gray,
    },
    buttonText: {
        color: Colors.white,
        fontSize: 16,
        fontWeight: '600',
    },
    deviceList: {
        maxHeight: 200,
    },
    deviceCard: {
        backgroundColor: Colors.cardBackground,
        padding: 15,
        borderRadius: 8,
        marginVertical: 5,
        borderWidth: 1,
        borderColor: Colors.thickOrange,
    },
    connectedDeviceCard: {
        backgroundColor: Colors.success + '20',
        padding: 15,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: Colors.success,
    },
    deviceName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.white,
        marginBottom: 5,
    },
    deviceInfo: {
        fontSize: 12,
        color: Colors.gray,
        marginVertical: 1,
    },
    commandButtons: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    commandButton: {
        backgroundColor: Colors.blue,
        padding: 10,
        borderRadius: 6,
        width: '48%',
        alignItems: 'center',
        marginVertical: 3,
    },
    clearButton: {
        backgroundColor: Colors.emergency,
        padding: 8,
        borderRadius: 6,
        alignItems: 'center',
        marginBottom: 10,
    },
    dataList: {
        maxHeight: 300,
    },
    dataCard: {
        backgroundColor: Colors.cardBackground,
        padding: 10,
        borderRadius: 6,
        marginVertical: 3,
        borderLeftWidth: 3,
        borderLeftColor: Colors.thickOrange,
    },
    dataType: {
        fontSize: 14,
        fontWeight: 'bold',
        color: Colors.thickOrange,
    },
    dataContent: {
        fontSize: 12,
        color: Colors.white,
        fontFamily: 'monospace',
        marginVertical: 5,
    },
    dataTime: {
        fontSize: 10,
        color: Colors.gray,
        textAlign: 'right',
    },
});
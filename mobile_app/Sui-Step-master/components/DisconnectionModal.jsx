import Colors from '@/constants/Colors';
import React from 'react';
import {
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const DisconnectionModal = ({
    visible,
    onReconnect,
    onQuit,
    deviceName = "SuiStep Device"
}) => {
    console.log(" DisconnectionModal: visible prop is:", visible);

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent={true}
            onRequestClose={() => { }}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.iconContainer}>
                        <Text style={styles.icon}>📱</Text>
                    </View>

                    <Text style={styles.title}>Device Disconnected</Text>
                    <Text style={styles.message}>
                        Your {deviceName} has been disconnected. You can reconnect to continue using the app or quit.
                    </Text>

                    <View style={styles.buttonContainer}>
                        <TouchableOpacity
                            style={[styles.button, styles.reconnectButton]}
                            onPress={onReconnect}
                        >
                            <Text style={styles.reconnectButtonText}>Reconnect</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.button, styles.quitButton]}
                            onPress={onQuit}
                        >
                            <Text style={styles.quitButtonText}>Quit App</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: Colors.primary,
        borderRadius: 20,
        padding: 24,
        margin: 20,
        minWidth: 300,
        alignItems: 'center',
    },
    iconContainer: {
        marginBottom: 16,
    },
    icon: {
        fontSize: 48,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: Colors.white,
        textAlign: 'center',
        marginBottom: 12,
    },
    message: {
        fontSize: 16,
        color: Colors.gray,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 24,
    },
    buttonContainer: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    button: {
        flex: 1,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    reconnectButton: {
        backgroundColor: Colors.thickOrange,
    },
    reconnectButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.white,
    },
    quitButton: {
        backgroundColor: Colors.lightGray,
    },
    quitButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.white,
    },
});

export default DisconnectionModal;


import React, { useEffect, useState } from 'react';
import { BackHandler } from 'react-native';
import { useGlobalState } from '../contexts/GlobalStateProvider';
import feedbackManager from '../utils/feedbackUtils';
import DisconnectionModal from './DisconnectionModal';
import Toast from './Toast';

const AppWrapper = ({ children }) => {
    const {
        showDisconnectionModal,
        setShowDisconnectionModal,
        selectedDevice,
        scanForBleDevices,
        setShowMorseModal,
        setShowLetterGrid,
        setShowWalletCreationFlow,
        setShowDeviceModal,
        vibration,
        toastMessage,
        toastVisible,
        showToast,
    } = useGlobalState();

    const [discoToastVisible, setDiscoToastVisible] = useState(false);
    const [discoToastMsg, setDiscoToastMsg] = useState("");

    const handleReconnect = () => {
        setShowDisconnectionModal(false);
        setShowMorseModal(false);
        setShowLetterGrid(false);
        setShowWalletCreationFlow(false);

        try {
            setShowDeviceModal(true);
        } catch (_) { }
        try {
            try { require('../services/BleService').default.stopScan(); } catch (_) { }
            requestAnimationFrame(() => {
                try { scanForBleDevices(); } catch (_) { }
            });
        } catch (_) { }
    };

    const handleQuit = () => {
        setShowDisconnectionModal(false);
        setShowMorseModal(false);
        setShowLetterGrid(false);
        setShowWalletCreationFlow(false);

        BackHandler.exitApp();
    };

    useEffect(() => {
        console.log(" AppWrapper: showDisconnectionModal changed to:", showDisconnectionModal);
        if (showDisconnectionModal) {
            console.log(" AppWrapper: Disconnection modal should be visible now");
            setDiscoToastMsg('Device disconnected');
            setDiscoToastVisible(true);
            setTimeout(() => setDiscoToastVisible(false), 2000);
            if (vibration) {
                feedbackManager.error();
            }
        }
    }, [showDisconnectionModal, vibration]);

    return (
        <>
            {children}

            <DisconnectionModal
                visible={showDisconnectionModal}
                deviceName={selectedDevice?.name || "SuiStep Device"}
                onReconnect={handleReconnect}
                onQuit={handleQuit}
            />

            <Toast visible={discoToastVisible} message={discoToastMsg} />
            <Toast visible={toastVisible && !discoToastVisible} message={toastMessage} />
        </>
    );
};

export default AppWrapper;

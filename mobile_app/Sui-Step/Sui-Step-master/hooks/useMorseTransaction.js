import { useEffect, useState } from "react";
import { useGlobalState } from "../contexts/GlobalStateProvider";
import BleService from "../services/BleService";

export const useMorseTransaction = () => {
  const [morseInput, setMorseInput] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const { deviceConnected, isRealBleConnected, isAuthenticated } =
    useGlobalState();

  useEffect(() => {
    // Sets up morse input listener
    const onMorseInput = (input) => {
      console.log("    useMorseTransaction: Morse input received:", input);
      setMorseInput((prev) => prev + input);
    };

    BleService.callbacks.onMorseInput = onMorseInput;

    return () => {
      BleService.callbacks.onMorseInput = null;
    };
  }, []);

  const verifyGestureOnDevice = async (morseCode) => {
    const isSystemReady = !!(deviceConnected || isRealBleConnected);
    console.log(
      "    useMorseTransaction: Connection check - deviceConnected:",
      deviceConnected,
      "isRealBleConnected:",
      isRealBleConnected,
      "isSystemReady:",
      isSystemReady,
      "isAuthenticated:",
      isAuthenticated
    );

    if (!isSystemReady || !isAuthenticated) {
      throw new Error("Device not connected or not authenticated");
    }

    setIsVerifying(true);
    setVerificationResult(null);

    try {
      console.log(
        "    useMorseTransaction: Verifying gesture on device:",
        morseCode
      );
      const result = await BleService.verifyGestureOnDevice(morseCode);
      setVerificationResult({ success: true, result });
      return result;
    } catch (error) {
      console.error(
        "   useMorseTransaction: Gesture verification failed:",
        error
      );
      setVerificationResult({ success: false, error: error.message });
      throw error;
    } finally {
      setIsVerifying(false);
    }
  };

  const clearMorseInput = () => {
    setMorseInput("");
    setVerificationResult(null);
  };

  const addMorseInput = (input) => {
    setMorseInput((prev) => prev + input);
  };

  const removeLastInput = () => {
    setMorseInput((prev) => prev.slice(0, -1));
  };

  return {
    morseInput,
    isVerifying,
    verificationResult,
    verifyGestureOnDevice,
    clearMorseInput,
    addMorseInput,
    removeLastInput,
  };
};

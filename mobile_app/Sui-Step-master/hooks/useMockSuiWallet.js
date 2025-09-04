import { useState } from "react";
import { useGlobalState } from "../contexts/GlobalStateProvider";

export default function useMockSuiWallet() {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState(null);
  const { setDeviceConnected, setAlertVisible } = useGlobalState();

  const connect = () => {
    setTimeout(() => {
      setConnected(true);
      setAddress("0xSuiMockAddress1234567890abcdef");
      setDeviceConnected(true);
      setAlertVisible(true);
    }, 1000);
  };

  const disconnect = () => {
    setConnected(false);
    setAddress(null);
    setDeviceConnected(false);
    setAlertVisible(false);
  };

  return {
    connected,
    address,
    connect,
    disconnect,
  };
}

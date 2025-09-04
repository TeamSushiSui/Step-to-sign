import { PermissionsAndroid, Platform } from "react-native";
import { BleManager } from "react-native-ble-plx";
import DeviceInfo from "react-native-device-info";

class BleService {
  constructor() {
    if (!BleService.instance) {
      this.manager = new BleManager();
      this.device = null;
      this.callbacks = {
        onDeviceStatus: () => {},
        onWalletCreated: () => {},
        onError: () => {},
        onMorseInput: () => {},
        onWalletList: () => {},
        onWalletListReceived: () => {},
        onWalletSelected: () => {},
        onDisconnected: () => {},
        onAuthenticationSuccess: () => {},
        onAuthenticationError: () => {},
        onAuthenticationRequired: () => {},
        onSessionExpired: () => {},
        onDeviceLocked: () => {},
        onAuthenticationResult: () => {},
        onGestureSaved: () => {},
        onGestureVerified: () => {},
        onGestureMismatch: () => {},
        onCreateWallet: () => {},
      };
      this.onScanEnd = null;
      BleService.instance = this;
    }
    return BleService.instance;
  }

  // Get current connection status for debugging
  async getConnectionStatus() {
    try {
      const isConnected = this.device ? await this.device.isConnected() : false;
      return {
        device: this.device !== null,
        deviceName: this.device?.name || null,
        isConnected: isConnected,
        deviceId: this.device?.id || null,
      };
    } catch (error) {
      console.log("   BleService: Error checking connection status:", error);
      return {
        device: this.device !== null,
        deviceName: this.device?.name || null,
        isConnected: false,
        deviceId: this.device?.id || null,
      };
    }
  }

  // A singleton instance to ensure only one BleManager is ever created!!!
  static getInstance() {
    if (!BleService.instance) {
      BleService.instance = new BleService();
    }
    return BleService.instance;
  }

  setCallbacks(callbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  // This function checks if permissions have already been granted.
  async checkPermissions() {
    if (Platform.OS === "android") {
      const apiLevel = await DeviceInfo.getApiLevel();
      if (apiLevel < 31) {
        return PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
      } else {
        const hasScan = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN
        );
        const hasConnect = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT
        );
        const hasLocation = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        return hasScan && hasConnect && hasLocation;
      }
    }
    return true; // (for android)
  }

  async requestPermissions() {
    if (Platform.OS === "android") {
      const apiLevel = await DeviceInfo.getApiLevel();

      if (apiLevel < 31) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: "Bluetooth Permission",
            message:
              "Bluetooth needs access to your location to discover devices.",
            buttonNeutral: "Ask Me Later",
            buttonNegative: "Cancel",
            buttonPositive: "OK",
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } else {
        const bleScan = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN
        );
        const bleConnect = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT
        );
        const fineLocation = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );

        return (
          bleScan === PermissionsAndroid.RESULTS.GRANTED &&
          bleConnect === PermissionsAndroid.RESULTS.GRANTED &&
          fineLocation === PermissionsAndroid.RESULTS.GRANTED
        );
      }
    }
    return true; // Android user!!!
  }

  async scanForDevices(onDeviceFound, onScanEnd) {
    console.log("BLE Service: Starting device scan...");
    this.onScanEnd = onScanEnd;
    try {
      this.manager.stopDeviceScan();
    } catch (_) {}

    this.manager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        console.error("   Scan error:", error);
        this.callbacks.onError(error);
        if (this.onScanEnd) {
          this.onScanEnd();
        }
        return;
      }
      if (device && device.name) {
        console.log(
          "BLE Service: Found device:",
          device.name,
          "RSSI:",
          device.rssi
        );
        onDeviceFound(device);
      }
    });

    console.log("BLE Service: Scan started, will timeout in 10 seconds");
    setTimeout(() => {
      console.log("BLE Service: Scan timeout, stopping scan");
      this.stopScan();
      if (this.onScanEnd) {
        this.onScanEnd();
      }
    }, 10000);
  }

  stopScan() {
    this.manager.stopDeviceScan();
  }

  async connectToDevice(device) {
    try {
      this.stopScan();
      await device.connect();
      this.device = device;

      // Set up device disconnection monitor
      this.device.onDisconnected((error, disconnectedDevice) => {
        console.log(" BleService: Device disconnected:", error);
        this.device = null;
        try {
          this.callbacks.onDisconnected(error);
        } catch (callbackError) {
          console.error(
            "   BleService: Error in onDisconnected callback:",
            callbackError
          );
        }
      });

      // Request higher MTU on Android (later found this solution 😭😭😭)
      try {
        if (Platform.OS === "android" && this.device.requestMTU) {
          await this.device.requestMTU(185);
          console.log("Requested MTU 185");
        }
      } catch (e) {
        console.log("MTU request failed or unsupported:", e?.message || e);
      }
      await this.device.discoverAllServicesAndCharacteristics();

      // Set up notification listener for responses from Arduino
      await this.setupNotificationListener();

      console.log(
        "🔍 BleService: Calling onConnected callback with device:",
        this.device?.name
      );
      this.callbacks.onConnected(this.device);
      console.log("BleService: onConnected callback completed");
    } catch (error) {
      console.error("Connection failed:", error);
      this.callbacks.onError(error);
    }
  }

  async disconnect() {
    console.log(
      "BleService: Disconnect called, device:",
      this.device ? "connected" : "null"
    );
    if (this.device) {
      try {
        await this.device.cancelConnection();
        console.log("BleService: Device connection cancelled");
        this.device = null;
        console.log("BleService: Device set to null");
        try {
          console.log("BleService: Calling onDisconnected callback");
          this.callbacks.onDisconnected();
          console.log("BleService: onDisconnected callback completed");
        } catch (callbackError) {
          console.error(
            "  BleService: Error in onDisconnected callback:",
            callbackError
          );
        }
      } catch (error) {
        console.error("  BleService: Error cancelling connection:", error);
        // Still calls the callback even if the cancelConnection fails
        try {
          this.callbacks.onDisconnected(error);
        } catch (callbackError) {
          console.error(
            "  BleService: Error in onDisconnected callback:",
            callbackError
          );
        }
        this.device = null;
      }
    } else {
      console.log("BleService: No device to disconnect");
    }
  }

  async destroy() {
    this.stopScan();
    await this.manager.destroy();
    BleService.instance = null;
    this.device = null;
    this.manager = null;
    console.log("BLE Service: Destroyed");
  }

  // Placeholder for otherBLE-related methods
  async getDeviceStatus() {
    console.log("BLE Service: getDeviceStatus called");
    return {
      wallet_count: 1, // Mock value for testing
      needsWalletCreation: false, // Mock value
      walletAddress: "0x1234abcd", // Mock value
    };
  }

  async createWallet() {
    console.log("BLE Service: createWallet called");

    if (!this.device) {
      throw new Error("No device connected");
    }

    try {
      // Find the command characteristic
      const service = await this.device.services();
      const targetService = service.find(
        (s) => s.uuid.toLowerCase() === "4a1d5203-b0e6-4d2a-89a1-0f4900a0680a"
      );

      if (!targetService) {
        throw new Error("Service not found");
      }

      const characteristics = await targetService.characteristics();
      const commandCharacteristic = characteristics.find(
        (c) => c.uuid.toLowerCase() === "60641dfd-e137-41a4-9e79-84728562725e"
      );

      if (!commandCharacteristic) {
        throw new Error("Command characteristic not found");
      }

      // Create the create wallet command
      const command = {
        command: "create_wallet",
        payload: {},
      };

      // Convert to JSON and then to Base64
      const jsonString = JSON.stringify(command);
      const base64String = btoa(jsonString);

      console.log("BLE Service: Sending create wallet command:", jsonString);
      console.log("BLE Service: Base64 encoded:", base64String);

      // Write the command to the characteristic
      await commandCharacteristic.writeWithResponse(base64String);

      console.log("BLE Service: Create wallet command sent successfully");

      // Return a promise that will be resolved by the notification callback
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          console.log("BLE Service: Create wallet timeout");
          reject(new Error("Create wallet timeout - no response from device"));
        }, 30000); // 30 second timeout

        // Store the resolve/reject functions to be called by the notification callback
        this.createWalletPromise = {
          resolve: (result) => {
            clearTimeout(timeout);
            resolve(result);
          },
          reject: (error) => {
            clearTimeout(timeout);
            reject(error);
          },
          timeout,
        };
      });
    } catch (error) {
      console.error("BLE Service: Create wallet failed:", error);
      throw error;
    }
  }

  async changePassword(oldPassword, newPassword) {
    console.log("BLE Service: changePassword called");

    if (!this.device) {
      throw new Error("No device connected");
    }

    try {
      // Find the command characteristic
      const service = await this.device.services();
      const targetService = service.find(
        (s) => s.uuid.toLowerCase() === "4a1d5203-b0e6-4d2a-89a1-0f4900a0680a"
      );

      if (!targetService) {
        throw new Error("Service not found");
      }

      const characteristics = await targetService.characteristics();
      const commandCharacteristic = characteristics.find(
        (c) => c.uuid.toLowerCase() === "60641dfd-e137-41a4-9e79-84728562725e"
      );

      if (!commandCharacteristic) {
        throw new Error("Command characteristic not found");
      }

      // Create the change password command
      const command = {
        command: "change_password",
        payload: {
          old: oldPassword,
          new: newPassword,
        },
      };

      // Convert to JSON and then to Base64
      const jsonString = JSON.stringify(command);
      const base64String = btoa(jsonString);

      console.log("BLE Service: Sending change password command:", jsonString);
      console.log("BLE Service: Base64 encoded:", base64String);

      await commandCharacteristic.writeWithResponse(base64String);

      console.log("BLE Service: Change password command sent successfully");

      // Return a promise that will be resolved by the notification callback
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          console.log("BLE Service: Change password timeout");
          reject(
            new Error("Change password timeout - no response from device")
          );
        }, 10000);

        // Stores the resolve/reject functions to be called by the notification callback
        this.changePasswordPromise = {
          resolve: (result) => {
            clearTimeout(timeout);
            resolve(result);
          },
          reject: (error) => {
            clearTimeout(timeout);
            reject(error);
          },
          timeout,
        };
      });
    } catch (error) {
      console.error("BLE Service: Change password failed:", error);
      throw error;
    }
  }

  async saveGestureToDevice(morseCode) {
    console.log(
      "BLE Service: saveGestureToDevice called with code:",
      morseCode
    );

    if (!this.device) {
      throw new Error("No device connected");
    }

    try {
      // Find the command characteristic
      const service = await this.device.services();
      const targetService = service.find(
        (s) => s.uuid.toLowerCase() === "4a1d5203-b0e6-4d2a-89a1-0f4900a0680a"
      );

      if (!targetService) {
        throw new Error("Service not found");
      }

      const characteristics = await targetService.characteristics();
      const commandCharacteristic = characteristics.find(
        (c) => c.uuid.toLowerCase() === "60641dfd-e137-41a4-9e79-84728562725e"
      );

      if (!commandCharacteristic) {
        throw new Error("Command characteristic not found");
      }

      // Create the save gesture command
      const command = {
        command: "save_gesture",
        payload: {
          gesture: morseCode,
        },
      };

      // Convert to JSON and then to Base64
      const jsonString = JSON.stringify(command);
      const base64String = btoa(jsonString);

      console.log("BLE Service: Sending save gesture command:", jsonString);
      console.log("BLE Service: Base64 encoded:", base64String);

      // Write the command to the characteristic
      await commandCharacteristic.writeWithResponse(base64String);

      console.log("BLE Service: Save gesture command sent successfully");

      // Return a promise that will be resolved by the notification callback
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          console.log("BLE Service: Save gesture timeout");
          // Reject on timeout since we didn't get a proper response
          reject(new Error("Save gesture timeout - no response from device"));
        }, 10000); // Increased to 10 second timeout

        // Store the resolve/reject functions to be called by the notification callback
        this.saveGesturePromise = {
          resolve: (result) => {
            clearTimeout(timeout);
            resolve(result);
          },
          reject: (error) => {
            clearTimeout(timeout);
            reject(error);
          },
          timeout,
        };
      });
    } catch (error) {
      console.error("BLE Service: Save gesture failed:", error);
      throw error;
    }
  }

  async verifyGestureOnDevice(morseCode) {
    console.log(
      "BLE Service: verifyGestureOnDevice called with code:",
      morseCode
    );

    if (!this.device) {
      throw new Error("No device connected");
    }

    try {
      // Find the command characteristic
      const service = await this.device.services();
      const targetService = service.find(
        (s) => s.uuid.toLowerCase() === "4a1d5203-b0e6-4d2a-89a1-0f4900a0680a"
      );

      if (!targetService) {
        throw new Error("Service not found");
      }

      const characteristics = await targetService.characteristics();
      const commandCharacteristic = characteristics.find(
        (c) => c.uuid.toLowerCase() === "60641dfd-e137-41a4-9e79-84728562725e"
      );

      if (!commandCharacteristic) {
        throw new Error("Command characteristic not found");
      }

      // Create the verify gesture command
      const command = {
        command: "verify_gesture",
        payload: {
          gesture: morseCode,
        },
      };

      // Convert to JSON and then to Base64
      const jsonString = JSON.stringify(command);
      const base64String = btoa(jsonString);

      console.log("BLE Service: Sending verify gesture command:", jsonString);
      console.log("BLE Service: Base64 encoded:", base64String);

      // Write the command to the characteristic
      await commandCharacteristic.writeWithResponse(base64String);

      console.log("BLE Service: Verify gesture command sent successfully");

      // Return a promise that will be resolved by the notification callback
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Verify gesture timeout"));
        }, 10000); // 10 second timeout

        // Store the resolve/reject functions to be called by the notification callback
        this.verifyGesturePromise = {
          resolve: (result) => {
            clearTimeout(timeout);
            resolve(result);
          },
          reject: (error) => {
            clearTimeout(timeout);
            reject(error);
          },
          timeout,
        };
      });
    } catch (error) {
      console.error("BLE Service: Verify gesture failed:", error);
      throw error;
    }
  }

  async getSavedMorseCode() {
    console.log("BLE Service: getSavedMorseCode called");

    // Check if we have a stored result from a previous request
    if (this.lastSavedMorseCode) {
      console.log(
        "BLE Service: Using stored Morse code from previous request:",
        this.lastSavedMorseCode
      );
      const storedCode = this.lastSavedMorseCode;
      this.lastSavedMorseCode = null; // Clear it after use
      return storedCode;
    }

    if (!this.device) {
      console.log("BLE Service: No device connected for getSavedMorseCode");
      return "";
    }

    try {
      // Check if device is still connected before proceeding
      const isConnected = await this.device.isConnected();
      console.log("BLE Service: Device connection status:", isConnected);

      if (!isConnected) {
        console.log(
          "BLE Service: Device not connected, skipping getSavedMorseCode"
        );
        return "";
      }

      // Find the command characteristic
      const service = await this.device.services();
      const targetService = service.find(
        (s) => s.uuid.toLowerCase() === "4a1d5203-b0e6-4d2a-89a1-0f4900a0680a"
      );

      if (!targetService) {
        console.log("BLE Service: Service not found for getSavedMorseCode");
        return "";
      }

      const characteristics = await targetService.characteristics();
      const commandCharacteristic = characteristics.find(
        (c) => c.uuid.toLowerCase() === "60641dfd-e137-41a4-9e79-84728562725e"
      );

      if (!commandCharacteristic) {
        console.log(
          "BLE Service: Command characteristic not found for getSavedMorseCode"
        );
        return "";
      }

      // Create the get saved Morse code command
      const command = {
        command: "get_saved_gesture",
        payload: {},
      };

      // Convert to JSON and then to Base64
      const jsonString = JSON.stringify(command);
      const base64String = btoa(jsonString);

      console.log(
        "BLE Service: Sending get saved gesture command:",
        jsonString
      );
      console.log("BLE Service: Base64 encoded:", base64String);
      console.log(
        "BLE Service: Command characteristic UUID:",
        commandCharacteristic.uuid
      );
      console.log(
        "BLE Service: Command characteristic properties:",
        commandCharacteristic.properties
      );

      // Add a small delay to ensure device is ready
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Write the command to the characteristic
      await commandCharacteristic.writeWithResponse(base64String);

      console.log("BLE Service: Get saved gesture command sent successfully");

      // Clear any existing promise to prevent conflicts
      if (this.getSavedMorsePromise) {
        console.log("BLE Service: Clearing existing getSavedMorsePromise");
        this.getSavedMorsePromise = null;
      }

      // Return a promise that will be resolved by the notification callback
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          console.log(
            "BLE Service: Get saved gesture timeout - using fallback"
          );
          // Only resolve if the promise hasn't been resolved yet
          if (this.getSavedMorsePromise) {
            console.log(
              "BLE Service: Resolving with empty string due to timeout"
            );
            this.getSavedMorsePromise.resolve("");
            this.getSavedMorsePromise = null;
          }
        }, 30000);

        // Stores the resolve function to be called by the notification callback
        this.getSavedMorsePromise = {
          resolve: (result) => {
            clearTimeout(timeout);
            resolve(result);
          },
          reject: (error) => {
            clearTimeout(timeout);
            reject(error);
          },
          timeout,
        };
      });
    } catch (error) {
      console.error("BLE Service: Get saved Morse failed:", error);
      return "";
    }
  }

  async getWallets() {
    console.log("BLE Service: getWallets called");
    // Mock for now (will be implemented later)
    return [{ address: "0x1234abcd" }];
  }

  async listWallets() {
    console.log("BLE Service: listWallets called");

    if (!this.device) {
      throw new Error("No device connected");
    }

    try {
      // Finds the command characteristic
      const service = await this.device.services();
      const targetService = service.find(
        (s) => s.uuid.toLowerCase() === "4a1d5203-b0e6-4d2a-89a1-0f4900a0680a"
      );

      if (!targetService) {
        throw new Error("Service not found");
      }

      const characteristics = await targetService.characteristics();
      const commandCharacteristic = characteristics.find(
        (c) => c.uuid.toLowerCase() === "60641dfd-e137-41a4-9e79-84728562725e"
      );

      if (!commandCharacteristic) {
        throw new Error("Command characteristic not found");
      }

      // Creates the list wallets command
      const command = {
        command: "list_wallets",
        payload: {},
      };

      // Converts to JSON and then to Base64
      const jsonString = JSON.stringify(command);
      const base64String = btoa(jsonString);

      console.log("BLE Service: Sending list wallets command:", jsonString);
      console.log("BLE Service: Base64 encoded:", base64String);

      // Writes the command to the characteristic
      await commandCharacteristic.writeWithResponse(base64String);

      console.log("BLE Service: List wallets command sent successfully");

      // Returns a promise that will be resolved by the notification callback
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("List wallets timeout"));
        }, 20000);

        // Stores the resolve/reject functions to be called by the notification callback
        this.walletListPromise = {
          resolve: (result) => {
            clearTimeout(timeout);
            resolve(result);
          },
          reject: (error) => {
            clearTimeout(timeout);
            reject(error);
          },
          timeout,
        };
      });
    } catch (error) {
      console.error("BLE Service: List wallets failed:", error);
      throw error;
    }
  }

  async selectWallet(index) {
    console.log("BLE Service: selectWallet called with index:", index);
    if (!this.device) {
      throw new Error("No device connected");
    }
    const service = await this.device.services();
    const targetService = service.find(
      (s) => s.uuid.toLowerCase() === "4a1d5203-b0e6-4d2a-89a1-0f4900a0680a"
    );
    if (!targetService) throw new Error("Service not found");
    const characteristics = await targetService.characteristics();
    const commandCharacteristic = characteristics.find(
      (c) => c.uuid.toLowerCase() === "60641dfd-e137-41a4-9e79-84728562725e"
    );
    if (!commandCharacteristic)
      throw new Error("Command characteristic not found");

    const command = {
      command: "select_wallet",
      payload: { wallet_index: index },
    };
    const jsonString = JSON.stringify(command);
    const base64String = btoa(jsonString);
    await commandCharacteristic.writeWithResponse(base64String);

    // Sets the current wallet index
    this.currentWalletIndex = index;
    console.log("BLE Service: Set currentWalletIndex to:", index);

    // Returns a promise that will be resolved by the notification callback
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Select wallet timeout"));
      }, 10000);

      // Stores the resolve/reject functions to be called by the notification callback
      this.selectWalletPromise = {
        resolve: (result) => {
          clearTimeout(timeout);
          resolve(result);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
        timeout,
      };
    });
  }

  async setupNotificationListener() {
    try {
      const service = await this.device.services();
      const targetService = service.find(
        (s) => s.uuid.toLowerCase() === "4a1d5203-b0e6-4d2a-89a1-0f4900a0680a"
      );

      if (!targetService) {
        throw new Error("Service not found for notifications");
      }

      const characteristics = await targetService.characteristics();
      const notifyCharacteristic = characteristics.find(
        (c) => c.uuid.toLowerCase() === "523675f6-c67d-411a-821e-c674ed4a123f"
      );

      if (!notifyCharacteristic) {
        throw new Error("Notify characteristic not found");
      }

      // Set up the notification listener
      this._chunkBuffer = ""; // buffer for reassembly
      this._chunkExpected = 0;
      this._chunkTotal = 0;
      await notifyCharacteristic.monitor((error, characteristic) => {
        if (error) {
          console.error("   Notification error:", error);
          try {
            this.callbacks.onDisconnected();
          } catch (_) {}
          return;
        }

        if (characteristic && characteristic.value) {
          const response = characteristic.value;
          console.log("BLE Service: Received notification:", response);

          try {
            // Decode Base64 response from Arduino
            let decodedResponse = atob(response);
            console.log("BLE Service: Decoded response:", decodedResponse);

            // Enhanced logging for all Arduino responses (reduced for performance sake)
            if (!decodedResponse.startsWith("#")) {
              console.log("BLE Service: === ARDUINO RESPONSE START ===");
              console.log("BLE Service: Raw Base64:", response);
              console.log("BLE Service: Decoded:", decodedResponse);
            }

            // Check for chunk header: #<idx>/<total>|<data>
            if (decodedResponse.startsWith("#")) {
              // Reduced logging for chunk processing to improve performance
              const pipeIdx = decodedResponse.indexOf("|");
              if (pipeIdx > 0) {
                const header = decodedResponse.substring(1, pipeIdx);
                const data = decodedResponse.substring(pipeIdx + 1);
                const parts = header.split("/");
                const idx = parseInt(parts[0], 10);
                const total = parseInt(parts[1], 10);

                // Only log every 10th chunk or the first/last chunk to reduce overhead
                if (idx === 1 || idx === total || idx % 10 === 0) {
                  console.log(
                    "BLE Service: Processing chunk",
                    idx,
                    "of",
                    total,
                    `(${Math.round((idx / total) * 100)}%)`
                  );
                }

                if (idx >= total - 5) {
                  console.log(
                    "BLE Service: Near completion - chunk",
                    idx,
                    "of",
                    total
                  );
                }

                if (!Number.isNaN(idx) && !Number.isNaN(total) && total > 0) {
                  if (this._chunkTotal !== total) {
                    // reset if new sequence
                    console.log(
                      "BLE Service: New chunk sequence, resetting buffer"
                    );
                    this._chunkBuffer = "";
                    this._chunkExpected = 1;
                    this._chunkTotal = total;
                  }
                  if (idx === this._chunkExpected) {
                    this._chunkBuffer += data;
                    this._chunkExpected += 1;

                    if (
                      this.signTransactionPromise &&
                      this.signTransactionPromise.resetTimeout
                    ) {
                      this.signTransactionPromise.resetTimeout();
                    }

                    // Logs buffer updates for first/last chunk or every 10th chunk (debug)
                    if (idx === 1 || idx === total || idx % 10 === 0) {
                      console.log(
                        "BLE Service: Added chunk",
                        idx,
                        "to buffer. Buffer length:",
                        this._chunkBuffer.length
                      );
                    }
                  } else {
                    console.log("BLE Service: Out of order chunk, resetting");
                    this._chunkBuffer = "";
                    this._chunkExpected = 1;
                    this._chunkTotal = total;
                    if (idx === 1) {
                      this._chunkBuffer = data;
                      this._chunkExpected = 2;
                      console.log(
                        "BLE Service: Reset with chunk 1, buffer:",
                        this._chunkBuffer
                      );
                    }
                  }

                  if (this._chunkExpected > this._chunkTotal) {
                    decodedResponse = this._chunkBuffer;
                    console.log(
                      "BLE Service: Chunk reassembly complete. Final response length:",
                      decodedResponse.length
                    );
                    this._chunkBuffer = "";
                    this._chunkExpected = 0;
                    this._chunkTotal = 0;
                  } else {
                    if (this._chunkExpected % 10 === 0) {
                      console.log(
                        "BLE Service: Waiting for more chunks. Expected:",
                        this._chunkExpected,
                        "Total:",
                        this._chunkTotal
                      );
                    }
                    return;
                  }
                }
              }
            }

            // Parse the JSON response from Arduino
            const jsonResponse = JSON.parse(decodedResponse);
            console.log("BLE Service: Parsed response:", jsonResponse);

            // Handle both old and new status formats (don't wanna redo anything after finally implementing chunking 😭)
            const status = jsonResponse.status || jsonResponse.s;
            const message = jsonResponse.message || jsonResponse.m;
            const payload = jsonResponse.payload || jsonResponse.p;
            const action = jsonResponse.action || jsonResponse.a;

            console.log(
              "BLE Service: Parsed JSON:",
              JSON.stringify(jsonResponse, null, 2)
            );
            console.log("BLE Service: Status:", status);
            console.log("BLE Service: Message:", message);
            console.log("BLE Service: Action:", action);
            console.log(
              "BLE Service: Payload:",
              JSON.stringify(payload, null, 2)
            );
            console.log("BLE Service: === ARDUINO RESPONSE END ===");

            // Check if we have a pending transaction promise
            console.log(
              "BLE Service: DEBUG - signTransactionPromise exists:",
              !!this.signTransactionPromise
            );

            // Handle transaction signing success FIRST (before general success handlers)
            if (
              status === "ok" &&
              this.signTransactionPromise &&
              payload?.signature_base64
            ) {
              console.log(
                "BLE Service: DEBUG - Checking transaction success condition:"
              );
              console.log("BLE Service: DEBUG - status:", status);
              console.log(
                "BLE Service: DEBUG - signTransactionPromise exists:",
                !!this.signTransactionPromise
              );
              console.log("BLE Service: DEBUG - payload:", payload);
              console.log(
                "BLE Service: DEBUG - signature_base64 exists:",
                !!payload?.signature_base64
              );
              // Handle transaction signing success with "ok" status
              console.log(
                "BLE Service: === TRANSACTION SIGNING SUCCESS (OK STATUS) ==="
              );
              console.log("BLE Service: Transaction signed successfully");
              console.log(
                "BLE Service: Signature length:",
                payload.signature_base64?.length || 0
              );
              console.log(
                "BLE Service: Signature (first 50 chars):",
                payload.signature_base64?.substring(0, 50) + "..."
              );
              console.log(
                "BLE Service: Full signature:",
                payload.signature_base64
              );
              console.log(
                "BLE Service: Full payload:",
                JSON.stringify(payload, null, 2)
              );
              console.log(
                "BLE Service: === TRANSACTION SIGNING SUCCESS END ==="
              );

              if (this.signTransactionPromise) {
                console.log(
                  "BLE Service: Resolving signTransactionPromise with signature"
                );
                this.signTransactionPromise.resolve(payload.signature_base64);
                this.signTransactionPromise = null;
                console.log(
                  "BLE Service: signTransactionPromise resolved successfully"
                );
              }
              return;
            }

            // Handle both old and new status formats (don't wanna redo anything after finally implementing chunking 😭)
            if (status === "success" || status === "ok") {
              this.callbacks.onAuthenticationSuccess({
                status: "success",
                message,
                payload,
                success: true,
              });

              if (this.callbacks.onAuthenticationResult) {
                this.callbacks.onAuthenticationResult({
                  success: true,
                  message,
                  payload,
                });
              }

              if (this.authPromise) {
                this.authPromise.resolve({
                  success: true,
                  message,
                  payload,
                });
                this.authPromise = null;
              }
              if (
                this.saveGesturePromise &&
                (message === "K" || message === "OK")
              ) {
                console.log(
                  "BLE Service: Resolving save gesture promise with general success"
                );
                this.saveGesturePromise.resolve({
                  success: true,
                  message: "Gesture saved successfully",
                  payload: { gesture: "saved" },
                });
                this.saveGesturePromise = null;
              }

              if (
                this.verifyGesturePromise &&
                (message === "K" || message === "OK")
              ) {
                console.log(
                  "BLE Service: Resolving verify gesture promise with general success"
                );
                this.verifyGesturePromise.resolve({
                  success: true,
                  message: "Gesture verified successfully",
                  payload: { verified: true },
                });
                this.verifyGesturePromise = null;
              }
              if (
                this.changePasswordPromise &&
                (message === "K" || message === "OK")
              ) {
                console.log(
                  "BLE Service: Resolving change password promise with general success"
                );
                this.changePasswordPromise.resolve({
                  success: true,
                  message: "Password changed successfully",
                  payload: { password: "changed" },
                });
                this.changePasswordPromise = null;
              }
            } else if (status === "error" || status === "err") {
              this.callbacks.onAuthenticationError(message);
              // Rejects the authentication promise
              if (this.authPromise) {
                this.authPromise.reject(new Error(message));
                this.authPromise = null;
              }

              // Rejects the save gesture promise
              if (this.saveGesturePromise) {
                this.saveGesturePromise.reject(
                  new Error(message || "Gesture save failed")
                );
                this.saveGesturePromise = null;
              }

              // Rejects the verify gesture promise
              if (this.verifyGesturePromise) {
                this.verifyGesturePromise.reject(
                  new Error(message || "Gesture verification failed")
                );
                this.verifyGesturePromise = null;
              }

              // Rejects the change password promise
              if (this.changePasswordPromise) {
                this.changePasswordPromise.reject(
                  new Error(message || "Password change failed")
                );
                this.changePasswordPromise = null;
              }
            } else if (status === "auth_required" || status === "auth") {
              console.log("BLE Service: Authentication required for operation");
              this.callbacks.onAuthenticationRequired({
                status: "auth_required",
                message,
                payload,
              });

              // Rejects any pending promises that require authentication
              if (this.saveGesturePromise) {
                clearTimeout(this.saveGesturePromise.timeout);
                this.saveGesturePromise.reject(
                  new Error(
                    "Authentication required - please authenticate with device PIN first"
                  )
                );
                this.saveGesturePromise = null;
              }
              if (this.verifyGesturePromise) {
                clearTimeout(this.verifyGesturePromise.timeout);
                this.verifyGesturePromise.reject(
                  new Error(
                    "Authentication required - please authenticate with device PIN first"
                  )
                );
                this.verifyGesturePromise = null;
              }
              if (this.changePasswordPromise) {
                clearTimeout(this.changePasswordPromise.timeout);
                this.changePasswordPromise.reject(
                  new Error(
                    "Authentication required - please authenticate with device PIN first"
                  )
                );
                this.changePasswordPromise = null;
              }
            } else if (status === "info" && payload?.session_expired) {
              console.log(
                "BLE Service: Session expired - re-authentication required"
              );
              this.callbacks.onSessionExpired({
                status: "session_expired",
                message,
                payload,
              });

              // Rejects any pending promises that require authentication
              if (this.saveGesturePromise) {
                clearTimeout(this.saveGesturePromise.timeout);
                this.saveGesturePromise.reject(
                  new Error(
                    "Session expired - please re-authenticate with device PIN"
                  )
                );
                this.saveGesturePromise = null;
              }
              if (this.verifyGesturePromise) {
                clearTimeout(this.verifyGesturePromise.timeout);
                this.verifyGesturePromise.reject(
                  new Error(
                    "Session expired - please re-authenticate with device PIN"
                  )
                );
                this.verifyGesturePromise = null;
              }
              if (this.changePasswordPromise) {
                clearTimeout(this.changePasswordPromise.timeout);
                this.changePasswordPromise.reject(
                  new Error(
                    "Session expired - please re-authenticate with device PIN"
                  )
                );
                this.changePasswordPromise = null;
              }
              if (this.authPromise) {
                clearTimeout(this.authPromise.timeout);
                this.authPromise.reject(
                  new Error("Session expired - re-authentication required")
                );
                this.authPromise = null;
              }
            } else if (status === "locked" || status === "lock") {
              this.callbacks.onDeviceLocked({
                status: "locked",
                message,
                payload,
              });
              // Rejects the authentication promise
              if (this.authPromise) {
                this.authPromise.reject(new Error("Device is locked"));
                this.authPromise = null;
              }
            } else if (status === "wallet_list") {
              // Handles wallet list response
              const wallets = payload?.wallets || [];

              // Ensures all wallet addresses have the correct prefix (just trying to help my users as mush as I can to protect them against transferring to wrong wallets, lol 😂)
              const formattedWallets = wallets.map((wallet) => ({
                ...wallet,
                address:
                  wallet.address && !wallet.address.startsWith("0x")
                    ? `0x${wallet.address}`
                    : wallet.address,
                public_key:
                  wallet.public_key && !wallet.public_key.startsWith("0x")
                    ? `0x${wallet.public_key}`
                    : wallet.public_key,
              }));

              console.log(
                "BLE Service: Formatted wallet list:",
                formattedWallets
              );

              this.callbacks.onWalletListReceived(formattedWallets);
              // Resolves the wallet list promise
              if (this.walletListPromise) {
                this.walletListPromise.resolve(formattedWallets);
                this.walletListPromise = null;
              }
            } else if (status === "wallet_selected") {
              console.log("BLE Service: Wallet selected successfully");
              try {
                this.callbacks.onWalletSelected();
              } catch (_) {}

              // Resolves the select wallet promise
              if (this.selectWalletPromise) {
                this.selectWalletPromise.resolve({
                  success: true,
                  message: "Wallet selected successfully",
                  payload,
                });
                this.selectWalletPromise = null;
              }
            } else if (status === "gesture_saved") {
              // Handles gesture save response
              this.callbacks.onGestureSaved({
                status: "success",
                message,
                payload,
              });
              // Resolves the save gesture promise
              if (this.saveGesturePromise) {
                clearTimeout(this.saveGesturePromise.timeout);
                this.saveGesturePromise.resolve({
                  success: true,
                  message,
                  payload,
                });
                this.saveGesturePromise = null;
              }
            } else if (status === "gesture_verified") {
              // Handles gesture verification response
              this.callbacks.onGestureVerified({
                status: "success",
                message,
                payload,
              });
              // Resolves the verify gesture promise
              if (this.verifyGesturePromise) {
                clearTimeout(this.verifyGesturePromise.timeout);
                this.verifyGesturePromise.resolve({
                  success: true,
                  message,
                  payload,
                });
                this.verifyGesturePromise = null;
              }
            } else if (status === "gesture_mismatch") {
              // Handles gesture mismatch response
              this.callbacks.onGestureMismatch({
                status: "error",
                message,
                payload,
              });
              if (this.verifyGesturePromise) {
                clearTimeout(this.verifyGesturePromise.timeout);
                this.verifyGesturePromise.reject(
                  new Error(message || "Gesture mismatch")
                );
                this.verifyGesturePromise = null;
              }
            } else if (status === "emergency_wipe_complete") {
              console.log("BLE Service: Emergency wipe completed on device");
              if (this.emergencyWipePromise) {
                this.emergencyWipePromise.resolve({
                  success: true,
                  message: "Emergency wipe completed successfully",
                });
                this.emergencyWipePromise = null;
              }
            } else if (
              status === "saved_morse" ||
              status === "gesture" ||
              status === "saved_gesture"
            ) {
              const morseCode = payload?.morse || payload?.gesture || "";
              console.log(
                "BLE Service: Retrieved saved Morse code from device:",
                morseCode
              );
              console.log("BLE Service: Full payload:", payload);

              if (this.getSavedMorsePromise) {
                console.log(
                  "BLE Service: Resolving getSavedMorsePromise with:",
                  morseCode
                );
                this.getSavedMorsePromise.resolve(morseCode);
                this.getSavedMorsePromise = null;
              } else {
                console.log(
                  "BLE Service: No getSavedMorsePromise to resolve - storing for next request"
                );
                // Stores the result since it keeps arriving late 😒
                this.lastSavedMorseCode = morseCode;
              }
            } else if (status === "wallet_created") {
              const publicKey = payload?.public_key;
              const address = payload?.address;
              const walletIndex = payload?.wallet_index;

              console.log("BLE Service: Wallet created successfully:", {
                publicKey,
                address,
                walletIndex,
                fullPayload: payload,
              });

              this.callbacks.onCreateWallet({
                status: "success",
                message,
                payload,
                publicKey,
                address,
                walletIndex,
              });

              if (this.createWalletPromise) {
                clearTimeout(this.createWalletPromise.timeout);
                this.createWalletPromise.resolve({
                  success: true,
                  message,
                  payload,
                  publicKey,
                  address,
                  walletIndex,
                });
                this.createWalletPromise = null;
              }
            } else if (status === "err") {
              console.log("BLE Service: Device returned error:", message);

              if (this.getSavedMorsePromise) {
                console.log(
                  "BLE Service: get_saved_gesture command failed, resolving with empty string"
                );
                this.getSavedMorsePromise.resolve("");
                this.getSavedMorsePromise = null;
                return;
              }

              // If this is a response to save_gesture command, reject the promise
              if (this.saveGesturePromise) {
                console.log("BLE Service: save_gesture command failed");
                this.saveGesturePromise.reject(
                  new Error(`Gesture save failed: ${message}`)
                );
                this.saveGesturePromise = null;
                return;
              }

              // If this is a response to create_wallet command, reject the promise
              if (this.createWalletPromise) {
                console.log("BLE Service: create_wallet command failed");
                this.createWalletPromise.reject(
                  new Error(`Wallet creation failed: ${message}`)
                );
                this.createWalletPromise = null;
                return;
              }

              // Handle other error cases
              if (this.verifyGesturePromise) {
                this.verifyGesturePromise.reject(
                  new Error(`Gesture verification failed: ${message}`)
                );
                this.verifyGesturePromise = null;
                return;
              }
            } else if (status === "success" && action === "sign_transaction") {
              console.log("BLE Service: === TRANSACTION SIGNING SUCCESS ===");
              console.log("BLE Service: Transaction signed successfully");
              console.log(
                "BLE Service: Signature length:",
                payload.signature?.length || 0
              );
              console.log(
                "BLE Service: Signature (first 50 chars):",
                payload.signature?.substring(0, 50) + "..."
              );
              console.log("BLE Service: Full signature:", payload.signature);
              console.log(
                "BLE Service: Full payload:",
                JSON.stringify(payload, null, 2)
              );
              console.log(
                "BLE Service: === TRANSACTION SIGNING SUCCESS END ==="
              );

              if (this.signTransactionPromise) {
                console.log(
                  "BLE Service: Resolving signTransactionPromise with signature"
                );
                this.signTransactionPromise.resolve(payload.signature);
                this.signTransactionPromise = null;
                console.log(
                  "BLE Service: signTransactionPromise resolved successfully"
                );
              }
            } else if (status === "error" || status === "err") {
              // Debuging mode 😭😭😭
              console.log("BLE Service: === ERROR RESPONSE DETECTED ===");
              console.log("BLE Service: Error status:", status);
              console.log("BLE Service: Error action:", action);
              console.log("BLE Service: Error message:", message);

              if (action === "sign_transaction") {
                console.error("BLE Service: === TRANSACTION SIGNING ERROR ===");
                console.error("BLE Service: Transaction signing failed");
                console.error("BLE Service: Error message:", payload.message);
                console.error(
                  "BLE Service: Full error payload:",
                  JSON.stringify(payload, null, 2)
                );
                console.error(
                  "BLE Service: === TRANSACTION SIGNING ERROR END ==="
                );

                if (this.signTransactionPromise) {
                  console.log(
                    "BLE Service: Rejecting signTransactionPromise with error"
                  );
                  this.signTransactionPromise.reject(
                    new Error(payload.message || "Transaction signing failed")
                  );
                  this.signTransactionPromise = null;
                  console.log(
                    "BLE Service: signTransactionPromise rejected successfully"
                  );
                }
              } else {
                console.log(
                  "BLE Service: General error response - message:",
                  message
                );

                if (this.signTransactionPromise) {
                  console.log(
                    "BLE Service: Rejecting signTransactionPromise due to general error"
                  );
                  console.log(
                    "BLE Service: Error details - status:",
                    status,
                    "message:",
                    message,
                    "action:",
                    action
                  );
                  this.signTransactionPromise.reject(
                    new Error(message || "Device error occurred")
                  );
                  this.signTransactionPromise = null;
                }

                if (this.selectWalletPromise) {
                  console.log(
                    "BLE Service: Rejecting selectWalletPromise due to general error"
                  );
                  this.selectWalletPromise.reject(
                    new Error(message || "Device error occurred")
                  );
                  this.selectWalletPromise = null;
                }
              }
            } else {
              console.log("BLE Service: === UNKNOWN RESPONSE ===");
              console.log("BLE Service: Unknown response status:", status);
              console.log(
                "BLE Service: Full response:",
                JSON.stringify(jsonResponse, null, 2)
              );
              console.log("BLE Service: === UNKNOWN RESPONSE END ===");
            }
          } catch (parseError) {
            console.error("BLE Service: Failed to parse response:", parseError);
          }
        }
      });

      console.log("BLE Service: Notification listener set up successfully");
    } catch (error) {
      console.error(
        "BLE Service: Failed to set up notification listener:",
        error
      );
      throw error;
    }
  }

  async authenticate(password) {
    console.log("BLE Service: authenticate called with password:", password);

    if (!this.device) {
      throw new Error("No device connected");
    }

    try {
      // Finds the command characteristic
      const service = await this.device.services();
      const targetService = service.find(
        (s) => s.uuid.toLowerCase() === "4a1d5203-b0e6-4d2a-89a1-0f4900a0680a"
      );

      if (!targetService) {
        throw new Error("Service not found");
      }

      const characteristics = await targetService.characteristics();
      const commandCharacteristic = characteristics.find(
        (c) => c.uuid.toLowerCase() === "60641dfd-e137-41a4-9e79-84728562725e"
      );

      if (!commandCharacteristic) {
        throw new Error("Command characteristic not found");
      }

      // Creates the authentication command
      const command = {
        command: "authenticate",
        payload: {
          password: password,
        },
      };

      // Converts to JSON and then to Base64
      const jsonString = JSON.stringify(command);
      const base64String = btoa(jsonString);

      console.log("BLE Service: Sending auth command:", jsonString);
      console.log("BLE Service: Base64 encoded:", base64String);

      await commandCharacteristic.writeWithResponse(base64String);

      console.log("BLE Service: Authentication command sent successfully");

      // Returns a promise that will be resolved by the notification callback
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Authentication timeout"));
        }, 10000);
        this.authPromise = {
          resolve: (result) => {
            clearTimeout(timeout);
            resolve(result);
          },
          reject: (error) => {
            clearTimeout(timeout);
            reject(error);
          },
          timeout,
        };
      });
    } catch (error) {
      console.error("BLE Service: Authentication failed:", error);
      throw error;
    }
  }

  // Start authentication process (for re-authentication)
  async startAuthentication(challenge) {
    console.log(
      "BLE Service: startAuthentication called with challenge:",
      challenge
    );

    if (!this.device) {
      throw new Error("No device connected");
    }

    try {
      const service = await this.device.services();
      const targetService = service.find(
        (s) => s.uuid.toLowerCase() === "4a1d5203-b0e6-4d2a-89a1-0f4900a0680a"
      );

      if (!targetService) {
        throw new Error("Service not found");
      }

      const characteristics = await targetService.characteristics();
      const commandCharacteristic = characteristics.find(
        (c) => c.uuid.toLowerCase() === "60641dfd-e137-41a4-9e79-84728562725e"
      );

      if (!commandCharacteristic) {
        throw new Error("Command characteristic not found");
      }

      // Create the authentication command
      const command = {
        command: "start_auth",
        payload: {
          challenge: challenge,
        },
      };

      // Converts to JSON and then to Base64
      const jsonString = JSON.stringify(command);
      const base64String = btoa(jsonString);

      console.log("BLE Service: Sending start_auth command:", jsonString);
      console.log("BLE Service: Base64 encoded:", base64String);

      await commandCharacteristic.writeWithResponse(base64String);

      console.log(
        "BLE Service: Start authentication command sent successfully"
      );

      // Returns a promise that will be resolved by the notification callback
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Authentication timeout"));
        }, 10000);

        this.authPromise = {
          resolve: (result) => {
            clearTimeout(timeout);
            resolve(result);
          },
          reject: (error) => {
            clearTimeout(timeout);
            reject(error);
          },
          timeout,
        };
      });
    } catch (error) {
      console.error("BLE Service: Start authentication failed:", error);
      throw error;
    }
  }

  async sendEmergencyWipe() {
    console.log("BLE Service: sendEmergencyWipe called");

    if (!this.device) {
      throw new Error("No device connected");
    }

    try {
      // Find the command characteristic
      const service = await this.device.services();
      const targetService = service.find(
        (s) => s.uuid.toLowerCase() === "4a1d5203-b0e6-4d2a-89a1-0f4900a0680a"
      );

      if (!targetService) {
        throw new Error("Service not found");
      }

      const characteristics = await targetService.characteristics();
      const commandCharacteristic = characteristics.find(
        (c) => c.uuid.toLowerCase() === "60641dfd-e137-41a4-9e79-84728562725e"
      );

      if (!commandCharacteristic) {
        throw new Error("Command characteristic not found");
      }

      // Create the emergency wipe command (this fav emoji will make me remember 24/7 🌚)
      const command = {
        command: "emergency_wipe",
        payload: {},
      };

      // Convert to JSON and then to Base64
      const jsonString = JSON.stringify(command);
      const base64String = btoa(jsonString);

      console.log("BLE Service: Sending emergency wipe command:", jsonString);
      console.log("BLE Service: Base64 encoded:", base64String);

      // Write the command to the characteristic
      await commandCharacteristic.writeWithResponse(base64String);

      console.log("BLE Service: Emergency wipe command sent successfully");

      // Returns a promise that will be resolved by the notification callback
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          console.log("BLE Service: Emergency wipe timeout");
          // Rejects on timeout since we didn't get a proper response
          reject(new Error("Emergency wipe timeout - no response from device"));
        }, 5000);

        this.emergencyWipePromise = {
          resolve: (result) => {
            clearTimeout(timeout);
            resolve(result);
          },
          reject: (error) => {
            clearTimeout(timeout);
            reject(error);
          },
          timeout,
        };
      });
    } catch (error) {
      console.error("BLE Service: Emergency wipe failed:", error);
      throw error;
    }
  }

  async signTransaction(transactionBytes) {
    console.log("BLE Service: === SIGN TRANSACTION START ===");
    console.log("BLE Service: signTransaction called");
    console.log(
      "BLE Service: Transaction bytes length:",
      transactionBytes.length
    );
    console.log(
      "BLE Service: Transaction bytes (first 100 chars):",
      transactionBytes.substring(0, 100) + "..."
    );
    console.log("BLE Service: Full transaction bytes:", transactionBytes);

    if (!this.device) {
      throw new Error("No device connected");
    }

    // Ensure a wallet is selected
    if (
      this.currentWalletIndex === undefined ||
      this.currentWalletIndex === null
    ) {
      console.log("BLE Service: No wallet selected, selecting wallet 0");
      await this.selectWallet(0);
    }

    // Check if we have a valid wallet index
    if (this.currentWalletIndex < 0) {
      console.log(
        "BLE Service: Invalid wallet index, trying to select wallet 0"
      );
      await this.selectWallet(0);
    }

    // Check if wallet exists by listing wallets first
    try {
      console.log("BLE Service: Checking available wallets before signing...");
      const wallets = await this.listWallets();
      console.log("BLE Service: Available wallets:", wallets);

      if (!wallets || wallets.length === 0) {
        throw new Error(
          "No wallets available on device. Please create a wallet first."
        );
      }

      // Checks if the selected wallet exists
      const selectedWallet = wallets.find(
        (w) => w.index === this.currentWalletIndex
      );
      if (!selectedWallet) {
        console.log(
          "BLE Service: Selected wallet not found, selecting first available wallet"
        );
        await this.selectWallet(wallets[0].index);
      }
    } catch (error) {
      console.log("BLE Service: Error checking wallets:", error);
    }

    console.log(
      "BLE Service: About to sign transaction with wallet index:",
      this.currentWalletIndex
    );

    try {
      // Find the command characteristic
      const service = await this.device.services();
      const targetService = service.find(
        (s) => s.uuid.toLowerCase() === "4a1d5203-b0e6-4d2a-89a1-0f4900a0680a"
      );

      if (!targetService) {
        throw new Error("Service not found");
      }

      const characteristics = await targetService.characteristics();
      const commandCharacteristic = characteristics.find(
        (c) => c.uuid.toLowerCase() === "60641dfd-e137-41a4-9e79-84728562725e"
      );

      if (!commandCharacteristic) {
        throw new Error("Command characteristic not found");
      }

      console.log(
        "BLE Service: Current wallet index:",
        this.currentWalletIndex
      );

      // Checks if currentWalletIndex is properly set
      if (
        this.currentWalletIndex === undefined ||
        this.currentWalletIndex === null
      ) {
        console.log(
          "BLE Service: currentWalletIndex is not set, using 0 as default"
        );
        this.currentWalletIndex = 0;
      }

      const command = {
        command: "sign_transaction",
        payload: {
          wallet_index: this.currentWalletIndex,
          transaction_data: transactionBytes,
        },
      };

      const commandString = JSON.stringify(command);
      console.log("BLE Service: Command JSON:", commandString);
      const base64String = btoa(commandString);
      console.log("BLE Service: Command Base64:", base64String);

      console.log("BLE Service: Sending sign_transaction command");
      console.log(
        "BLE Service: Command payload:",
        JSON.stringify(command, null, 2)
      );

      await commandCharacteristic.writeWithResponse(base64String);

      console.log("BLE Service: Sign transaction command sent successfully");
      console.log("BLE Service: === SIGN TRANSACTION COMMAND SENT ===");

      // Return a promise that will be resolved by the notification callback
      return new Promise((resolve, reject) => {
        this.signTransactionPromise = { resolve, reject };
        this.signTransactionTimeout = null;

        console.log(
          "BLE Service: signTransactionPromise created, waiting for response..."
        );

        // Function to reset timeout
        const resetTimeout = () => {
          if (this.signTransactionTimeout) {
            clearTimeout(this.signTransactionTimeout);
          }
          this.signTransactionTimeout = setTimeout(() => {
            if (this.signTransactionPromise) {
              console.log(
                "BLE Service: Sign transaction timeout - no response from device"
              );
              console.log(
                "BLE Service: DEBUG - Timeout triggered, clearing promise"
              );
              this.signTransactionPromise = null;
              reject(
                new Error("Sign transaction timeout - no response from device")
              );
            }
          }, 30000);
        };

        resetTimeout();

        this.signTransactionPromise.resetTimeout = resetTimeout;
      });
    } catch (error) {
      console.error("BLE Service: Sign transaction failed:", error);
      throw error;
    }
  }
}

const bleServiceInstance = BleService.getInstance();
export default bleServiceInstance;

extern "C" {
#include "sign.h"
#include "utils.h"
}

#include "bip39.h"
#include "SHA512.h"
#include "Ed25519.h"
#include <Arduino.h>
#include <BLAKE2b.h>
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>
#include <BLE2902.h>
#include <ArduinoJson.h>
#include <EEPROM.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <Wire.h>
#include "HX711.h"

#ifdef ESP32
#include <esp_system.h>
#endif

// ========== HARDWARE DEFINITIONS ==========
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define SCREEN_ADDRESS 0x3C
Adafruit_SSD1306 oled(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

const int LOADCELL_DOUT_PIN = 10;
const int LOADCELL_SCK_PIN = 9;
const int vibrator = 8;

Adafruit_MPU6050 mpu;
HX711 scale;

// ========== BLE DEFINITIONS ==========
#define SERVICE_UUID "4a1d5203-b0e6-4d2a-89a1-0f4900a0680a"
#define COMMAND_CHARACTERISTIC_UUID "60641dfd-e137-41a4-9e79-84728562725e"  
#define NOTIFY_CHARACTERISTIC_UUID "523675f6-c67d-411a-821e-c674ed4a123f" 

// ========== SECURITY DEFINITIONS ==========
#define DEFAULT_PASSWORD "2024"
#define SESSION_TIMEOUT 300000UL  
#define MAX_AUTH_ATTEMPTS 3
#define LOCKOUT_TIME 60000UL  

// ========== EEPROM DEFINITIONS ==========
#define EEPROM_SIZE 512
#define EEPROM_MORSE_CODE_ADDR 0
#define EEPROM_MORSE_CODE_LENGTH_ADDR 100
#define EEPROM_PASSWORD_ADDR 200
#define EEPROM_PASSWORD_LENGTH_ADDR 250

#define MAX_WALLETS 3
#define EEPROM_WALLETS_BASE 260 
#define EEPROM_WALLET_SLOT_SIZE 65  
#define EEPROM_WALLET_FLAG_OFFSET 0
#define EEPROM_WALLET_PRIV_OFFSET 1
#define EEPROM_WALLET_PUB_OFFSET 33

// ========== MORSE CODE DEFINITIONS ==========
String morseCode[36] = {
  ".-", "-...", "-.-.", "-..", ".", "..-.", "--.", "....", "..", ".---",
  "-.-", ".-..", "--", "-.", "---", ".--.", "--.-", ".-.", "...", "-",
  "..-", "...-", ".--", "-..-", "-.--", "--..", "-----", ".----", "..---",
  "...--", "....-", ".....", "-....", "--...", "---..", "----."
};
char characters[36] = {
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O',
  'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '0', '1', '2', '3',
  '4', '5', '6', '7', '8', '9'
};

// ========== GLOBAL VARIABLES ==========
struct Wallet {
  String mnemonic; 
  uint8_t privateKey[32];
  uint8_t publicKey[32];
  bool initialized;
};
Wallet wallets[MAX_WALLETS];

BLEServer *pServer = nullptr;
BLECharacteristic *pCommandCharacteristic = nullptr;
BLECharacteristic *pNotifyCharacteristic = nullptr;
bool deviceConnected = false;
bool oldDeviceConnected = false;

bool notificationsEnabled = false;
bool simulateNoWallets = false;
int currentWalletIndex = -1;

String savedMorseCode = "";
bool morseCodeSaved = false;

bool isAuthenticated = false;
unsigned long sessionStartTime = 0;
int failedAuthAttempts = 0;
unsigned long lockoutEndTime = 0;
String devicePassword = DEFAULT_PASSWORD;
bool isProcessingAuth = false;

// Morse code detection variables
String currentMorse = "";
String enteredPassword = "";
int currentLetterIndex = 0;
bool transactionPending = false;
bool passwordMode = false;
unsigned long lastTransactionRequest = 0;
int passwordAttempts = 0;
bool gestureVerificationMode = false;
String expectedGesture = "";

sensors_event_t a, g, temp;

// ========== FUNCTION DECLARATIONS ==========
void processCommand(const String &command);
void handleAuthentication(const String &password);
void handlePasswordChange(const String &oldPassword, const String &newPassword);
bool isSessionExpired();
void getDeviceStatus();
void createWallet();
void listWallets();
void deleteWallet(int walletIndex);
void signTransaction(int walletIndex, const String &txBase64);
void saveGesture(const String &gesture);
void getSavedGesture();
void emergencyWipe();
void verifyGesture(const String &gesture);
bool sendResponse(const String &status, const String &message, const DynamicJsonDocument &payload);
void saveToEEPROM(const String &data, int addr, int lengthAddr);
String loadFromEEPROM(int addr, int lengthAddr);

void saveWalletToEEPROM(int idx);
void loadWalletsFromEEPROM();
void clearWalletInEEPROM(int idx);
void clearWalletsRegion();

void hmac_sha512(const uint8_t *key, size_t keyLen, const uint8_t *data, size_t dataLen, uint8_t output[64]);
void pbkdf2_hmac_sha512(const uint8_t *password, size_t passwordLen, const uint8_t *salt, size_t saltLen, uint32_t iterations, uint8_t *output, size_t dkLen);
void deriveKeys(const String &mnemonic, uint8_t *privateKey, uint8_t *publicKey);
void seed_entropy();

uint8_t base64DecodeChar(char c);
size_t base64Decode(const String &input, uint8_t *output);
void base64Encode(const uint8_t *input, size_t len, String &output);

static inline size_t base64DecodedMaxLen(size_t b64Len) {
  return (b64Len / 4) * 3 + 3;
}

String toHex(const uint8_t *data, size_t len);
String suiAddressFromPublicKey(const uint8_t pubkey[32]);

// Morse code functions
long readPressure();
void vibrate(int onFor, int offFor, int times);
String gesture_pressed(long pressure);
String end_morse();
void completeMorseLetter();
void checkPassword();
void resetPasswordEntry();
char findMorseCharacter(String morse);
void displayStatus(String status);
void updateDisplay(long pressure);
void handlePasswordEntry(long pressure);
void handleGestureVerification(long pressure);

// ========== UTILITY FUNCTIONS ==========
const char base64Table[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

uint8_t base64DecodeChar(char c) {
  if (c >= 'A' && c <= 'Z') return c - 'A';
  if (c >= 'a' && c <= 'z') return c - 'a' + 26;
  if (c >= '0' && c <= '9') return c - '0' + 52;
  if (c == '+') return 62;
  if (c == '/') return 63;
  return 0;
}

size_t base64Decode(const String &input, uint8_t *output) {
  size_t len = input.length();
  size_t outIndex = 0;

  while (len > 0 && input.charAt(len - 1) == '=') len--;

  for (size_t i = 0; i < len; i += 4) {
    uint32_t triple = 0;
    for (int j = 0; j < 4 && (i + j) < len; j++) {
      char c = input.charAt(i + j);
      uint8_t val = base64DecodeChar(c);
      triple |= (uint32_t)val << (18 - j * 6);
    }
    output[outIndex++] = (triple >> 16) & 0xFF;
    if ((i + 2) < len && input.charAt(i + 2) != '=') output[outIndex++] = (triple >> 8) & 0xFF;
    if ((i + 3) < len && input.charAt(i + 3) != '=') output[outIndex++] = triple & 0xFF;
  }
  return outIndex;
}

void base64Encode(const uint8_t *input, size_t len, String &output) {
  output = "";
  for (size_t i = 0; i < len; i += 3) {
    uint32_t triple = 0;
    triple |= input[i] << 16;
    if (i + 1 < len) triple |= input[i + 1] << 8;
    if (i + 2 < len) triple |= input[i + 2];
    output += base64Table[(triple >> 18) & 0x3F];
    output += base64Table[(triple >> 12) & 0x3F];
    output += (i + 1 < len) ? base64Table[(triple >> 6) & 0x3F] : '=';
    output += (i + 2 < len) ? base64Table[triple & 0x3F] : '=';
  }
}

String toHex(const uint8_t *data, size_t len) {
  String out;
  out.reserve(len * 2);
  for (size_t i = 0; i < len; i++) {
    if (data[i] < 16) out += "0";
    out += String(data[i], HEX);
  }
  return out;
}

String suiAddressFromPublicKey(const uint8_t pubkey[32]) {
  uint8_t buf[33];
  buf[0] = 0x00; 
  memcpy(buf + 1, pubkey, 32);

  uint8_t hash32[32];
  BLAKE2b blake;
  blake.reset(32);
  blake.update(buf, sizeof(buf));
  blake.finalize(hash32, 32);
  return String("0x") + toHex(hash32, 32);
}

void saveToEEPROM(const String &data, int addr, int lengthAddr) {
  int length = data.length();
  EEPROM.write(lengthAddr, length);
  for (int i = 0; i < length; i++) EEPROM.write(addr + i, data.charAt(i));
  EEPROM.commit();
}

String loadFromEEPROM(int addr, int lengthAddr) {
  int length = EEPROM.read(lengthAddr);
  if (length <= 0 || length > 100) return "";
  String data = "";
  for (int i = 0; i < length; i++) data += (char)EEPROM.read(addr + i);
  return data;
}

void saveWalletToEEPROM(int idx) {
  if (idx < 0 || idx >= MAX_WALLETS) return;
  int base = EEPROM_WALLETS_BASE + idx * EEPROM_WALLET_SLOT_SIZE;

  EEPROM.write(base + EEPROM_WALLET_FLAG_OFFSET, wallets[idx].initialized ? 1 : 0);

  for (int i = 0; i < 32; i++) {
    EEPROM.write(base + EEPROM_WALLET_PRIV_OFFSET + i, wallets[idx].privateKey[i]);
  }
  for (int i = 0; i < 32; i++) {
    EEPROM.write(base + EEPROM_WALLET_PUB_OFFSET + i, wallets[idx].publicKey[i]);
  }
  EEPROM.commit();
}

void clearWalletInEEPROM(int idx) {
  if (idx < 0 || idx >= MAX_WALLETS) return;
  int base = EEPROM_WALLETS_BASE + idx * EEPROM_WALLET_SLOT_SIZE;
  EEPROM.write(base + EEPROM_WALLET_FLAG_OFFSET, 0);
  for (int i = 0; i < 32; i++) {
    EEPROM.write(base + EEPROM_WALLET_PRIV_OFFSET + i, 0);
    EEPROM.write(base + EEPROM_WALLET_PUB_OFFSET + i, 0);
  }
  EEPROM.commit();
}

void clearWalletsRegion() {
  for (int i = 0; i < MAX_WALLETS; i++) clearWalletInEEPROM(i);
}

void loadWalletsFromEEPROM() {
  for (int i = 0; i < MAX_WALLETS; i++) {
    int base = EEPROM_WALLETS_BASE + i * EEPROM_WALLET_SLOT_SIZE;
    uint8_t flag = EEPROM.read(base + EEPROM_WALLET_FLAG_OFFSET);

    if (flag == 1) {
      for (int j = 0; j < 32; j++) {
        wallets[i].privateKey[j] = EEPROM.read(base + EEPROM_WALLET_PRIV_OFFSET + j);
        wallets[i].publicKey[j] = EEPROM.read(base + EEPROM_WALLET_PUB_OFFSET + j);
      }
      wallets[i].initialized = true;
      wallets[i].mnemonic = ""; 
    } else {
      wallets[i].initialized = false;
      wallets[i].mnemonic = "";
      memset(wallets[i].privateKey, 0, 32);
      memset(wallets[i].publicKey, 0, 32);
    }
  }
}

// ========== BLE CALLBACK CLASSES ==========
class MyServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer *srv) override {
    deviceConnected = true;
    isAuthenticated = false;
    sessionStartTime = 0;
    isProcessingAuth = false;

    sendResponse("auth", "Need PIN", DynamicJsonDocument(0));
  }
  void onDisconnect(BLEServer *srv) override {
    deviceConnected = false;
    isAuthenticated = false;
    sessionStartTime = 0;
    isProcessingAuth = false;
  }
};

class CommandCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *ch) override {
    String value = ch->getValue();
    if (value.length() == 0) return;

    if (value.charAt(0) == '{') {
      processCommand(value);
      return;
    }

    const size_t maxDecoded = base64DecodedMaxLen(value.length());
    uint8_t *buf = (uint8_t *)malloc(maxDecoded);
    if (!buf) {
      sendResponse("err", "OOM", DynamicJsonDocument(0));
      return;
    }

    size_t n = base64Decode(value, buf);
    if (n == 0) {
      free(buf);
      sendResponse("err", "X", DynamicJsonDocument(0));
      return;
    }

    String decoded = String((char *)buf, n);
    free(buf);

    if (decoded.length() == 0) {
      sendResponse("err", "X", DynamicJsonDocument(0));
      return;
    }
    processCommand(decoded);
  }
};

// ========== RESPONSE HANDLING ==========
bool sendResponse(const String &status, const String &message, const DynamicJsonDocument &payload) {
  DynamicJsonDocument response(256);
  response["s"] = status;
  response["m"] = message;
  if (!payload.isNull() && payload.size() > 0) response["p"] = payload;

  String jsonString;
  serializeJson(response, jsonString);

  if (!deviceConnected || !pNotifyCharacteristic) return false;

  const int DATA_CHUNK_SIZE = 14;
  if ((int)jsonString.length() <= DATA_CHUNK_SIZE) {
    pNotifyCharacteristic->setValue(jsonString.c_str());
    pNotifyCharacteristic->notify();
    return true;
  }

  int totalParts = (jsonString.length() + DATA_CHUNK_SIZE - 1) / DATA_CHUNK_SIZE;
  for (int partIndex = 0; partIndex < totalParts; partIndex++) {
    int start = partIndex * DATA_CHUNK_SIZE;
    int end = min(start + DATA_CHUNK_SIZE, (int)jsonString.length());
    String payloadPart = jsonString.substring(start, end);
    String framed = "#" + String(partIndex + 1) + "/" + String(totalParts) + "|" + payloadPart;
    pNotifyCharacteristic->setValue(framed.c_str());
    pNotifyCharacteristic->notify();
    delay(8);
  }
  return true;
}

// ========== COMMAND PROCESSING ==========
void processCommand(const String &command) {
  DynamicJsonDocument doc(2048);
  DeserializationError err = deserializeJson(doc, command);
  if (err) {
    sendResponse("err", "X", DynamicJsonDocument(0));
    return;
  }

  String action = doc["command"] | "";
  JsonVariant payload = doc["payload"];

  if (millis() < lockoutEndTime) {
    sendResponse("lock", "X", DynamicJsonDocument(0));
    return;
  }

  if (action == "authenticate") {
    if (isProcessingAuth) return;
    isProcessingAuth = true;
    String password = payload["password"] | "";
    if (password.length() == 0) {
      sendResponse("err", "X", DynamicJsonDocument(0));
      isProcessingAuth = false;
      return;
    }
    handleAuthentication(password);
    isProcessingAuth = false;
    return;
  }

  if (action == "change_password") {
    if (!isAuthenticated || isSessionExpired()) {
      sendResponse("err", "Need auth", DynamicJsonDocument(0));
      return;
    }
    String oldP = payload["old"] | "";
    String newP = payload["new"] | "";
    handlePasswordChange(oldP, newP);
    return;
  }

  if (!isAuthenticated) {
    sendResponse("auth_required", "Need auth", DynamicJsonDocument(0));
    return;
  }
  if (isSessionExpired()) {
    isAuthenticated = false;
    sessionStartTime = 0;
    sendResponse("err", "Expired", DynamicJsonDocument(0));
    return;
  }

  if (action == "create_wallet") {
    createWallet();
    return;
  } else if (action == "list_wallets") {
    listWallets();
    return;
  } else if (action == "select_wallet") {
    currentWalletIndex = (int)payload["wallet_index"];
    if (currentWalletIndex >= 0 && currentWalletIndex < MAX_WALLETS && wallets[currentWalletIndex].initialized) {
      DynamicJsonDocument p(256);
      p["wallet_index"] = currentWalletIndex;
      p["public_key"] = toHex(wallets[currentWalletIndex].publicKey, 32);
      p["address"] = suiAddressFromPublicKey(wallets[currentWalletIndex].publicKey);
      sendResponse("wallet_selected", "K", p);
    } else {
      sendResponse("err", "X", DynamicJsonDocument(0));
    }
    return;
  } else if (action == "delete_wallet") {
    deleteWallet((int)payload["wallet_index"]);
    return;
  } else if (action == "sign_transaction") {
    int idx = (int)payload["wallet_index"];
    String txBase64 = payload["transaction_data"] | "";
    signTransaction(idx, txBase64);
    return;
  } else if (action == "get_device_status") {
    getDeviceStatus();
    return;
  } else if (action == "save_gesture") {
    String gesture = payload["gesture"] | "";
    saveGesture(gesture);
    return;
  } else if (action == "get_saved_gesture") {
    getSavedGesture();
    return;
  } else if (action == "verify_gesture") {
    String gesture = payload["gesture"] | "";
    verifyGesture(gesture);
    return;
  } else if (action == "emergency_wipe") {
    emergencyWipe();
    return;
  }

  sendResponse("err", "X", DynamicJsonDocument(0));
}

// ========== AUTHENTICATION FUNCTIONS ==========
void handleAuthentication(const String &password) {
  String pw = password;
  pw.trim();
  if (pw == devicePassword) {
    isAuthenticated = true;
    sessionStartTime = millis();
    failedAuthAttempts = 0;
    sendResponse("ok", "K", DynamicJsonDocument(0));
  } else {
    failedAuthAttempts++;
    if (failedAuthAttempts >= MAX_AUTH_ATTEMPTS) {
      lockoutEndTime = millis() + LOCKOUT_TIME;
      isAuthenticated = false;
      sessionStartTime = 0;
      sendResponse("lock", "X", DynamicJsonDocument(0));
    } else {
      sendResponse("err", "X", DynamicJsonDocument(0));
    }
  }
}

void handlePasswordChange(const String &oldPassword, const String &newPassword) {
  if (oldPassword != devicePassword) {
    sendResponse("err", "X", DynamicJsonDocument(0));
    return;
  }
  if (newPassword.length() < 4) {
    sendResponse("err", "X", DynamicJsonDocument(0));
    return;
  }
  devicePassword = newPassword;
  saveToEEPROM(newPassword, EEPROM_PASSWORD_ADDR, EEPROM_PASSWORD_LENGTH_ADDR);
  sendResponse("ok", "K", DynamicJsonDocument(0));
  isAuthenticated = false;
  sessionStartTime = 0;
}

bool isSessionExpired() {
  if (!isAuthenticated || sessionStartTime == 0) return true;
  return (millis() - sessionStartTime) > SESSION_TIMEOUT;
}

void getDeviceStatus() {
  DynamicJsonDocument p(1024);
  p["authenticated"] = isAuthenticated;
  bool activeSession = isAuthenticated && !isSessionExpired();
  p["session_active"] = activeSession;
  p["connection_stable"] = deviceConnected;
  p["failed_attempts"] = failedAuthAttempts;
  p["locked"] = millis() < lockoutEndTime;

  if (activeSession) {
    unsigned long remaining = SESSION_TIMEOUT - (millis() - sessionStartTime);
    p["session_remaining_minutes"] = remaining / 60000UL;
  } else {
    p["session_remaining_minutes"] = 0;
  }
  if (millis() < lockoutEndTime) p["lockout_remaining_seconds"] = (lockoutEndTime - millis()) / 1000UL;

  int count = 0;
  for (int i = 0; i < MAX_WALLETS; i++)
    if (wallets[i].initialized) count++;
  p["wallet_count"] = count;
  p["max_wallets"] = MAX_WALLETS;

  sendResponse("device_status", "Device status retrieved", p);
}

// ========== WALLET MANAGEMENT FUNCTIONS ==========
void createWallet() {
  int slot = -1;
  for (int i = 0; i < MAX_WALLETS; i++)
    if (!wallets[i].initialized) {
      slot = i;
      break;
    }
  if (slot == -1) {
    sendResponse("err", "Max wallets", DynamicJsonDocument(0));
    return;
  }

  auto words = BIP39::generate_mnemonic();
  String mnemonic = "";
  bool first = true;
  for (const auto &w : words) {
    if (!first) mnemonic += " ";
    mnemonic += w.c_str();
    first = false;
  }
  mnemonic.trim();

  deriveKeys(mnemonic, wallets[slot].privateKey, wallets[slot].publicKey);
  wallets[slot].mnemonic = mnemonic; 
  wallets[slot].initialized = true;

  saveWalletToEEPROM(slot);

  DynamicJsonDocument p(1024);
  p["wallet_index"] = slot;
  p["public_key"] = toHex(wallets[slot].publicKey, 32);
  p["address"] = suiAddressFromPublicKey(wallets[slot].publicKey);
  sendResponse("wallet_created", "K", p);
}

void listWallets() {
  DynamicJsonDocument p(2048);
  JsonArray arr = p.createNestedArray("wallets");
  if (!simulateNoWallets) {
    for (int i = 0; i < MAX_WALLETS; i++) {
      if (!wallets[i].initialized) continue;
      JsonObject w = arr.createNestedObject();
      w["index"] = i;
      w["public_key"] = toHex(wallets[i].publicKey, 32);
      w["address"] = suiAddressFromPublicKey(wallets[i].publicKey);
    }
  }
  sendResponse("wallet_list", "K", p);
}

void deleteWallet(int walletIndex) {
  if (walletIndex < 0 || walletIndex >= MAX_WALLETS) {
    sendResponse("err", "X", DynamicJsonDocument(0));
    return;
  }
  if (!wallets[walletIndex].initialized) {
    sendResponse("err", "X", DynamicJsonDocument(0));
    return;
  }

  wallets[walletIndex].mnemonic = "";
  memset(wallets[walletIndex].privateKey, 0, sizeof(wallets[walletIndex].privateKey));
  memset(wallets[walletIndex].publicKey, 0, sizeof(wallets[walletIndex].publicKey));
  wallets[walletIndex].initialized = false;

  clearWalletInEEPROM(walletIndex);

  DynamicJsonDocument p(128);
  p["deleted_wallet_index"] = walletIndex;
  sendResponse("ok", "K", p);
}

void signTransaction(int walletIndex, const String &txBase64) {
  if (walletIndex < 0 || walletIndex >= MAX_WALLETS) {
    sendResponse("err", "X", DynamicJsonDocument(0));
    return;
  }
  if (!wallets[walletIndex].initialized) {
    sendResponse("err", "X", DynamicJsonDocument(0));
    return;
  }
  if (txBase64.length() < 8) {
    sendResponse("err", "X", DynamicJsonDocument(0));
    return;
  }

  const size_t maxDecoded = base64DecodedMaxLen(txBase64.length());
  uint8_t *txBytes = (uint8_t *)malloc(maxDecoded);
  if (!txBytes) {
    sendResponse("err", "OOM", DynamicJsonDocument(0));
    return;
  }
  size_t txLen = base64Decode(txBase64, txBytes);
  if (txLen == 0 || txLen > maxDecoded) {
    free(txBytes);
    sendResponse("err", "B64", DynamicJsonDocument(0));
    return;
  }

  String txHex = toHex(txBytes, txLen);
  Serial.println("[sign] Tx (hex):");
  Serial.println(txHex);

  const uint8_t *msg = txBytes;
  size_t msgLen = txLen;
  if (txLen >= 3 && txBytes[0] == 0x00 && txBytes[1] == 0x00 && txBytes[2] == 0x00) {
    msg = txBytes + 3;
    msgLen = txLen - 3;
  }

  uint8_t suiSignature[97];
  int rc = microsui_sign_ed25519(suiSignature, msg, msgLen, wallets[walletIndex].privateKey);
  free(txBytes);
  if (rc != 0) {
    sendResponse("err", "SIGN", DynamicJsonDocument(0));
    return;
  }

  if (memcmp(suiSignature + 65, wallets[walletIndex].publicKey, 32) != 0) {
    sendResponse("err", "KEY_MISMATCH", DynamicJsonDocument(0));
    return;
  }

  String sigB64;
  base64Encode(suiSignature, sizeof(suiSignature), sigB64);

  char sigHex[195];  
  bytes_to_hex(suiSignature, 97, sigHex);
  Serial.println("✅ Signed.");
  Serial.printf("Sui Signature (97 bytes hex): %s\n", sigHex);
  Serial.print("Sui Signature (Base64): ");
  Serial.println(sigB64);

  const size_t jsonCap = 256 + sigB64.length();
  DynamicJsonDocument p(jsonCap);
  p["wallet_index"] = walletIndex;
  p["signature_base64"] = sigB64;

  sendResponse("ok", "K", p);
}

// ========== GESTURE MANAGEMENT FUNCTIONS ==========
void saveGesture(const String &gesture) {
  if (gesture.length() == 0) {
    sendResponse("err", "Empty gesture", DynamicJsonDocument(0));
    return;
  }
  savedMorseCode = gesture;
  morseCodeSaved = true;
  saveToEEPROM(gesture, EEPROM_MORSE_CODE_ADDR, EEPROM_MORSE_CODE_LENGTH_ADDR);
  DynamicJsonDocument p(128);
  p["gesture"] = gesture;
  p["success"] = true;
  sendResponse("gesture_saved", "Gesture saved", p);
}

void getSavedGesture() {
  if (!morseCodeSaved || savedMorseCode.length() == 0) {
    String g = loadFromEEPROM(EEPROM_MORSE_CODE_ADDR, EEPROM_MORSE_CODE_LENGTH_ADDR);
    if (g.length() > 0) {
      savedMorseCode = g;
      morseCodeSaved = true;
    } else {
      sendResponse("err", "No gesture saved", DynamicJsonDocument(0));
      return;
    }
  }
  DynamicJsonDocument p(128);
  p["gesture"] = savedMorseCode;
  sendResponse("saved_gesture", "K", p);
}

void verifyGesture(const String &gesture) {
  if (gesture.length() == 0) {
    sendResponse("err", "Empty gesture", DynamicJsonDocument(0));
    return;
  }
  
  // Start gesture verification mode
  gestureVerificationMode = true;
  expectedGesture = gesture;
  currentMorse = "";
  enteredPassword = "";
  currentLetterIndex = 0;
  passwordAttempts = 0;
  
  displayStatus("Verify Gesture");
  vibrate(200, 100, 2);
  
  DynamicJsonDocument p(128);
  p["status"] = "waiting_for_gesture";
  p["message"] = "Please enter your gesture on the device";
  sendResponse("gesture_verification_started", "Waiting for gesture", p);
}

void emergencyWipe() {
  savedMorseCode = "";
  morseCodeSaved = false;
  devicePassword = DEFAULT_PASSWORD;
  isAuthenticated = false;
  sessionStartTime = 0;
  failedAuthAttempts = 0;
  lockoutEndTime = 0;
  currentWalletIndex = -1;

  for (int i = 0; i < MAX_WALLETS; i++) {
    wallets[i].mnemonic = "";
    memset(wallets[i].privateKey, 0, sizeof(wallets[i].privateKey));
    memset(wallets[i].publicKey, 0, sizeof(wallets[i].publicKey));
    wallets[i].initialized = false;
  }

  for (int i = 0; i < EEPROM_SIZE; i++) EEPROM.write(i, 0);
  EEPROM.commit();

  DynamicJsonDocument p(128);
  p["wiped"] = true;
  sendResponse("emergency_wipe_complete", "K", p);
}

// ========== HARDWARE INTERACTION FUNCTIONS ==========
long readPressure() {
  long pressure = 0;
  if (scale.is_ready()) {
    pressure = scale.read();
    pressure = map(pressure, 2500000, 4200000, 100, 0);  // You can recalibrate
    if (pressure < 0) pressure = 0;
    if (pressure > 100) pressure = 100;
  }
  return pressure;
}

void vibrate(int onFor, int offFor, int times) {
  for (int i = 0; i < times; i++) {
    digitalWrite(vibrator, HIGH);
    delay(onFor);
    digitalWrite(vibrator, LOW);
    if (i < times - 1) delay(offFor);
  }
}

void displayStatus(String status) {
  oled.clearDisplay();
  oled.setCursor(0, 0);
  oled.println("Sui Shoe Wallet");
  oled.println("---------------");
  oled.println("Status: " + status);

  if (passwordMode || gestureVerificationMode) {
    oled.println("Mode: " + String(gestureVerificationMode ? "Verify" : "Password"));
    oled.println("Morse: " + currentMorse);
    if (gestureVerificationMode) {
      oled.println("Expected: " + expectedGesture);
    }
  }

  oled.display();
}

void updateDisplay(long pressure) {
  static unsigned long lastUpdate = 0;
  if (millis() - lastUpdate < 500) return;
  lastUpdate = millis();

  if (!passwordMode && !gestureVerificationMode) {
    oled.clearDisplay();
    oled.setCursor(0, 0);
    oled.println("Sui Shoe Wallet");
    oled.println("---------------");

    oled.print("A:");
    oled.print(a.acceleration.x, 1);
    oled.print(",");
    oled.print(a.acceleration.y, 1);
    oled.print(",");
    oled.println(a.acceleration.z, 1);

    oled.print("G:");
    oled.print(g.gyro.x, 1);
    oled.print(",");
    oled.print(g.gyro.y, 1);
    oled.print(",");
    oled.println(g.gyro.z, 1);

    oled.print("Pressure: ");
    oled.println(pressure);
    oled.println("Ready...");
    oled.display();
  }
}

// ========== MORSE CODE DETECTION FUNCTIONS ==========
String gesture_pressed(long pressure) {
  static bool pressStarted = false;
  static unsigned long startTime = 0;

  // Start press when pressure drops to 1 or less
  if (pressure <= 1 && !pressStarted) {
    pressStarted = true;
    startTime = millis();
    return "";
  }

  // Release when pressure rises again
  if (pressure > 1 && pressStarted) {
    pressStarted = false;
    unsigned long duration = millis() - startTime;

    if (duration >= 1500) {
      Serial.println("Detected: DASH");
      vibrate(300, 0, 1);  // Long
      return "dash";
    } else if (duration >= 100) {
      Serial.println("Detected: DOT");
      vibrate(100, 0, 1);  // Short
      return "dot";
    }
  }

  return "";
}

String end_morse() {
  return (a.acceleration.x >= 3) ? "yes" : "no";
}

char findMorseCharacter(String morse) {
  for (int i = 0; i < 36; i++) {
    if (morseCode[i] == morse) {
      return characters[i];
    }
  }
  return '?';
}

void completeMorseLetter() {
  char foundChar = findMorseCharacter(currentMorse);
  if (foundChar != '?') {
    enteredPassword += foundChar;
    Serial.println("Letter: " + String(foundChar));
    vibrate(150, 50, 2);
    currentLetterIndex++;
    
    if (gestureVerificationMode) {
      // For gesture verification, check if we have enough characters
      if (currentLetterIndex >= expectedGesture.length()) {
        checkGestureVerification();
      } else {
        currentMorse = "";
        displayStatus("Next Letter");
      }
    } else {
      // For password mode, check against target length
      if (currentLetterIndex >= 2) {  // Assuming 2-letter passwords
        checkPassword();
      } else {
        currentMorse = "";
        displayStatus("Next Letter");
      }
    }
  } else {
    Serial.println("Invalid Morse. Restarting...");
    resetPasswordEntry();
    vibrate(1000, 100, 3);
  }
  currentMorse = "";
}

void checkPassword() {
  // This function is for the old password mode - can be removed if not needed
  Serial.println("=== PASSWORD CHECK (Legacy) ===");
  displayStatus("Password Mode");
  vibrate(200, 100, 2);
  
  enteredPassword = "";
  currentLetterIndex = 0;
  currentMorse = "";
  delay(2000);
}

void checkGestureVerification() {
  if (enteredPassword == expectedGesture) {
    Serial.println("=== GESTURE VERIFIED ===");
    displayStatus("VERIFIED!");
    vibrate(200, 100, 5);
    
    // Send success response
    DynamicJsonDocument p(128);
    p["verified"] = true;
    p["gesture"] = enteredPassword;
    sendResponse("gesture_verified", "Gesture verified successfully", p);
    
    // Reset verification mode
    gestureVerificationMode = false;
    expectedGesture = "";
  } else {
    passwordAttempts++;
    Serial.println("=== WRONG GESTURE ===");
    Serial.println("Entered: " + enteredPassword);
    Serial.println("Expected: " + expectedGesture);
    
    if (passwordAttempts >= 2) {
      Serial.println("ACCESS DENIED.");
      displayStatus("ACCESS DENIED");
      vibrate(1500, 300, 3);
      
      // Send failure response
      DynamicJsonDocument p(128);
      p["verified"] = false;
      p["attempts"] = passwordAttempts;
      sendResponse("gesture_mismatch", "Gesture verification failed", p);
      
      // Reset verification mode
      gestureVerificationMode = false;
      expectedGesture = "";
    } else {
      displayStatus("Wrong! Try Again");
      vibrate(1000, 200, 2);
    }
  }

  enteredPassword = "";
  currentLetterIndex = 0;
  currentMorse = "";
  delay(2000);
}

void resetPasswordEntry() {
  enteredPassword = "";
  currentLetterIndex = 0;
  currentMorse = "";
  displayStatus("Restart Entry");
}

void handlePasswordEntry(long pressure) {
  String gesture = gesture_pressed(pressure);
  if (gesture != "") {
    currentMorse += (gesture == "dot") ? "." : "-";
    displayStatus((gesture == "dot") ? "Dot" : "Dash");
    Serial.println("Current Morse: " + currentMorse);
  }

  if (end_morse() == "yes") {
    completeMorseLetter();
  }
}

void handleGestureVerification(long pressure) {
  String gesture = gesture_pressed(pressure);
  if (gesture != "") {
    currentMorse += (gesture == "dot") ? "." : "-";
    displayStatus((gesture == "dot") ? "Dot" : "Dash");
    Serial.println("Current Morse: " + currentMorse);
  }

  if (end_morse() == "yes") {
    completeMorseLetter();
  }
}

// ========== CRYPTOGRAPHIC FUNCTIONS ==========
void hmac_sha512(const uint8_t *key, size_t keyLen, const uint8_t *data, size_t dataLen, uint8_t output[64]) {
  SHA512 hash;
  uint8_t keyBlock[128];
  memset(keyBlock, 0, sizeof(keyBlock));
  if (keyLen > 128) {
    hash.reset();
    hash.update(key, keyLen);
    hash.finalize(keyBlock, SHA512::HASH_SIZE);
  } else {
    memcpy(keyBlock, key, keyLen);
  }

  uint8_t o_key_pad[128];
  uint8_t i_key_pad[128];
  for (size_t i = 0; i < 128; ++i) {
    o_key_pad[i] = keyBlock[i] ^ 0x5c;
    i_key_pad[i] = keyBlock[i] ^ 0x36;
  }

  uint8_t innerHash[64];
  hash.reset();
  hash.update(i_key_pad, 128);
  hash.update(data, dataLen);
  hash.finalize(innerHash, SHA512::HASH_SIZE);

  hash.reset();
  hash.update(o_key_pad, 128);
  hash.update(innerHash, 64);
  hash.finalize(output, SHA512::HASH_SIZE);
}

void pbkdf2_hmac_sha512(const uint8_t *password, size_t passwordLen,
                        const uint8_t *salt, size_t saltLen,
                        uint32_t iterations, uint8_t *output, size_t dkLen) {
  uint32_t blockCount = (dkLen + 63) / 64;
  uint8_t u[64], t[64], *saltBlock = (uint8_t *)malloc(saltLen + 4);
  memcpy(saltBlock, salt, saltLen);

  for (uint32_t block = 1; block <= blockCount; ++block) {
    saltBlock[saltLen + 0] = (block >> 24) & 0xFF;
    saltBlock[saltLen + 1] = (block >> 16) & 0xFF;
    saltBlock[saltLen + 2] = (block >> 8) & 0xFF;
    saltBlock[saltLen + 3] = (block)&0xFF;

    hmac_sha512(password, passwordLen, saltBlock, saltLen + 4, u);
    memcpy(t, u, 64);
    for (uint32_t i = 1; i < iterations; ++i) {
      hmac_sha512(password, passwordLen, u, 64, u);
      for (size_t j = 0; j < 64; ++j) t[j] ^= u[j];
    }
    size_t offset = (block - 1) * 64;
    size_t toCopy = (dkLen - offset > 64) ? 64 : (dkLen - offset);
    memcpy(output + offset, t, toCopy);
  }
  free(saltBlock);
}

void deriveKeys(const String &mnemonic, uint8_t *privateKey, uint8_t *publicKey) {
  const char *salt = "mnemonic";
  uint8_t seed[64];
  pbkdf2_hmac_sha512((const uint8_t *)mnemonic.c_str(), mnemonic.length(),
                     (const uint8_t *)salt, strlen(salt),
                     2048, seed, sizeof(seed));
  uint8_t hmacResult[64];
  const char *key = "ed25519 seed";
  hmac_sha512((const uint8_t *)key, strlen(key), seed, sizeof(seed), hmacResult);

  uint8_t chainCode[32];
  memcpy(privateKey, hmacResult, 32);
  memcpy(chainCode, hmacResult + 32, 32);

  uint32_t path[] = { 44, 784, 0, 0, 0 };
  for (size_t i = 0; i < sizeof(path) / sizeof(path[0]); i++) {
    uint8_t data[1 + 32 + 4];
    data[0] = 0x00;
    memcpy(data + 1, privateKey, 32);
    uint32_t index = path[i] | 0x80000000;
    data[33] = (index >> 24) & 0xFF;
    data[34] = (index >> 16) & 0xFF;
    data[35] = (index >> 8) & 0xFF;
    data[36] = index & 0xFF;

    hmac_sha512(chainCode, 32, data, sizeof(data), hmacResult);
    memcpy(privateKey, hmacResult, 32);
    memcpy(chainCode, hmacResult + 32, 32);
  }
  Ed25519::derivePublicKey(publicKey, privateKey);
}

void seed_entropy() {
#ifdef ESP32
  uint32_t seed = esp_random();
#else
  uint32_t seed = 0;
  for (int i = 0; i < 32; ++i) {
    seed ^= analogRead(i % 6);
    delay(10);
  }
#endif
  randomSeed(seed);
}

// ========== SETUP FUNCTION ==========
void setup() {
  Serial.begin(115200);
  delay(400);

  // Initialize hardware
  pinMode(vibrator, OUTPUT);
  
  // Initialize scale
  scale.begin(LOADCELL_DOUT_PIN, LOADCELL_SCK_PIN);
  
  // Initialize OLED
  if (!oled.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS)) {
    Serial.println("OLED failed");
    while (1);
  }
  oled.setRotation(2);
  oled.setTextSize(1);
  oled.setTextColor(WHITE);

  // Initialize MPU6050
  if (!mpu.begin()) {
    Serial.println("MPU6050 not found");
    while (1);
  }
  mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
  mpu.setGyroRange(MPU6050_RANGE_500_DEG);
  mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
  delay(100);

  // Initialize wallets
  for (int i = 0; i < MAX_WALLETS; i++) wallets[i].initialized = false;
  seed_entropy();

  // Initialize EEPROM
  EEPROM.begin(EEPROM_SIZE);
  String savedPassword = loadFromEEPROM(EEPROM_PASSWORD_ADDR, EEPROM_PASSWORD_LENGTH_ADDR);
  if (savedPassword.length() > 0) devicePassword = savedPassword;
  String savedGesture = loadFromEEPROM(EEPROM_MORSE_CODE_ADDR, EEPROM_MORSE_CODE_LENGTH_ADDR);
  if (savedGesture.length() > 0) {
    savedMorseCode = savedGesture;
    morseCodeSaved = true;
  }

  loadWalletsFromEEPROM();

  // Initialize BLE
  BLEDevice::init("Sui-Wallet-BLE");
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());
  BLEService *pService = pServer->createService(SERVICE_UUID);

  pCommandCharacteristic = pService->createCharacteristic(
    COMMAND_CHARACTERISTIC_UUID, BLECharacteristic::PROPERTY_WRITE);
  pCommandCharacteristic->setCallbacks(new CommandCallbacks());

  pNotifyCharacteristic = pService->createCharacteristic(
    NOTIFY_CHARACTERISTIC_UUID,
    BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY | BLECharacteristic::PROPERTY_INDICATE);
  pNotifyCharacteristic->addDescriptor(new BLE2902());

  pService->start();
  BLEAdvertising *adv = BLEDevice::getAdvertising();
  adv->addServiceUUID(SERVICE_UUID);
  adv->setScanResponse(true);
  adv->setMinPreferred(0x0);
  BLEDevice::startAdvertising();

  // Initial vibration and display
  vibrate(500, 100, 2);
  Serial.println("Smart In-Shoe Wallet Ready!");
  displayStatus("Ready");
}

// ========== MAIN LOOP ==========
void loop() {
  // Read sensor data
  mpu.getEvent(&a, &g, &temp);
  long pressure = readPressure();

  // Handle BLE connection management
  if (!deviceConnected && oldDeviceConnected) {
    delay(500);
    pServer->startAdvertising();
    oldDeviceConnected = deviceConnected;
  }
  if (deviceConnected && !oldDeviceConnected) {
    oldDeviceConnected = deviceConnected;
  }

  // Handle session expiration
  if (isAuthenticated && isSessionExpired()) {
    isAuthenticated = false;
    sessionStartTime = 0;
    if (deviceConnected) {
      DynamicJsonDocument p(128);
      p["authenticated"] = false;
      p["session_expired"] = true;
      sendResponse("info", "Session expired. Please authenticate again.", p);
    }
  }

  // Handle lockout timeout
  if (millis() >= lockoutEndTime && lockoutEndTime > 0) {
    failedAuthAttempts = 0;
    lockoutEndTime = 0;
  }

  // Handle gesture verification mode
  if (gestureVerificationMode) {
    handleGestureVerification(pressure);
  }
  // Handle password mode (legacy)
  else if (passwordMode) {
    handlePasswordEntry(pressure);
  }

  // Update display
  updateDisplay(pressure);
  
  delay(100);
}

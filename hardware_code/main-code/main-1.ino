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

#ifdef ESP32
#include <esp_system.h>
#endif

#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <Wire.h>
#include "HX711.h"

#ifndef USE_OLED
#define USE_OLED 1
#endif

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define SCREEN_ADDRESS 0x3C
Adafruit_SSD1306 oled(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

const int LOADCELL_DOUT_PIN = 10;
const int LOADCELL_SCK_PIN  = 9;
const int vibrator          = 8;
Adafruit_MPU6050 mpu;
HX711 scale;

#define SERVICE_UUID "4a1d5203-b0e6-4d2a-89a1-0f4900a0680a"
#define COMMAND_CHARACTERISTIC_UUID "60641dfd-e137-41a4-9e79-84728562725e"  // WRITE
#define NOTIFY_CHARACTERISTIC_UUID  "523675f6-c67d-411a-821e-c674ed4a123f"  // READ/NOTIFY/INDICATE

#define DEFAULT_PASSWORD "2024"
#define SESSION_TIMEOUT 1600000UL
#define MAX_AUTH_ATTEMPTS 3
#define LOCKOUT_TIME 160000UL

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

uint8_t base64DecodeChar(char c);
size_t base64Decode(const String &input, uint8_t *output);
void base64Encode(const uint8_t *input, size_t len, String &output);
static inline size_t base64DecodedMaxLen(size_t b64Len) { return (b64Len / 4) * 3 + 3; }
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
      triple |= (uint32_t)base64DecodeChar(input.charAt(i + j)) << (18 - j * 6);
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
    uint32_t triple = (uint32_t)input[i] << 16;
    if (i + 1 < len) triple |= (uint32_t)input[i + 1] << 8;
    if (i + 2 < len) triple |= input[i + 2];
    output += base64Table[(triple >> 18) & 0x3F];
    output += base64Table[(triple >> 12) & 0x3F];
    output += (i + 1 < len) ? base64Table[(triple >> 6) & 0x3F] : '=';
    output += (i + 2 < len) ? base64Table[triple & 0x3F] : '=';
  }
}

String toHex(const uint8_t *data, size_t len) {
  String out; out.reserve(len * 2);
  for (size_t i = 0; i < len; i++) { if (data[i] < 16) out += "0"; out += String(data[i], HEX); }
  return out;
}
String suiAddressFromPublicKey(const uint8_t pubkey[32]) {
  uint8_t buf[33]; buf[0] = 0x00; memcpy(buf + 1, pubkey, 32);
  uint8_t hash32[32]; BLAKE2b blake; blake.reset(32); blake.update(buf, sizeof(buf)); blake.finalize(hash32, 32);
  return String("0x") + toHex(hash32, 32);
}

void saveToEEPROM(const String &data, int addr, int lengthAddr) {
  int length = data.length(); EEPROM.write(lengthAddr, length);
  for (int i = 0; i < length; i++) EEPROM.write(addr + i, data[i]);
  EEPROM.commit();
}
String loadFromEEPROM(int addr, int lengthAddr) {
  int length = EEPROM.read(lengthAddr);
  if (length < 0 || length > 100) return "";
  String data = ""; for (int i = 0; i < length; i++) data += (char)EEPROM.read(addr + i);
  return data;
}

void saveWalletToEEPROM(int idx) {
  if (idx < 0 || idx >= MAX_WALLETS) return;
  int base = EEPROM_WALLETS_BASE + idx * EEPROM_WALLET_SLOT_SIZE;
  EEPROM.write(base + EEPROM_WALLET_FLAG_OFFSET, wallets[idx].initialized ? 1 : 0);
  for (int i = 0; i < 32; i++) EEPROM.write(base + EEPROM_WALLET_PRIV_OFFSET + i, wallets[idx].privateKey[i]);
  for (int i = 0; i < 32; i++) EEPROM.write(base + EEPROM_WALLET_PUB_OFFSET + i, wallets[idx].publicKey[i]);
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
void clearWalletsRegion() { for (int i = 0; i < MAX_WALLETS; i++) clearWalletInEEPROM(i); }
void loadWalletsFromEEPROM() {
  for (int i = 0; i < MAX_WALLETS; i++) {
    int base = EEPROM_WALLETS_BASE + i * EEPROM_WALLET_SLOT_SIZE;
    uint8_t flag = EEPROM.read(base + EEPROM_WALLET_FLAG_OFFSET);
    if (flag == 1) {
      for (int j = 0; j < 32; j++) {
        wallets[i].privateKey[j] = EEPROM.read(base + EEPROM_WALLET_PRIV_OFFSET + j);
        wallets[i].publicKey[j]  = EEPROM.read(base + EEPROM_WALLET_PUB_OFFSET + j);
      }
      wallets[i].initialized = true; wallets[i].mnemonic = "";
    } else {
      wallets[i].initialized = false; wallets[i].mnemonic = "";
      memset(wallets[i].privateKey, 0, 32); memset(wallets[i].publicKey, 0, 32);
    }
  }
}

bool sendResponse(const String &status, const String &message, const DynamicJsonDocument &payload) {
  DynamicJsonDocument response(256);
  response["s"] = status; response["m"] = message;
  if (!payload.isNull() && payload.size() > 0) response["p"] = payload;
  String jsonString; serializeJson(response, jsonString);
  if (!deviceConnected || !pNotifyCharacteristic) return false;
  const int DATA_CHUNK_SIZE = 14;
  if ((int)jsonString.length() <= DATA_CHUNK_SIZE) {
    pNotifyCharacteristic->setValue(jsonString.c_str()); pNotifyCharacteristic->notify(); return true;
  }
  int totalParts = (jsonString.length() + DATA_CHUNK_SIZE - 1) / DATA_CHUNK_SIZE;
  for (int partIndex = 0; partIndex < totalParts; partIndex++) {
    int start = partIndex * DATA_CHUNK_SIZE, end = min(start + DATA_CHUNK_SIZE, (int)jsonString.length());
    String framed = "#" + String(partIndex + 1) + "/" + String(totalParts) + "|" + jsonString.substring(start, end);
    pNotifyCharacteristic->setValue(framed.c_str()); pNotifyCharacteristic->notify(); delay(8);
  }
  return true;
}

void processCommand(const String &command);
void handleAuthentication(const String &password);
void handlePasswordChange(const String &oldPassword, const String &newPassword);
bool isSessionExpired();
void getDeviceStatus();
void createWallet();
void listWallets();
void deleteWallet(int walletIndex);
void signTransaction_enqueue(int walletIndex, const String &txBase64); // enqueue
void emergencyWipe();
void seed_entropy();
void deriveKeys(const String &mnemonic, uint8_t *privateKey, uint8_t *publicKey);

bool isAlnumAZ09(char c);
void setMorseLetters(String letters);
void getMorseLetters();
void clearMorseLetters();

void hmac_sha512(const uint8_t *key, size_t keyLen, const uint8_t *data, size_t dataLen, uint8_t output[64]);
void pbkdf2_hmac_sha512(const uint8_t *password, size_t passwordLen, const uint8_t *salt, size_t saltLen, uint32_t iterations, uint8_t *output, size_t dkLen);
void deriveKeys(const String &mnemonic, uint8_t *privateKey, uint8_t *publicKey) {
  const char *salt = "mnemonic";
  uint8_t seed[64];
  pbkdf2_hmac_sha512((const uint8_t *)mnemonic.c_str(), mnemonic.length(), (const uint8_t *)salt, strlen(salt), 2048, seed, sizeof(seed));
  uint8_t hmacResult[64]; const char *key = "ed25519 seed";
  hmac_sha512((const uint8_t *)key, strlen(key), seed, sizeof(seed), hmacResult);
  uint8_t chainCode[32]; memcpy(wallets[0].privateKey, hmacResult, 32); memcpy(chainCode, hmacResult + 32, 32);
  memcpy(wallets[0].privateKey, hmacResult, 32);
  uint32_t path[] = {44, 784, 0, 0, 0}; uint8_t priv[32]; memcpy(priv, hmacResult, 32);
  for (size_t i = 0; i < 5; i++) {
    uint8_t data[1 + 32 + 4]; data[0] = 0x00; memcpy(data + 1, priv, 32);
    uint32_t index = (path[i] | 0x80000000);
    data[33] = (index >> 24) & 0xFF; data[34] = (index >> 16) & 0xFF; data[35] = (index >> 8) & 0xFF; data[36] = index & 0xFF;
    hmac_sha512(chainCode, 32, data, sizeof(data), hmacResult);
    memcpy(priv, hmacResult, 32); memcpy(chainCode, hmacResult + 32, 32);
  }
  memcpy(privateKey, hmacResult, 32); Ed25519::derivePublicKey(publicKey, privateKey);
}
void hmac_sha512(const uint8_t *key, size_t keyLen, const uint8_t *data, size_t dataLen, uint8_t output[64]) {
  SHA512 hash; uint8_t keyBlock[128]; memset(keyBlock, 0, sizeof(keyBlock));
  if (keyLen > 128) { hash.reset(); hash.update(key, keyLen); hash.finalize(keyBlock, SHA512::HASH_SIZE); }
  else { memcpy(keyBlock, key, keyLen); }
  uint8_t o_key_pad[128], i_key_pad[128];
  for (size_t i = 0; i < 128; ++i) { o_key_pad[i] = keyBlock[i] ^ 0x5c; i_key_pad[i] = keyBlock[i] ^ 0x36; }
  uint8_t innerHash[64]; hash.reset(); hash.update(i_key_pad, 128); hash.update(data, dataLen); hash.finalize(innerHash, SHA512::HASH_SIZE);
  hash.reset(); hash.update(o_key_pad, 128); hash.update(innerHash, 64); hash.finalize(output, SHA512::HASH_SIZE);
}
void pbkdf2_hmac_sha512(const uint8_t *password, size_t passwordLen, const uint8_t *salt, size_t saltLen, uint32_t iterations, uint8_t *output, size_t dkLen) {
  uint32_t blockCount = (dkLen + 63) / 64; uint8_t u[64], t[64], *saltBlock = (uint8_t *)malloc(saltLen + 4);
  memcpy(saltBlock, salt, saltLen);
  for (uint32_t block = 1; block <= blockCount; ++block) {
    saltBlock[saltLen+0]=(block>>24)&0xFF; saltBlock[saltLen+1]=(block>>16)&0xFF; saltBlock[saltLen+2]=(block>>8)&0xFF; saltBlock[saltLen+3]=block&0xFF;
    hmac_sha512(password, passwordLen, saltBlock, saltLen + 4, u); memcpy(t, u, 64);
    for (uint32_t i = 1; i < iterations; ++i) { hmac_sha512(password, passwordLen, u, 64, u); for (size_t j=0;j<64;++j) t[j]^=u[j]; }
    size_t offset = (block - 1) * 64; size_t toCopy = (dkLen - offset > 64) ? 64 : (dkLen - offset); memcpy(output + offset, t, toCopy);
  }
  free(saltBlock);
}

class MyServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer *srv) override {
    deviceConnected = true; isAuthenticated = false; sessionStartTime = 0; isProcessingAuth = false;
    sendResponse("auth", "Need PIN", DynamicJsonDocument(0));
  }
  void onDisconnect(BLEServer *srv) override {
    deviceConnected = false; isAuthenticated = false; sessionStartTime = 0; isProcessingAuth = false;
  }
};

class CommandCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *ch) override {
    String value = ch->getValue(); if (value.length() == 0) return;
    if (value.charAt(0) == '{') { processCommand(value); return; }
    const size_t maxDecoded = base64DecodedMaxLen(value.length());
    uint8_t *buf = (uint8_t *)malloc(maxDecoded);
    if (!buf) { sendResponse("err", "OOM", DynamicJsonDocument(0)); return; }
    size_t n = base64Decode(value, buf);
    if (n == 0) { free(buf); sendResponse("err", "X", DynamicJsonDocument(0)); return; }
    String decoded = String((char *)buf, n); free(buf);
    if (decoded.length() == 0) { sendResponse("err", "X", DynamicJsonDocument(0)); return; }
    processCommand(decoded);
  }
};

String targetGesture = ""; 

String morseCode[36] = {
  ".-","-...","-.-.","-..",".","..-.","--.","....","..",".---",
  "-.-",".-..","--","-.","---",".--.","--.-",".-.","...","-",
  "..-","...-",".--","-..-","-.--","--..","-----",".----","..---","...--",
  "....-",".....","-....","--...","---..","----."
};
char characters[36] = {
  'A','B','C','D','E','F','G','H','I','J','K','L','M','N','O',
  'P','Q','R','S','T','U','V','W','X','Y','Z','0','1','2','3',
  '4','5','6','7','8','9'
};

String currentMorse = "";
String enteredPassword = "";
int currentLetterIndex = 0;
bool transactionPending = false;
bool passwordMode = false;
unsigned long lastTransactionRequest = 0;
int passwordAttempts = 0;
sensors_event_t a, g, temp;

struct PendingTx {
  uint8_t *msg = nullptr;
  size_t len = 0;
  int walletIndex = -1;
  bool active = false;
} pending;

void displayStatus(String status);
void vibrate(int onFor, int offFor, int times);
long readPressure();
String insert_password();
String gesture_pressed(long pressure);
String end_morse();
void completeMorseLetter();
void resetPasswordEntry();
char findMorseCharacter(String morse);
void handlePasswordEntry(long pressure);

void processCommand(const String &command) {
  DynamicJsonDocument doc(2048);
  if (deserializeJson(doc, command)) { sendResponse("err", "X", DynamicJsonDocument(0)); return; }

  String action = doc["command"] | "";
  JsonVariant payload = doc["payload"];

  if (millis() < lockoutEndTime) { sendResponse("lock", "X", DynamicJsonDocument(0)); return; }

  if (action == "authenticate") {
    if (isProcessingAuth) return; isProcessingAuth = true;
    String password = payload["password"] | "";
    if (password.length() == 0) { sendResponse("err", "X", DynamicJsonDocument(0)); isProcessingAuth = false; return; }
    handleAuthentication(password); isProcessingAuth = false; return;
  }

  if (action == "change_password") {
    if (!isAuthenticated || isSessionExpired()) { sendResponse("err", "Need auth", DynamicJsonDocument(0)); return; }
    String oldP = payload["old"] | ""; String newP = payload["new"] | ""; handlePasswordChange(oldP, newP); return;
  }

  if (action == "set_morse_letters") { String letters = payload["letters"] | ""; setMorseLetters(letters); return; }
  if (action == "get_morse_letters") { getMorseLetters(); return; }
  if (action == "clear_morse_letters") { clearMorseLetters(); return; }

  if (action == "save_gesture") { String letters = payload["gesture"] | ""; setMorseLetters(letters); return; }
  if (action == "get_saved_gesture") { getMorseLetters(); return; }

  if (!isAuthenticated) { sendResponse("auth_required", "Need auth", DynamicJsonDocument(0)); return; }
  if (isSessionExpired()) {
    isAuthenticated = false; sessionStartTime = 0; sendResponse("err", "Expired", DynamicJsonDocument(0)); return;
  }

  if (action == "create_wallet") { createWallet(); return; }
  if (action == "list_wallets") { listWallets(); return; }
  if (action == "select_wallet") {
    currentWalletIndex = (int)payload["wallet_index"];
    if (currentWalletIndex >= 0 && currentWalletIndex < MAX_WALLETS && wallets[currentWalletIndex].initialized) {
      DynamicJsonDocument p(256);
      p["wallet_index"] = currentWalletIndex;
      p["public_key"] = toHex(wallets[currentWalletIndex].publicKey, 32);
      p["address"] = suiAddressFromPublicKey(wallets[currentWalletIndex].publicKey);
      sendResponse("wallet_selected", "K", p);
    } else { sendResponse("err", "X", DynamicJsonDocument(0)); }
    return;
  }
  if (action == "delete_wallet") { deleteWallet((int)payload["wallet_index"]); return; }
  if (action == "sign_transaction") {
    int idx = (int)payload["wallet_index"];
    String txBase64 = payload["transaction_data"] | "";
    signTransaction_enqueue(idx, txBase64);
    return;
  }
  if (action == "get_device_status") { getDeviceStatus(); return; }
  if (action == "emergency_wipe") { emergencyWipe(); return; }

  sendResponse("err", "X", DynamicJsonDocument(0));
}

void handleAuthentication(const String &password) {
  String pw = password; pw.trim();
  if (pw == devicePassword) {
    isAuthenticated = true; sessionStartTime = millis(); failedAuthAttempts = 0;
    sendResponse("ok", "K", DynamicJsonDocument(0));
  } else {
    failedAuthAttempts++;
    if (failedAuthAttempts >= MAX_AUTH_ATTEMPTS) {
      lockoutEndTime = millis() + LOCKOUT_TIME; isAuthenticated = false; sessionStartTime = 0;
      sendResponse("lock", "X", DynamicJsonDocument(0));
    } else { sendResponse("err", "X", DynamicJsonDocument(0)); }
  }
}
void handlePasswordChange(const String &oldPassword, const String &newPassword) {
  if (oldPassword != devicePassword || newPassword.length() < 4) { sendResponse("err", "X", DynamicJsonDocument(0)); return; }
  devicePassword = newPassword; saveToEEPROM(newPassword, EEPROM_PASSWORD_ADDR, EEPROM_PASSWORD_LENGTH_ADDR);
  sendResponse("ok", "K", DynamicJsonDocument(0)); isAuthenticated = false; sessionStartTime = 0;
}
bool isSessionExpired() {
  if (!isAuthenticated || sessionStartTime == 0) return true;
  return (millis() - sessionStartTime) > SESSION_TIMEOUT;
}

void getDeviceStatus() {
  DynamicJsonDocument p(1024);
  p["authenticated"] = isAuthenticated;
  bool active = isAuthenticated && !isSessionExpired();
  p["session_active"] = active; p["connection_stable"] = deviceConnected; p["failed_attempts"] = failedAuthAttempts;
  p["locked"] = millis() < lockoutEndTime;
  p["session_remaining_minutes"] = active ? (SESSION_TIMEOUT - (millis() - sessionStartTime)) / 60000UL : 0;
  if (millis() < lockoutEndTime) p["lockout_remaining_seconds"] = (lockoutEndTime - millis()) / 1000UL;
  int count = 0; for (int i=0;i<MAX_WALLETS;i++) if (wallets[i].initialized) count++;
  p["wallet_count"] = count; p["max_wallets"] = MAX_WALLETS;
  p["morse_letters_set"] = (targetGesture.length() == 2);
  sendResponse("device_status", "Device status retrieved", p);
}
void createWallet() {
  int slot = -1; for (int i = 0; i < MAX_WALLETS; i++) if (!wallets[i].initialized) { slot = i; break; }
  if (slot == -1) { sendResponse("err", "Max wallets", DynamicJsonDocument(0)); return; }
  auto words = BIP39::generate_mnemonic(); String mnemonic = ""; bool first = true;
  for (const auto &w : words) { if (!first) mnemonic += " "; mnemonic += w.c_str(); first = false; } mnemonic.trim();
  deriveKeys(mnemonic, wallets[slot].privateKey, wallets[slot].publicKey);
  wallets[slot].mnemonic = mnemonic; wallets[slot].initialized = true; saveWalletToEEPROM(slot);
  DynamicJsonDocument p(1024);
  p["wallet_index"] = slot; p["public_key"] = toHex(wallets[slot].publicKey, 32); p["address"] = suiAddressFromPublicKey(wallets[slot].publicKey);
  sendResponse("wallet_created", "K", p);
}
void listWallets() {
  DynamicJsonDocument p(2048); JsonArray arr = p.createNestedArray("wallets");
  if (!simulateNoWallets) {
    for (int i=0;i<MAX_WALLETS;i++) if (wallets[i].initialized) {
      JsonObject w = arr.createNestedObject();
      w["index"] = i; w["public_key"] = toHex(wallets[i].publicKey, 32); w["address"] = suiAddressFromPublicKey(wallets[i].publicKey);
    }
  }
  sendResponse("wallet_list", "K", p);
}
void deleteWallet(int walletIndex) {
  if (walletIndex < 0 || walletIndex >= MAX_WALLETS || !wallets[walletIndex].initialized) { sendResponse("err", "X", DynamicJsonDocument(0)); return; }
  wallets[walletIndex].mnemonic = ""; memset(wallets[walletIndex].privateKey, 0, 32); memset(wallets[walletIndex].publicKey, 0, 32);
  wallets[walletIndex].initialized = false; clearWalletInEEPROM(walletIndex);
  DynamicJsonDocument p(128); p["deleted_wallet_index"] = walletIndex; sendResponse("ok", "K", p);
}

void signTransaction_enqueue(int walletIndex, const String &txBase64) {
  if (walletIndex < 0 || walletIndex >= MAX_WALLETS || !wallets[walletIndex].initialized) { sendResponse("err", "X", DynamicJsonDocument(0)); return; }
  if (txBase64.length() < 8) { sendResponse("err", "X", DynamicJsonDocument(0)); return; }

  if (targetGesture.length() != 2) {
    DynamicJsonDocument p(64); p["needs_letters"] = true;
    sendResponse("err", "PIN_NOT_SET", p);
    return;
  }

  if (pending.msg) { free(pending.msg); pending.msg = nullptr; pending.len = 0; pending.active = false; }

  const size_t maxDecoded = base64DecodedMaxLen(txBase64.length());
  uint8_t *txBytes = (uint8_t *)malloc(maxDecoded);
  if (!txBytes) { sendResponse("err", "OOM", DynamicJsonDocument(0)); return; }
  size_t txLen = base64Decode(txBase64, txBytes);
  if (txLen == 0 || txLen > maxDecoded) { free(txBytes); sendResponse("err", "B64", DynamicJsonDocument(0)); return; }

  const uint8_t *msg = txBytes; size_t msgLen = txLen;
  if (txLen >= 3 && txBytes[0] == 0x00 && txBytes[1] == 0x00 && txBytes[2] == 0x00) { msg = txBytes + 3; msgLen = txLen - 3; }

  pending.msg = (uint8_t *)malloc(msgLen);
  if (!pending.msg) { free(txBytes); sendResponse("err", "OOM", DynamicJsonDocument(0)); return; }
  memcpy(pending.msg, msg, msgLen); pending.len = msgLen; pending.walletIndex = walletIndex; pending.active = true;
  free(txBytes);

  transactionPending = true; passwordMode = false; lastTransactionRequest = millis();
  displayStatus("Transaction?"); vibrate(200, 100, 3);

  DynamicJsonDocument p(128); p["awaiting_user"] = true;
  sendResponse("tx_pending", "Awaiting physical approval", p);
}

void doSignPending() {
  if (!pending.active || !wallets[pending.walletIndex].initialized) {
    DynamicJsonDocument p(64); p["ok"]=false; sendResponse("err","NO_TX",p); return;
  }

  uint8_t suiSignature[97];
  int rc = microsui_sign_ed25519(suiSignature, pending.msg, pending.len, wallets[pending.walletIndex].privateKey);
  if (rc != 0) {
    DynamicJsonDocument p(128); p["rc"]=rc;
    sendResponse("err","SIGN",p);
  } else if (memcmp(suiSignature + 65, wallets[pending.walletIndex].publicKey, 32) != 0) {
    sendResponse("err","KEY_MISMATCH", DynamicJsonDocument(0));
  } else {
    String sigB64; base64Encode(suiSignature, sizeof(suiSignature), sigB64);
    DynamicJsonDocument p(256 + sigB64.length());
    p["wallet_index"] = pending.walletIndex; p["signature_base64"] = sigB64;
    sendResponse("ok","K", p);
  }

  if (pending.msg) { free(pending.msg); pending.msg=nullptr; } pending.len = 0; pending.walletIndex = -1; pending.active = false;
}

void rejectPending(const char* reason) {
  if (pending.active) {
    if (pending.msg) { free(pending.msg); pending.msg = nullptr; }
    pending.len = 0; pending.walletIndex = -1; pending.active = false;
  }
  DynamicJsonDocument p(128); p["reason"] = reason;
  sendResponse("err","REJECTED", p);
}

void requestTransaction_FromTimer() {
  if (millis() - lastTransactionRequest > 30000 && !transactionPending && !pending.active) {
    transactionPending = true; displayStatus("Transaction?"); vibrate(200,100,3); lastTransactionRequest = millis();
  }
}

String insert_password() {
  if (g.gyro.y < -2) { vibrate(500, 100, 1); return "yes"; }  
  if (g.gyro.y >  2) { vibrate(500, 100, 2); return "no"; }   
  return "nil";
}

String gesture_pressed(long pressure) {
  static bool pressStarted = false; static unsigned long startTime = 0;
  if (pressure <= 1 && !pressStarted) { pressStarted = true; startTime = millis(); return ""; }
  if (pressure > 1 && pressStarted) {
    pressStarted = false; unsigned long d = millis() - startTime;
    if (d >= 1500) { vibrate(300,0,1); return "dash"; }
    else if (d >= 100) { vibrate(100,0,1); return "dot"; }
  }
  return "";
}
String end_morse() { return (a.acceleration.x >= 3) ? "yes" : "no"; }
char findMorseCharacter(String morse) {
  for (int i = 0; i < 36; i++) if (morseCode[i] == morse) return characters[i];
  return '?';
}

void completeMorseLetter() {
  char foundChar = findMorseCharacter(currentMorse);
  if (foundChar != '?') {
    enteredPassword += foundChar; vibrate(150, 50, 2); currentLetterIndex++;
    if (currentLetterIndex >= (int)targetGesture.length()) {
      if (targetGesture.length() == 2 && enteredPassword == targetGesture) {
        displayStatus("APPROVED!"); vibrate(200,100,5);
        if (pending.active) doSignPending(); else sendResponse("info","No TX queued", DynamicJsonDocument(0));
        passwordMode = false; transactionPending = false;
      } else {
        passwordAttempts++;
        if (passwordAttempts >= 2) {
          displayStatus("ACCESS DENIED"); vibrate(1500,300,3);
          if (pending.active) rejectPending("WRONG_PASSWORD");
          passwordMode = false; transactionPending = false;
        } else {
          displayStatus("Wrong! Try Again"); vibrate(1000,200,2);
        }
      }
      enteredPassword = ""; currentLetterIndex = 0; currentMorse = ""; delay(800);
    } else { currentMorse = ""; displayStatus("Next Letter"); }
  } else {
    resetPasswordEntry(); vibrate(1000,100,3);
  }
  currentMorse = "";
}
void resetPasswordEntry() {
  enteredPassword = ""; currentLetterIndex = 0; currentMorse = ""; displayStatus("Restart Entry");
}
void handlePasswordEntry(long pressure) {
  String gesture = gesture_pressed(pressure);
  if (gesture != "") { currentMorse += (gesture == "dot") ? "." : "-"; displayStatus((gesture == "dot") ? "Dot" : "Dash"); }
  if (end_morse() == "yes") completeMorseLetter();
}

bool isAlnumAZ09(char c) {
  return (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9');
}

void setMorseLetters(String letters) {
  if (!isAuthenticated || isSessionExpired()) {
    sendResponse("err", "Need auth", DynamicJsonDocument(0));
    return;
  }
  letters.trim(); letters.toUpperCase();
  if (letters.length() != 2 || !isAlnumAZ09(letters[0]) || !isAlnumAZ09(letters[1])) {
    sendResponse("err", "Use two letters/digits", DynamicJsonDocument(0));
    return;
  }
  targetGesture = letters;
  saveToEEPROM(letters, EEPROM_MORSE_CODE_ADDR, EEPROM_MORSE_CODE_LENGTH_ADDR);
  morseCodeSaved = true;
  DynamicJsonDocument p(64); p["letters"] = targetGesture;
  sendResponse("morse_letters_set", "OK", p);
}

void getMorseLetters() {
  DynamicJsonDocument p(64);
  p["letters"] = (targetGesture.length() == 2) ? targetGesture : "";
  p["is_set"] = targetGesture.length() == 2;
  sendResponse("morse_letters", "K", p);
}

void clearMorseLetters() {
  if (!isAuthenticated || isSessionExpired()) {
    sendResponse("err", "Need auth", DynamicJsonDocument(0));
    return;
  }
  targetGesture = "";
  saveToEEPROM("", EEPROM_MORSE_CODE_ADDR, EEPROM_MORSE_CODE_LENGTH_ADDR);
  morseCodeSaved = false;
  DynamicJsonDocument p(32); p["cleared"] = true;
  sendResponse("morse_letters_cleared", "OK", p);
}

void emergencyWipe() {
  savedMorseCode = ""; morseCodeSaved = false; devicePassword = DEFAULT_PASSWORD;
  targetGesture = ""; 
  isAuthenticated = false; sessionStartTime = 0; failedAuthAttempts = 0; lockoutEndTime = 0; currentWalletIndex = -1;
  for (int i=0;i<MAX_WALLETS;i++){ wallets[i].mnemonic=""; memset(wallets[i].privateKey,0,32); memset(wallets[i].publicKey,0,32); wallets[i].initialized=false; }
  for (int i=0;i<EEPROM_SIZE;i++) EEPROM.write(i,0); EEPROM.commit();
  if (pending.msg){ free(pending.msg); pending.msg=nullptr; } pending = PendingTx();
  DynamicJsonDocument p(128); p["wiped"]=true; sendResponse("emergency_wipe_complete","K", p);
}

long readPressure() {
  long pressure = 0;
  if (scale.is_ready()) {
    pressure = scale.read();
    pressure = map(pressure, 2500000, 4200000, 100, 0);
    if (pressure < 0) pressure = 0; if (pressure > 100) pressure = 100;
  }
  return pressure;
}
void vibrate(int onFor, int offFor, int times) {
  pinMode(vibrator, OUTPUT);
  for (int i=0;i<times;i++){ digitalWrite(vibrator,HIGH); delay(onFor); digitalWrite(vibrator,LOW); if (i<times-1) delay(offFor); }
}
void displayStatus(String status) {
#if USE_OLED
  oled.clearDisplay(); oled.setCursor(0, 0);
  oled.println("Sui Shoe Wallet"); oled.println("---------------"); oled.println("Status: " + status);
  if (passwordMode) { oled.println("Pwd: " + enteredPassword); oled.println("Tgt: " + (targetGesture.length()==2 ? targetGesture : String("--"))); oled.println("Morse: " + currentMorse); }
  oled.display();
#else
  (void)status;
#endif
}
void updateDisplay(long pressure) {
#if USE_OLED
  static unsigned long lastUpdate = 0; if (millis() - lastUpdate < 500) return; lastUpdate = millis();
  if (!transactionPending && !passwordMode) {
    oled.clearDisplay(); oled.setCursor(0, 0);
    oled.println("Sui Shoe Wallet"); oled.println("---------------");
    oled.print("A:"); oled.print(a.acceleration.x,1); oled.print(","); oled.print(a.acceleration.y,1); oled.print(","); oled.println(a.acceleration.z,1);
    oled.print("G:"); oled.print(g.gyro.x,1); oled.print(","); oled.print(g.gyro.y,1); oled.print(","); oled.println(g.gyro.z,1);
    oled.print("Pressure: "); oled.println(pressure);
    oled.print("PIN set: "); oled.println(targetGesture.length()==2 ? "YES" : "NO");
    oled.println("Ready...");
    oled.display();
  }
#else
  (void)pressure;
#endif
}

void seed_entropy() {
#ifdef ESP32
  randomSeed(esp_random());
#else
  uint32_t seed = 0; for (int i=0;i<32;++i){ seed ^= analogRead(i % 6); delay(10); } randomSeed(seed);
#endif
}

void setup() {
  pinMode(vibrator, OUTPUT);
  Serial.begin(115200); delay(200);
  for (int i=0;i<MAX_WALLETS;i++) wallets[i].initialized=false;
  seed_entropy();

  EEPROM.begin(EEPROM_SIZE);
  {
    String savedPassword = loadFromEEPROM(EEPROM_PASSWORD_ADDR, EEPROM_PASSWORD_LENGTH_ADDR);
    if (savedPassword.length() > 0) devicePassword = savedPassword;

    String savedLetters = loadFromEEPROM(EEPROM_MORSE_CODE_ADDR, EEPROM_MORSE_CODE_LENGTH_ADDR);
    savedLetters.toUpperCase();
    if (savedLetters.length() == 2 && isAlnumAZ09(savedLetters[0]) && isAlnumAZ09(savedLetters[1])) {
      targetGesture = savedLetters; morseCodeSaved = true;
    } else {
      targetGesture = ""; morseCodeSaved = false;
    }
  }
  loadWalletsFromEEPROM();

#if USE_OLED
  Wire.begin();
  if (!oled.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS)) 
  oled.setRotation(2); oled.setTextSize(1); oled.setTextColor(WHITE);
#endif
  if (!mpu.begin()) 
  mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
  mpu.setGyroRange(MPU6050_RANGE_500_DEG);
  mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);

  scale.begin(LOADCELL_DOUT_PIN, LOADCELL_SCK_PIN);

  vibrate(200, 100, 2);
  displayStatus("Ready");

  BLEDevice::init("Sui-Wallet-BLE");
  pServer = BLEDevice::createServer(); pServer->setCallbacks(new MyServerCallbacks());
  BLEService *pService = pServer->createService(SERVICE_UUID);
  pCommandCharacteristic = pService->createCharacteristic(COMMAND_CHARACTERISTIC_UUID, BLECharacteristic::PROPERTY_WRITE);
  pCommandCharacteristic->setCallbacks(new CommandCallbacks());
  pNotifyCharacteristic = pService->createCharacteristic(NOTIFY_CHARACTERISTIC_UUID, BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY | BLECharacteristic::PROPERTY_INDICATE);
  pNotifyCharacteristic->addDescriptor(new BLE2902());
  pService->start();
  BLEAdvertising *adv = BLEDevice::getAdvertising(); adv->addServiceUUID(SERVICE_UUID); adv->setScanResponse(true); adv->setMinPreferred(0x0);
  BLEDevice::startAdvertising();
}

void loop() {
  if (!deviceConnected && oldDeviceConnected) { delay(500); pServer->startAdvertising(); oldDeviceConnected = deviceConnected; }
  if (deviceConnected && !oldDeviceConnected) { oldDeviceConnected = deviceConnected; }

  if (isAuthenticated && isSessionExpired()) {
    isAuthenticated = false; sessionStartTime = 0;
    if (deviceConnected) { DynamicJsonDocument p(128); p["authenticated"]=false; p["session_expired"]=true; sendResponse("info","Session expired. Please authenticate again.", p); }
  }
  if (millis() >= lockoutEndTime && lockoutEndTime > 0) { failedAuthAttempts = 0; lockoutEndTime = 0; }

  mpu.getEvent(&a, &g, &temp);
  long pressure = readPressure();

  if (pending.active && !transactionPending && !passwordMode) {
    transactionPending = true; displayStatus("Transaction?"); vibrate(200,100,3);
  }

  if (transactionPending && !passwordMode) {
    String decision = insert_password();
    if (decision == "no") {
      transactionPending = false; displayStatus("Rejected"); vibrate(1000,0,1); rejectPending("USER_TILT_REJECT"); delay(300);
    } else if (decision == "yes") {
      if (targetGesture.length() != 2) {
        displayStatus("Set PIN first");
        vibrate(800, 200, 2);
        rejectPending("PIN_NOT_SET");
      } else {
        transactionPending = false; passwordMode = true; enteredPassword = ""; currentMorse=""; currentLetterIndex=0; passwordAttempts=0;
        displayStatus("Enter Password"); vibrate(200,100,2);
      }
    }
  }

  if (passwordMode) { handlePasswordEntry(pressure); }

  updateDisplay(pressure);
  delay(60);
}

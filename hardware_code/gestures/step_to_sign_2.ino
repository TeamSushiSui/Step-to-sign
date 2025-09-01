#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <Wire.h>
#include "HX711.h"

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define SCREEN_ADDRESS 0x3C
Adafruit_SSD1306 oled(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

const int LOADCELL_DOUT_PIN = 10;
const int LOADCELL_SCK_PIN = 9;
const int vibrator = 8;

Adafruit_MPU6050 mpu;
HX711 scale;

String targetGesture = "SU";  // Password
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

String currentMorse = "";
String enteredPassword = "";
int currentLetterIndex = 0;
bool transactionPending = false;
bool passwordMode = false;
unsigned long lastTransactionRequest = 0;
int passwordAttempts = 0;

sensors_event_t a, g, temp;

// ========== SETUP ==========
void setup() {
  pinMode(vibrator, OUTPUT);
  Serial.begin(115200);

  scale.begin(LOADCELL_DOUT_PIN, LOADCELL_SCK_PIN);
  if (!oled.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS)) {
    Serial.println("OLED failed");
    while (1)
      ;
  }
  oled.setRotation(2);
  oled.setTextSize(1);
  oled.setTextColor(WHITE);
  vibrate(500, 100, 2);
  Serial.println("Smart In-Shoe Wallet Ready!");
  Serial.println("Target password: " + targetGesture);
  displayStatus("Ready");
  if (!mpu.begin()) {
    Serial.println("MPU6050 not found");
    while (1)
      ;
  }
  mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
  mpu.setGyroRange(MPU6050_RANGE_500_DEG);
  mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
  delay(100);   


}

// ========== MAIN LOOP ==========
void loop() {
  mpu.getEvent(&a, &g, &temp);
  long pressure = readPressure();

  if (millis() - lastTransactionRequest > 30000 && !transactionPending) {
    requestTransaction();
    lastTransactionRequest = millis();
  }

  if (transactionPending && !passwordMode) {
    handleTransactionDecision();
  }

  if (passwordMode) {
    handlePasswordEntry(pressure);
  }

  updateDisplay(pressure);
  delay(100);
}

// ========== PRESSURE READING ==========
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

// ========== VIBRATION ==========
void vibrate(int onFor, int offFor, int times) {
  for (int i = 0; i < times; i++) {
    digitalWrite(vibrator, HIGH);
    delay(onFor);
    digitalWrite(vibrator, LOW);
    if (i < times - 1) delay(offFor);
  }
}

// ========== TRANSACTION REQUEST ==========
void requestTransaction() {
  transactionPending = true;
  Serial.println("\n=== TRANSACTION REQUEST ===");
  Serial.println("New Sui transaction pending...");
  Serial.println("Tilt left to REJECT, right to APPROVE");
  displayStatus("Transaction?");
  vibrate(200, 100, 3);
}

// ========== DECISION VIA GESTURE ==========
void handleTransactionDecision() {
  String decision = insert_password();
  if (decision == "no") {
    transactionPending = false;
    Serial.println("TRANSACTION REJECTED");
    displayStatus("Rejected");
    vibrate(1000, 0, 1);
    delay(2000);
  } else if (decision == "yes") {
    transactionPending = false;
    passwordMode = true;
    enteredPassword = "";
    currentMorse = "";
    currentLetterIndex = 0;
    passwordAttempts = 0;
    Serial.println("TRANSACTION APPROVED - Enter password");
    displayStatus("Enter Password");
    vibrate(200, 100, 2);
  }
}

// ========== GESTURE DECISION ==========
String insert_password() {
  if (g.gyro.y < -2) {
    vibrate(500, 100, 1);  // Tilt left
    return "yes";
  } else if (g.gyro.y > 2) {
    vibrate(500, 100, 2);  // Tilt right
    return "no";
  }
  return "nil";
}

// ========== MORSE PRESS DETECTION ==========
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

// ========== HANDLE PASSWORD ENTRY ==========
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

String end_morse() {
  return (a.acceleration.x >= 3) ? "yes" : "no";
}

// ========== PROCESS LETTER ==========
void completeMorseLetter() {
  char foundChar = findMorseCharacter(currentMorse);
  if (foundChar != '?') {
    enteredPassword += foundChar;
    Serial.println("Letter: " + String(foundChar));
    vibrate(150, 50, 2);
    currentLetterIndex++;
    if (currentLetterIndex >= targetGesture.length()) {
      checkPassword();
    } else {
      currentMorse = "";
      displayStatus("Next Letter");
    }
  } else {
    Serial.println("Invalid Morse. Restarting...");
    resetPasswordEntry();
    vibrate(1000, 100, 3);
  }
  currentMorse = "";
}

// ========== PASSWORD VALIDATION ==========
void checkPassword() {
  if (enteredPassword == targetGesture) {
    Serial.println("=== PASSWORD CORRECT ===");
    displayStatus("APPROVED!");
    vibrate(200, 100, 5);
  } else {
    passwordAttempts++;
    Serial.println("=== WRONG PASSWORD ===");
    Serial.println("Entered: " + enteredPassword);
    if (passwordAttempts >= 2) {
      Serial.println("ACCESS DENIED.");
      displayStatus("ACCESS DENIED");
      vibrate(1500, 300, 3);
      passwordMode = false;
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

// ========== FIND CHAR ==========
char findMorseCharacter(String morse) {
  for (int i = 0; i < 36; i++) {
    if (morseCode[i] == morse) {
      return characters[i];
    }
  }
  return '?';
}

// ========== DISPLAY HELPERS ==========
void displayStatus(String status) {
  oled.clearDisplay();
  oled.setCursor(0, 0);
  oled.println("Sui Shoe Wallet");
  oled.println("---------------");
  oled.println("Status: " + status);

  if (passwordMode) {
    oled.println("Pwd: " + enteredPassword);
    oled.println("Tgt: " + targetGesture);
    oled.println("Morse: " + currentMorse);
  }

  oled.display();
}

void updateDisplay(long pressure) {
  static unsigned long lastUpdate = 0;
  if (millis() - lastUpdate < 500) return;
  lastUpdate = millis();

  if (!transactionPending && !passwordMode) {
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

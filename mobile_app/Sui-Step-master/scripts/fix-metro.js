const { execSync } = require("child_process");
const os = require("os");

console.log("🔧 Fixing Metro connection issues...\n");

try {
  // Kill any existing Metro processes
  console.log("1. Killing existing Metro processes...");
  if (os.platform() === "win32") {
    execSync("taskkill /f /im node.exe", { stdio: "ignore" });
  } else {
    execSync('pkill -f "react-native"', { stdio: "ignore" });
    execSync('pkill -f "metro"', { stdio: "ignore" });
  }
  console.log("  Metro processes killed\n");

  // Clear Metro cache
  console.log("2. Clearing Metro cache...");
  execSync("npx react-native start --reset-cache", { stdio: "inherit" });
  console.log("  Metro cache cleared\n");

  // For Android, restart ADB
  console.log("3. Restarting ADB...");
  execSync("adb kill-server", { stdio: "ignore" });
  execSync("adb start-server", { stdio: "ignore" });
  console.log("  ADB restarted\n");

  // Set up port forwarding
  console.log("4. Setting up port forwarding...");
  execSync("adb reverse tcp:8081 tcp:8081", { stdio: "ignore" });
  console.log("  Port forwarding set up\n");

  console.log("🎉 Metro connection should now be fixed!");
  console.log("\nNext steps:");
  console.log("1. Restart your app");
  console.log(
    "2. If using a physical device, make sure it's on the same WiFi network"
  );
  console.log("3. If issues persist, try: adb reverse tcp:8081 tcp:8081");
} catch (error) {
  console.error("   Error fixing Metro:", error.message);
  console.log("\nManual steps to try:");
  console.log("1. Close the app completely");
  console.log("2. Run: npx react-native start --reset-cache");
  console.log("3. In another terminal, run: npx react-native run-android");
  console.log(
    "4. If using physical device, run: adb reverse tcp:8081 tcp:8081"
  );
}

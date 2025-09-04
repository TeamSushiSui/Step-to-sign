import { Vibration } from "react-native";

// Feedback types
export const FeedbackType = {
  SUCCESS: "success",
  ERROR: "error",
  WARNING: "warning",
  CONNECT: "connect",
  DISCONNECT: "disconnect",
  TRANSACTION: "transaction",
  AUTHENTICATION: "authentication",
  GESTURE: "gesture",
  TAP: "tap",
};

class FeedbackManager {
  constructor() {
    this.vibration = false;
  }

  // Initialize feedback settings
  init(vibration = false) {
    this.vibration = vibration;
    console.log("Feedback: Initialized with vibration:", vibration);
  }

  // Update settings
  updateSettings(vibration) {
    this.vibration = vibration;
    console.log("Feedback: Updated vibration setting:", vibration);
  }

  // Provide haptic feedback using React Native Vibration API
  async hapticFeedback(type) {
    if (!this.vibration) {
      console.log("Feedback: Vibration disabled, skipping feedback");
      return;
    }

    try {
      console.log("Feedback: Providing haptic feedback for:", type);
      // Only applying vibration patterns for now, to be expanded later
      switch (type) {
        case FeedbackType.SUCCESS:
          // Single vibration for success
          Vibration.vibrate(100);
          break;
        case FeedbackType.ERROR:
          // Double vibration for error
          Vibration.vibrate([0, 100, 50, 100]);
          break;
        case FeedbackType.WARNING:
          // Triple vibration for warning
          Vibration.vibrate([0, 100, 50, 100, 50, 100]);
          break;
        case FeedbackType.CONNECT:
          // Medium vibration for connection
          Vibration.vibrate(150);
          break;
        case FeedbackType.DISCONNECT:
          // Long vibration for disconnection
          Vibration.vibrate(300);
          break;
        case FeedbackType.TRANSACTION:
          // Strong vibration pattern for transactions
          Vibration.vibrate([0, 200, 100, 200]);
          break;
        case FeedbackType.AUTHENTICATION:
          // Medium vibration for authentication
          Vibration.vibrate(150);
          break;
        case FeedbackType.GESTURE:
          // Light vibration for gestures
          Vibration.vibrate(50);
          break;
        case FeedbackType.TAP:
          // Light vibration for taps
          Vibration.vibrate(50);
          break;
        default:
          // Default medium vibration
          Vibration.vibrate(100);
      }
      console.log("  Feedback: Haptic feedback provided successfully");
    } catch (error) {
      console.log("   Feedback: Haptic feedback error:", error);
    }
  }

  // Main feedback function
  async provideFeedback(type) {
    await this.hapticFeedback(type);
  }

  // Convenience methods for common actions
  async connect() {
    await this.provideFeedback(FeedbackType.CONNECT);
  }

  async disconnect() {
    await this.provideFeedback(FeedbackType.DISCONNECT);
  }

  async success() {
    await this.provideFeedback(FeedbackType.SUCCESS);
  }

  async error() {
    await this.provideFeedback(FeedbackType.ERROR);
  }

  async warning() {
    await this.provideFeedback(FeedbackType.WARNING);
  }

  async transaction() {
    await this.provideFeedback(FeedbackType.TRANSACTION);
  }

  async authentication() {
    await this.provideFeedback(FeedbackType.AUTHENTICATION);
  }

  async gesture() {
    await this.provideFeedback(FeedbackType.GESTURE);
  }

  async tap() {
    await this.provideFeedback(FeedbackType.TAP);
  }

  // Test vibration function
  async testVibration() {
    console.log("Feedback: Testing vibration...");
    await this.hapticFeedback(FeedbackType.SUCCESS);
  }

  // Stop vibration
  stopVibration() {
    Vibration.cancel();
  }
}

// Create singleton instance
const feedbackManager = new FeedbackManager();
export default feedbackManager;

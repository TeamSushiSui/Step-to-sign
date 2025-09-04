import Colors from "@/constants/Colors";
import React from "react";
import {
  Dimensions,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const { width } = Dimensions.get("window");

export default function CustomAlert({
  visible,
  title,
  message,
  buttons = [{ text: "OK", onPress: () => {} }],
  onRequestClose,
  icon,
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onRequestClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {icon && <View style={styles.iconContainer}>{icon}</View>}
          {title && <Text style={styles.title}>{title}</Text>}
          {message && <Text style={styles.message}>{message}</Text>}
          <View style={styles.buttonRow}>
            {buttons.map((btn, idx) => (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.button,
                  btn.style === "cancel" && styles.cancelButton,
                  btn.style === "destructive" && styles.destructiveButton,
                ]}
                onPress={btn.onPress}
              >
                <Text
                  style={[
                    styles.buttonText,
                    btn.style === "cancel" && styles.cancelButtonText,
                    btn.style === "destructive" && styles.destructiveButtonText,
                  ]}
                >
                  {btn.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    width: width * 0.8,
    backgroundColor: Colors.primary || "#fff",
    borderRadius: 18,
    padding: 24,
    alignItems: "center",
    elevation: 8,
  },
  iconContainer: {
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: Colors.secondary || "#222",
    marginBottom: 8,
    textAlign: "center",
  },
  message: {
    fontSize: 16,
    color: "#fff",
    marginBottom: 20,
    textAlign: "center",
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
  },
  button: {
    backgroundColor: Colors.thickOrange || "#F4A261",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 22,
    marginHorizontal: 4,
    marginTop: 8,
  },
  buttonText: {
    color: Colors.primary || "#1A2A44",
    fontWeight: "bold",
    fontSize: 16,
  },
  cancelButton: {
    backgroundColor: "#aaa",
  },
  cancelButtonText: {
    color: "#fff",
  },
  destructiveButton: {
    backgroundColor: "#e74c3c",
  },
  destructiveButtonText: {
    color: "#fff",
  },
});

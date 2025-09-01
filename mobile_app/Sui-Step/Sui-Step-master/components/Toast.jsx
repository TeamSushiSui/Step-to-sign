import Colors from "@/constants/Colors";
import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

export default function Toast({ visible, message }) {
    const opacity = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(20)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
                Animated.timing(translateY, { toValue: 0, duration: 200, useNativeDriver: true }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
                Animated.timing(translateY, { toValue: 20, duration: 200, useNativeDriver: true }),
            ]).start();
        }
    }, [visible, opacity, translateY]);

    if (!visible) return null;

    return (
        <View pointerEvents="none" style={styles.container}>
            <Animated.View style={[styles.toast, { opacity, transform: [{ translateY }] }]}>
                <Text style={styles.text}>{message}</Text>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 40,
        alignItems: "center",
        zIndex: 1000,
    },
    toast: {
        backgroundColor: "rgba(0,0,0,0.8)",
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 10,
        maxWidth: "90%",
    },
    text: {
        color: Colors.white,
        fontSize: 14,
        textAlign: "center",
    },
});



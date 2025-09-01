import Colors from '@/constants/Colors';
import React from 'react';
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const MorseSimulator = ({
    onMorseInput,
    currentInput = "",
    onClear,
    onBackspace
}) => {
    const handleDot = () => {
        onMorseInput('.');
    };

    const handleDash = () => {
        onMorseInput('-');
    };

    const handleSpace = () => {
        onMorseInput(' ');
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Morse Code Simulator</Text>
            <Text style={styles.subtitle}>Tap buttons to simulate sensor input</Text>

            <View style={styles.inputDisplay}>
                <Text style={styles.inputLabel}>Current Input:</Text>
                <Text style={styles.inputText}>{currentInput || 'None'}</Text>
            </View>

            <View style={styles.buttonContainer}>
                <TouchableOpacity
                    style={[styles.morseButton, styles.dotButton]}
                    onPress={handleDot}
                    activeOpacity={0.7}
                >
                    <Text style={styles.dotButtonText}>•</Text>
                    <Text style={styles.buttonLabel}>Dot</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.morseButton, styles.dashButton]}
                    onPress={handleDash}
                    activeOpacity={0.7}
                >
                    <Text style={styles.dashButtonText}>–</Text>
                    <Text style={styles.buttonLabel}>Dash</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.controlContainer}>
                <TouchableOpacity
                    style={[styles.controlButton, styles.spaceButton]}
                    onPress={handleSpace}
                >
                    <Text style={styles.controlButtonText}>Space</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.controlButton, styles.backspaceButton]}
                    onPress={onBackspace}
                >
                    <Text style={styles.controlButtonText}>⌫</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.controlButton, styles.clearButton]}
                    onPress={onClear}
                >
                    <Text style={styles.controlButtonText}>Clear</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.instructions}>
                <Text style={styles.instructionTitle}>Instructions:</Text>
                <Text style={styles.instructionText}>• Short tap = Dot (•)</Text>
                <Text style={styles.instructionText}>• Long tap = Dash (–)</Text>
                <Text style={styles.instructionText}>• Space = Letter separator</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: Colors.lightGray,
        borderRadius: 12,
        padding: 20,
        marginVertical: 10,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.white,
        textAlign: 'center',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        color: Colors.gray,
        textAlign: 'center',
        marginBottom: 16,
    },
    inputDisplay: {
        backgroundColor: Colors.primary,
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
    },
    inputLabel: {
        fontSize: 12,
        color: Colors.gray,
        marginBottom: 4,
    },
    inputText: {
        fontSize: 16,
        fontFamily: 'monospace',
        color: Colors.white,
        fontWeight: '600',
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 16,
        marginBottom: 16,
    },
    morseButton: {
        width: 50,
        height: 50,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
    },
    dotButton: {
        backgroundColor: Colors.thickOrange,
        borderColor: Colors.thickOrange,
    },
    dashButton: {
        backgroundColor: Colors.primary,
        borderColor: Colors.thickOrange,
    },
    dotButtonText: {
        fontSize: 20,
        color: Colors.white,
        fontWeight: 'bold',
        marginBottom: 2,
    },
    dashButtonText: {
        fontSize: 20,
        color: Colors.thickOrange,
        fontWeight: 'bold',
        marginBottom: 2,
    },
    buttonLabel: {
        fontSize: 10,
        color: Colors.white,
        fontWeight: '600',
    },
    controlContainer: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 16,
    },
    controlButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    spaceButton: {
        backgroundColor: Colors.thickOrange,
    },
    backspaceButton: {
        backgroundColor: Colors.primary,
        borderWidth: 1,
        borderColor: Colors.thickOrange,
    },
    clearButton: {
        backgroundColor: '#FF6B6B',
    },
    controlButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.white,
    },
    instructions: {
        backgroundColor: Colors.primary,
        borderRadius: 8,
        padding: 12,
    },
    instructionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.white,
        marginBottom: 8,
    },
    instructionText: {
        fontSize: 12,
        color: Colors.gray,
        marginBottom: 4,
    },
});

export default MorseSimulator;

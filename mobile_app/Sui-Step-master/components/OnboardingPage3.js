// import Colors from "@/constants/Colors";
// import { FontAwesome5, MaterialIcons } from "@expo/vector-icons";
// import React from "react";
// import { StyleSheet, Text, View } from "react-native";
// import { useGlobalState } from "../contexts/GlobalStateProvider";
// import { useOnboardingContext } from "../contexts/OnboardingContext";
// import { PageIndicator } from "./PageIndicator";

// export const OnboardingPage3 = () => {
//   const { currentPage } = useOnboardingContext();
//   const {
//     walletCreated,
//     setWalletCreated,
//     walletSetupCompleted,
//     setWalletSetupCompleted,
//   } = useGlobalState();

//   return (
//     <View style={styles.container}>
//       <View style={styles.content}>
//         <View style={styles.iconContainer}>
//           <FontAwesome5 name="wallet" size={80} color={Colors.thickOrange} />
//         </View>

//         <Text style={styles.title}>Create Your Wallet</Text>
//         <Text style={styles.subtitle}>
//           Create a secure wallet that will be linked to your SuiStep device.
//           This wallet will be used for all your transactions.
//         </Text>

//         <View style={styles.featuresContainer}>
//           <View style={styles.featureItem}>
//             <MaterialIcons
//               name="security"
//               size={20}
//               color={Colors.thickOrange}
//             />
//             <Text style={styles.featureText}>Secure Key Generation</Text>
//           </View>
//           <View style={styles.featureItem}>
//             <MaterialIcons
//               name="device-hub"
//               size={20}
//               color={Colors.thickOrange}
//             />
//             <Text style={styles.featureText}>Device-Linked Security</Text>
//           </View>
//           <View style={styles.featureItem}>
//             <MaterialIcons name="backup" size={20} color={Colors.thickOrange} />
//             <Text style={styles.featureText}>Automatic Backup</Text>
//           </View>
//         </View>

//         <View
//           style={[
//             styles.walletStatus,
//             {
//               backgroundColor: walletCreated
//                 ? "rgba(76, 175, 80, 0.1)"
//                 : "rgba(250, 135, 80, 0.1)",
//               borderColor: walletCreated ? "#4CAF50" : Colors.thickOrange,
//             },
//           ]}
//         >
//           <MaterialIcons
//             name={walletCreated ? "check-circle" : "pending"}
//             size={24}
//             color={walletCreated ? "#4CAF50" : Colors.thickOrange}
//           />
//           <Text
//             style={[
//               styles.walletStatusText,
//               { color: walletCreated ? "#4CAF50" : Colors.thickOrange },
//             ]}
//           >
//             {walletCreated
//               ? "Wallet Created Successfully"
//               : "Ready to Create Wallet"}
//           </Text>
//         </View>
//       </View>

//       <View style={styles.indicatorContainer}>
//         <PageIndicator totalPages={4} currentPage={currentPage} />
//       </View>
//     </View>
//   );
// };

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: Colors.primary,
//     paddingHorizontal: 20,
//   },
//   content: {
//     flex: 1,
//     justifyContent: "center",
//     alignItems: "center",
//     paddingVertical: 40,
//   },
//   iconContainer: {
//     marginBottom: 30,
//   },
//   title: {
//     fontSize: 28,
//     fontWeight: "bold",
//     color: Colors.white,
//     textAlign: "center",
//     marginBottom: 16,
//   },
//   subtitle: {
//     fontSize: 16,
//     color: Colors.gray,
//     textAlign: "center",
//     lineHeight: 24,
//     marginBottom: 40,
//     paddingHorizontal: 20,
//   },
//   featuresContainer: {
//     width: "100%",
//     marginBottom: 40,
//   },
//   featureItem: {
//     flexDirection: "row",
//     alignItems: "center",
//     marginBottom: 16,
//     paddingHorizontal: 20,
//   },
//   featureText: {
//     fontSize: 16,
//     color: Colors.white,
//     marginLeft: 12,
//   },
//   walletStatus: {
//     flexDirection: "row",
//     alignItems: "center",
//     paddingHorizontal: 16,
//     paddingVertical: 8,
//     borderRadius: 20,
//     borderWidth: 1,
//   },
//   walletStatusText: {
//     fontSize: 14,
//     marginLeft: 8,
//     fontWeight: "600",
//   },
//   indicatorContainer: {
//     paddingBottom: 40,
//   },
// });

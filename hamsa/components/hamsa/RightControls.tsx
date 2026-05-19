import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  BackHandler,
  Modal,
  NativeModules,
  Platform,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { APP_URL, Mode, SHARE_MESSAGES } from "../../constants/hamsa";

interface RightControlsProps {
  mode: Mode;
  setMode: (mode: Mode) => void;
  isMuted: boolean;
  toggleMute: () => void;
  isPlaying: boolean;
}

function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <Svg
      height={24}
      pointerEvents="none"
      viewBox="0 0 24 24"
      width={24}
    >
      <Path
        d="M4 9.5v5h4l5 4v-13l-5 4H4Z"
        fill="white"
        pointerEvents="none"
      />
      {muted ? (
        <Path
          d="M17 9l4 4m0-4-4 4"
          fill="none"
          pointerEvents="none"
          stroke="white"
          strokeLinecap="round"
          strokeWidth={2}
        />
      ) : (
        <Path
          d="M16 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"
          fill="none"
          pointerEvents="none"
          stroke="white"
          strokeLinecap="round"
          strokeWidth={2}
        />
      )}
    </Svg>
  );
}

export const RightControls: React.FC<RightControlsProps> = ({
  mode,
  setMode,
  isMuted,
  toggleMute,
  isPlaying,
}) => {
  const [isExitModalVisible, setIsExitModalVisible] = useState(false);

  const fadeStyle = useAnimatedStyle(() => {
    return {
      opacity: withTiming(isPlaying ? 0 : 1, { duration: 500 }),
    };
  });

  const handleShare = async () => {
    try {
      const message =
        SHARE_MESSAGES[Math.floor(Math.random() * SHARE_MESSAGES.length)];

      await Share.share({
        message: `${message}\n\n${APP_URL}`,
        title: "Hamsa Healing",
      });
    } catch (error) {
      console.log("Error sharing:", error);
    }
  };

  const handleExit = () => {
    setIsExitModalVisible(false);
    if (Platform.OS === "android") {
      BackHandler.exitApp();
    } else {
      const { AppExit } = NativeModules;
      if (AppExit) {
        AppExit.exitApp();
      }
    }
  };

  return (
    <View style={styles.rightColumn}>
      <View style={styles.topIcons}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={toggleMute}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.7}
        >
          {Platform.OS === "web" ? (
            <SpeakerIcon muted={isMuted} />
          ) : (
            <Ionicons
              name={!isMuted ? "volume-medium" : "volume-mute"}
              size={24}
              color="white"
            />
          )}
        </TouchableOpacity>
        {Platform.OS !== "web" && (
          <Animated.View
            style={fadeStyle}
            pointerEvents={isPlaying ? "none" : "auto"}
          >
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => setIsExitModalVisible(true)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              activeOpacity={0.7}
            >
              <Ionicons name="exit-outline" size={24} color="white" />
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>

      <Animated.View
        style={[styles.controlsContainer, fadeStyle]}
        pointerEvents={isPlaying ? "none" : "auto"}
      >
        <Text style={styles.sectionLabel}>MODE</Text>
        {(["PHYSICAL BODY", "ENERGY BODY", "FULL BODY"] as Mode[]).map((m) => (
          <TouchableOpacity
            key={m}
            style={[styles.button, mode === m && styles.activeButton]}
            onPress={() => setMode(m)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.7}
          >
            <Text style={styles.buttonText}>{m}</Text>
          </TouchableOpacity>
        ))}
      </Animated.View>

      {Platform.OS !== "web" ? (
        <Animated.View
          style={fadeStyle}
          pointerEvents={isPlaying ? "none" : "auto"}
        >
          <TouchableOpacity
            style={[styles.bottomButton, { backgroundColor: "#a855f7" }]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.7}
            onPress={handleShare}
          >
            <Text style={styles.bottomButtonText}>SHARE ➥</Text>
          </TouchableOpacity>
        </Animated.View>
      ) : (
        <View style={{ height: 40 }} /> // Placeholder to maintain vertical spacing on web
      )}

      <Modal
        animationType="fade"
        transparent={true}
        visible={isExitModalVisible}
        onRequestClose={() => setIsExitModalVisible(false)}
        supportedOrientations={["landscape"]}
      >
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            <Text style={styles.modalTitle}>Do you want to exit?</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.button, styles.modalButton]}
                onPress={() => setIsExitModalVisible(false)}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.activeButton, styles.modalButton]}
                onPress={handleExit}
              >
                <Text style={styles.buttonText}>Exit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  rightColumn: {
    flex: 1,
    width: "100%",
    minWidth: 0,
    // padding: 20,
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  topIcons: {
    flexDirection: "row",
    gap: 10,
  },
  iconButton: {
    padding: 8,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 20,
  },
  controlsContainer: {
    width: "100%",
    minWidth: 150,
    alignSelf: "stretch",
    alignItems: "flex-start",
  },
  sectionLabel: {
    color: "#a5f3fc", // Cyan tint
    fontSize: 16,
    marginBottom: 10,
    fontWeight: "bold",
    textAlign: "center",
    width: "100%",
  },
  button: {
    backgroundColor: "rgba(139, 92, 246, 0.5)", // Transparent purple
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    marginVertical: 5,
    width: "100%",
    minWidth: 150,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  activeButton: {
    backgroundColor: "#a855f7", // Solid purple
    borderColor: "white",
  },
  buttonText: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
  },
  bottomButton: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
  },
  bottomButtonText: {
    color: "white",
    fontWeight: "bold",
  },
  // Modal Styles
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: "20%",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalView: {
    margin: "10%",
    backgroundColor: "rgba(30, 30, 50, 0.95)",
    borderRadius: 20,
    padding: 35,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.5)",
    width: "80%",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "white",
    marginBottom: 20,
    textAlign: "center",
  },
  modalButtons: {
    flexDirection: "row",
    gap: 15,
    width: "90%",
    justifyContent: "center",
  },
  modalButton: {
    flex: 1,
    marginVertical: 0, // Reset margin from .button
  },
});

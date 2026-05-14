import React from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { Speed } from "../../constants/hamsa";

interface LeftControlsProps {
  speed: Speed;
  setSpeed: (speed: Speed) => void;
  isPlaying: boolean;
  onOpenAbout: () => void;
}

export const LeftControls: React.FC<LeftControlsProps> = ({
  speed,
  setSpeed,
  isPlaying,
  onOpenAbout,
}) => {
  const fadeStyle = useAnimatedStyle(() => {
    return {
      opacity: withTiming(isPlaying ? 0 : 1, { duration: 500 }),
    };
  });

  return (
    <View style={styles.leftColumn}>
      <Animated.View
        style={[styles.logoContainer, fadeStyle]}
        pointerEvents={isPlaying ? "none" : "auto"}
      >
        <Image
          source={require("../../assets/appImages/logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <View>
          <Text style={styles.titleLarge}>HAMSA</Text>
          <Text style={styles.titleSmall}>VIRTUAL HEALING HAND</Text>
        </View>
      </Animated.View>

      <Animated.View
        style={[styles.controlsContainer, fadeStyle]}
        pointerEvents={isPlaying ? "none" : "auto"}
      >
        <Text style={styles.sectionLabel}>SPEED</Text>
        {(["STANDARD", "SLOW", "FAST"] as Speed[]).map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.button, speed === s && styles.activeButton]}
            onPress={() => setSpeed(s)}
            hitSlop={{ bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.7}
          >
            <Text style={styles.buttonText}>{s}</Text>
          </TouchableOpacity>
        ))}
      </Animated.View>

      <Animated.View
        style={fadeStyle}
        pointerEvents={isPlaying ? "none" : "auto"}
      >
        <TouchableOpacity
          style={styles.bottomButton}
          onPress={onOpenAbout}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.7}
        >
          <Text style={styles.bottomButtonText}>ABOUT ℹ️</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  leftColumn: {
    flex: 1,
    width: "100%",
    minWidth: 0,
    // padding: 20,
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 0,
  },
  logo: {
    width: 40,
    height: 40,
    marginRight: 2,
  },
  titleLarge: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#d8b4fe", // Light purple
  },
  titleSmall: {
    fontSize: 10,
    color: "white",
    letterSpacing: 1,
  },
  controlsContainer: {
    width: "100%",
    minWidth: 140,
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
    minWidth: 140,
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
});

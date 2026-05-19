import React, { useEffect, useState } from "react";
import { ImageSourcePropType, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

interface SmoothImageProps {
  source: ImageSourcePropType;
  style?: any;
}

const FADE_DURATION = 300; // Time for one fade (in or out)

export const SmoothImage: React.FC<SmoothImageProps> = ({ source, style }) => {
  // Double buffer sources
  const [sourceA, setSourceA] = useState<ImageSourcePropType>(source);
  const [sourceB, setSourceB] = useState<ImageSourcePropType>(source);

  // Which buffer is currently "active" (the one that just finished fading in)
  const [activeBuffer, setActiveBuffer] = useState<"A" | "B">("A");

  const opacityA = useSharedValue(1);
  const opacityB = useSharedValue(0);

  useEffect(() => {
    // When the prop source changes, we transition to the other buffer
    if (activeBuffer === "A") {
      if (source !== sourceA) {
        setSourceB(source);
        // Fade out A, then fade in B
        opacityA.value = withTiming(0, {
          duration: FADE_DURATION,
          easing: Easing.out(Easing.quad),
        });
        opacityB.value = withDelay(
          FADE_DURATION,
          withTiming(1, {
            duration: FADE_DURATION,
            easing: Easing.in(Easing.quad),
          }),
        );
        setActiveBuffer("B");
      }
    } else {
      if (source !== sourceB) {
        setSourceA(source);
        // Fade out B, then fade in A
        opacityB.value = withTiming(0, {
          duration: FADE_DURATION,
          easing: Easing.out(Easing.quad),
        });
        opacityA.value = withDelay(
          FADE_DURATION,
          withTiming(1, {
            duration: FADE_DURATION,
            easing: Easing.in(Easing.quad),
          }),
        );
        setActiveBuffer("A");
      }
    }
  }, [source, activeBuffer, sourceA, sourceB]);

  const styleA = useAnimatedStyle(() => ({
    opacity: opacityA.value,
    transform: [{ scale: 0.9 + 0.1 * opacityA.value }],
  }));

  const styleB = useAnimatedStyle(() => ({
    opacity: opacityB.value,
    transform: [{ scale: 0.9 + 0.1 * opacityB.value }],
  }));

  return (
    <View style={[styles.container, style]}>
      <Animated.Image
        source={sourceA}
        style={[StyleSheet.absoluteFill, style, styleA]}
        resizeMode="contain"
      />
      <Animated.Image
        source={sourceB}
        style={[StyleSheet.absoluteFill, style, styleB]}
        resizeMode="contain"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
    alignItems: "center",
  },
});

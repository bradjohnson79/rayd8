import { useEffect, useMemo } from "react";
import {
  Easing,
  runOnUI,
  SharedValue,
  useFrameCallback,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { ColorTheme, Speed } from "../constants/hamsa";

// Helper to parse hex to [r, g, b] 0..1
const hexToRgb = (hex: string): [number, number, number] => {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  return [r, g, b];
};

export interface HamsaRenderState {
  time: SharedValue<number>;
  themeBlend: SharedValue<number>;
  pulse: SharedValue<number>;
  activeColors: {
    prev: SharedValue<[number, number, number]>;
    curr: SharedValue<[number, number, number]>;
  };
}

export const useHamsaRenderEngine = (
  currentTheme: ColorTheme | undefined,
  speed: Speed,
  isPlaying: boolean,
): HamsaRenderState => {
  const time = useSharedValue(0);
  const themeBlend = useSharedValue(1);
  const pulse = useSharedValue(0);

  // Colors - Default to white if undefined
  const prevColor = useSharedValue<[number, number, number]>([1, 1, 1]);
  const currColor = useSharedValue<[number, number, number]>([1, 1, 1]);

  // Handle Theme Changes
  useEffect(() => {
    if (!currentTheme) return;

    const newColor = hexToRgb(currentTheme.glyphTint);

    runOnUI(() => {
      // Snapshot current visual state for smooth transition
      const r =
        prevColor.value[0] * (1 - themeBlend.value) +
        currColor.value[0] * themeBlend.value;
      const g =
        prevColor.value[1] * (1 - themeBlend.value) +
        currColor.value[1] * themeBlend.value;
      const b =
        prevColor.value[2] * (1 - themeBlend.value) +
        currColor.value[2] * themeBlend.value;

      prevColor.value = [r, g, b];
      currColor.value = newColor;

      themeBlend.value = 0;
      themeBlend.value = withTiming(1, {
        duration: 900,
        easing: Easing.linear,
      });
    })();
  }, [currentTheme?.name]);

  useFrameCallback((frame) => {
    if (!isPlaying) return;

    const dt = (frame.timeSincePreviousFrame ?? 16) / 1000;

    let speedMultiplier = 1.0;

    if (speed === "FAST") {
      speedMultiplier = (2 * Math.PI) / 5.0;
    } else if (speed === "SLOW") {
      speedMultiplier = (2 * Math.PI) / 30.0;
    } else {
      speedMultiplier = (2 * Math.PI) / 15.0;
    }

    const baseFreq = 1.0;

    time.value += dt * speedMultiplier;

    pulse.value = Math.sin(time.value * baseFreq);
  });

  return useMemo(
    () => ({
      time,
      themeBlend,
      pulse,
      activeColors: {
        prev: prevColor,
        curr: currColor,
      },
    }),
    [time, themeBlend, pulse, prevColor, currColor],
  );
};

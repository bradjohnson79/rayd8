import { Canvas, Fill, Shader, Skia } from "@shopify/react-native-skia";
import React from "react";
import { Platform, StyleSheet, ViewProps } from "react-native";
import Animated, {
    AnimatedProps,
    useDerivedValue,
} from "react-native-reanimated";
import { HamsaRenderState } from "../../hooks/useHamsaRenderEngine";

const SKSL_SHADER = `
uniform float time;
uniform float2 resolution;     // Canvas resolution
uniform float2 handResolution; // Target hand shape resolution
uniform float2 centerPosition; // Absolute center position of the hand
uniform float3 prevColor;
uniform float3 currColor;
uniform float themeBlend;
uniform float pulse;

half4 main(float2 pos) {
  // Use explicit center position
  float2 canvasCenter = centerPosition;

  // Vector from center in pixels
  float2 p = pos - canvasCenter;

  // Normalize using a single dimension to ensure the glow is perfectly round.
  // We use the maximum dimension of the hand as the reference scale.
  float scale = max(handResolution.x, handResolution.y);
  float dist = length(p) / scale;

  // ─────────────────────────────────────────────
  // Shader-driven breathing pulse (0 → 0.65 → 0)
  // ─────────────────────────────────────────────
 float breath = pulse;

// Base radius + breathing expansion
float radius = 0.40 + 0.2 * breath;

  // Soft glow edge
  // Lowered start to 0.15 to ensure soft edge even at min radius (0.35)
  float alpha = 1.0 - smoothstep(0.1, radius, dist);

  // Theme color blend
  vec3 baseColor = mix(prevColor, currColor, themeBlend);

  float t = time;

  // Fluid / breathing noise
  // Animate noise with 't' so it flows with the breathing cycle
  float noise = sin(dist * 12.0 - t) * 0.5 + 0.5;


  // Bright fluid mix
 vec3 fluidColor = mix(baseColor, vec3(1.0), noise * 0.15);

  return half4(fluidColor * alpha, alpha);
}
`;

const runtimeEffect =
  Platform.OS !== "web" ? Skia.RuntimeEffect.Make(SKSL_SHADER) : null;

interface HandOutlineGlowProps extends AnimatedProps<ViewProps> {
  renderState: HamsaRenderState;
  width: number;
  height: number;
  handWidth?: number;
  handHeight?: number;
  handX?: number;
  handY?: number;
}

export const HandOutlineGlow: React.FC<HandOutlineGlowProps> = ({
  renderState,
  width,
  height,
  handWidth,
  handHeight,
  handX,
  handY,
  style,
  ...props
}) => {
  const uniforms = useDerivedValue(() => {
    const cx =
      handX !== undefined && handWidth !== undefined
        ? handX + handWidth / 2
        : width / 2;
    const cy =
      handY !== undefined && handHeight !== undefined
        ? handY + handHeight / 2
        : height / 2;

    return {
      time: renderState.time.value,
      resolution: [width, height],
      handResolution: [handWidth ?? width, handHeight ?? height],
      centerPosition: [cx, cy],
      prevColor: renderState.activeColors.prev.value,
      currColor: renderState.activeColors.curr.value,
      themeBlend: renderState.themeBlend.value,
      pulse: renderState.pulse.value,
    };
  });

  if (!runtimeEffect) return null;

  return (
    <Animated.View style={[styles.container, style]} {...props}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Fill>
          <Shader source={runtimeEffect!} uniforms={uniforms} />
        </Fill>
      </Canvas>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: -1, // Ensure it sits behind
  },
});

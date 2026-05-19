import { Canvas, Fill, Shader, Skia } from "@shopify/react-native-skia";
import React, { useEffect } from "react";
import { Platform, StyleSheet, ViewProps } from "react-native";
import Animated, {
  AnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Speed } from "../../constants/hamsa";
import { HamsaRenderState } from "../../hooks/useHamsaRenderEngine";

/* -------------------- SKSL Shader (unchanged) -------------------- */
const SKSL_SHADER = `
uniform float time;
uniform float2 resolution;
uniform float3 prevColor;
uniform float3 currColor;
uniform float themeBlend;
uniform float pulse;
uniform float globalAlpha;

half4 main(float2 pos) {
  float2 uv = pos / resolution;
  float2 center = uv - 0.5;
  center.x *= resolution.x / resolution.y;

  float dist = length(center);
  float radius = 0.35 + 0.2 * pulse;
  float alpha = 1.0 - smoothstep(0.0, radius, dist);

  vec3 baseColor = mix(prevColor, currColor, themeBlend);

  // 👇 lightening
  float lightAmount = 0.10;
  vec3 lightColor = mix(baseColor, vec3(0.5), lightAmount);

  float finalAlpha = alpha * globalAlpha;
  return half4(lightColor * finalAlpha, finalAlpha);
}
`;

const runtimeEffect =
  Platform.OS !== "web" ? Skia.RuntimeEffect.Make(SKSL_SHADER) : null;

/* -------------------- Helpers -------------------- */
// JS helper to parse hex -> [r,g,b] in 0..1 (used on JS thread)
const hexToRgb = (hex: string): [number, number, number] => {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  return [r, g, b];
};

/* -------------------- Component -------------------- */
interface Props extends AnimatedProps<ViewProps> {
  renderState: HamsaRenderState;
  width?: number;
  height?: number;
  glyphColor?: string;
  speed?: Speed;
}

export const GlyphBackground = ({
  style,
  renderState,
  width,
  height,
  glyphColor,
  speed, // kept in props but unused for internal cycling now
  ...props
}: Props) => {
  const size = useSharedValue({ width: width ?? 0, height: height ?? 0 });

  // opacity for container
  const viewAlpha = useSharedValue(1);

  // the animated color value that our worklet will tween between
  // initial value: either glyphColor prop or white
  const initialRgb = glyphColor
    ? hexToRgb(glyphColor)
    : ([1, 1, 1] as [number, number, number]);
  const animatedColor = useSharedValue<[number, number, number]>(initialRgb);

  useEffect(() => {
    if (glyphColor) {
      const rgb = hexToRgb(glyphColor);
      animatedColor.value = withTiming(rgb, { duration: 500 });
    }
  }, [glyphColor, animatedColor]);

  // animated style for container (exposes opacity)
  const animatedStyle = useAnimatedStyle(() => {
    const opacity =
      typeof style === "object" && style && "opacity" in style
        ? ((style as any).opacity ?? 1)
        : 1;
    viewAlpha.value = opacity;
    return { opacity };
  });

  // Provide uniforms to Skia shader.
  const uniforms = useDerivedValue(() => {
    return {
      time: renderState.time.value,
      resolution: [size.value.width, size.value.height],
      prevColor: animatedColor.value,
      currColor: animatedColor.value,
      themeBlend: 0, // no shader-side blend; color is handled by animatedColor tween
      pulse: renderState.pulse.value,
      globalAlpha: viewAlpha.value,
    };
  }, [renderState, animatedColor]);

  if (!runtimeEffect) return null;

  return (
    <Animated.View style={[styles.container, style, animatedStyle]} {...props}>
      <Canvas style={StyleSheet.absoluteFill} onSize={size}>
        <Fill>
          <Shader source={runtimeEffect!} uniforms={uniforms} />
        </Fill>
      </Canvas>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
  },
});

import { Canvas, Fill, Shader, Skia } from "@shopify/react-native-skia";
import React from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import {
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
} from "react-native-reanimated";

const SKSL_SHADER = `
uniform float time;
uniform float2 resolution;

half4 main(float2 pos) {
  float2 uv = pos / resolution;
  float t = time * 0.55;

  float r = sin(uv.x * 3.0 + t) * 0.5 + 0.5;
  float g = sin(uv.y * 2.0 + t * 1.1) * 0.5 + 0.5;
  float b = sin((uv.x + uv.y) * 2.0 + t * 0.9) * 0.5 + 0.5;

  vec3 color = vec3(r, g, b);

  float2 center = uv - 0.5;
  float glow = 1.0 - smoothstep(0.0, 1.1, length(center));
  color *= glow;

  return half4(color, 1.0);
}
`;

const runtimeEffect = Skia.RuntimeEffect.Make(SKSL_SHADER);

interface Props {
  style?: ViewStyle;
  speed?: number;
  children?: React.ReactNode;
  isPlaying?: boolean;
}

export const AuraBackground = ({
  style,
  speed = 1,
  children,
  isPlaying = true,
}: Props) => {
  const time = useSharedValue(0);
  const size = useSharedValue({ width: 1, height: 1 });

  useFrameCallback((frame) => {
    if (!isPlaying) return;
    time.value += ((frame.timeSincePreviousFrame ?? 16) / 1000) * speed;
  });

  const uniforms = useDerivedValue(() => ({
    time: time.value,
    resolution: [size.value.width, size.value.height],
  }));

  return (
    <View style={[styles.container, style]}>
      <Canvas style={StyleSheet.absoluteFill} onSize={size}>
        <Fill>
          <Shader source={runtimeEffect!} uniforms={uniforms} />
        </Fill>
      </Canvas>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1e1e2e" },
});

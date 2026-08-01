import React, { useEffect, useRef } from "react";
import { StyleSheet, ViewProps } from "react-native";
import Animated, {
  AnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Speed } from "../../constants/hamsa";
import { HamsaRenderState } from "../../hooks/useHamsaRenderEngine";
import {
  HAMSA_WEBGL_FRAME_MS,
  shouldRunHamsaWebglLoop,
} from "../../utils/webglRenderLoop";

const hexToRgb = (hex: string): [number, number, number] => {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  return [r, g, b];
};

interface Props extends AnimatedProps<ViewProps> {
  renderState: HamsaRenderState;
  width?: number;
  height?: number;
  glyphColor?: string;
  speed?: Speed;
  isPlaying?: boolean;
}

export const GlyphBackground = ({
  style,
  renderState,
  width,
  height,
  glyphColor,
  speed,
  isPlaying = false,
  ...props
}: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);
  const lastDrawAtRef = useRef(0);
  const isPlayingRef = useRef(isPlaying);
  const drawFrameRef = useRef<((time: number) => void) | null>(null);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const viewAlpha = useSharedValue(1);
  const initialRgb = glyphColor
    ? hexToRgb(glyphColor)
    : ([1, 1, 1] as [number, number, number]);

  const prevColor = useSharedValue<[number, number, number]>(initialRgb);
  const currColor = useSharedValue<[number, number, number]>(initialRgb);
  const themeBlend = useSharedValue(1);

  useEffect(() => {
    if (glyphColor) {
      const newColor = hexToRgb(glyphColor);

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
      themeBlend.value = withTiming(1, { duration: 800 });
    }
  }, [glyphColor]);

  const animatedStyle = useAnimatedStyle(() => {
    const opacity =
      typeof style === "object" && style && "opacity" in style
        ? ((style as any).opacity ?? 1)
        : 1;
    viewAlpha.value = opacity;
    return { opacity };
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      powerPreference: "low-power",
    });
    if (!gl) return;

    const vsSource = `
      attribute vec4 aVertexPosition;
      void main() {
        gl_Position = aVertexPosition;
      }
    `;

    const fsSource = `
      precision mediump float;
      uniform float u_time;
      uniform vec2 u_resolution;
      uniform vec3 u_prevColor;
      uniform vec3 u_currColor;
      uniform float u_themeBlend;
      uniform float u_pulse;
      uniform float u_globalAlpha;

      void main() {
        vec2 uv = gl_FragCoord.xy / u_resolution;
        uv.y = 1.0 - uv.y;

        vec2 center = uv - 0.5;
        center.x *= u_resolution.x / u_resolution.y;

        float dist = length(center);
        float radius = 0.35 + 0.2 * u_pulse;
        float alpha = 1.0 - smoothstep(0.0, radius, dist);

        vec3 baseColor = mix(u_prevColor, u_currColor, u_themeBlend);

        float lightAmount = 0.10;
        vec3 lightColor = mix(baseColor, vec3(0.5), lightAmount);

        float finalAlpha = alpha * u_globalAlpha;
        gl_FragColor = vec4(lightColor * finalAlpha, finalAlpha);
      }
    `;

    const loadShader = (
      glCtx: WebGLRenderingContext,
      type: number,
      source: string,
    ) => {
      const shader = glCtx.createShader(type)!;
      glCtx.shaderSource(shader, source);
      glCtx.compileShader(shader);
      return shader;
    };

    const shaderProgram = gl.createProgram()!;
    gl.attachShader(shaderProgram, loadShader(gl, gl.VERTEX_SHADER, vsSource));
    gl.attachShader(
      shaderProgram,
      loadShader(gl, gl.FRAGMENT_SHADER, fsSource),
    );
    gl.linkProgram(shaderProgram);

    const programInfo = {
      program: shaderProgram,
      attribLocations: {
        vertexPosition: gl.getAttribLocation(shaderProgram, "aVertexPosition"),
      },
      uniformLocations: {
        time: gl.getUniformLocation(shaderProgram, "u_time"),
        resolution: gl.getUniformLocation(shaderProgram, "u_resolution"),
        prevColor: gl.getUniformLocation(shaderProgram, "u_prevColor"),
        currColor: gl.getUniformLocation(shaderProgram, "u_currColor"),
        themeBlend: gl.getUniformLocation(shaderProgram, "u_themeBlend"),
        pulse: gl.getUniformLocation(shaderProgram, "u_pulse"),
        globalAlpha: gl.getUniformLocation(shaderProgram, "u_globalAlpha"),
      },
    };

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    const positions = [-1.0, 1.0, 1.0, 1.0, -1.0, -1.0, 1.0, -1.0];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    const drawOnce = () => {
      const displayWidth = canvas.clientWidth;
      const displayHeight = canvas.clientHeight;
      if (displayWidth === 0 || displayHeight === 0) {
        return;
      }

      if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;
        gl.viewport(0, 0, displayWidth, displayHeight);
      }

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.useProgram(programInfo.program);

      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.vertexAttribPointer(
        programInfo.attribLocations.vertexPosition,
        2,
        gl.FLOAT,
        false,
        0,
        0,
      );
      gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);

      gl.uniform1f(programInfo.uniformLocations.time, renderState.time.value);
      gl.uniform2f(
        programInfo.uniformLocations.resolution,
        canvas.width,
        canvas.height,
      );
      gl.uniform3fv(programInfo.uniformLocations.prevColor, prevColor.value);
      gl.uniform3fv(programInfo.uniformLocations.currColor, currColor.value);
      gl.uniform1f(programInfo.uniformLocations.themeBlend, themeBlend.value);
      gl.uniform1f(programInfo.uniformLocations.pulse, renderState.pulse.value);
      gl.uniform1f(programInfo.uniformLocations.globalAlpha, viewAlpha.value);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    const stopLoop = () => {
      if (requestRef.current != null) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      }
    };

    const render = (time: number) => {
      requestRef.current = null;

      if (!shouldRunHamsaWebglLoop(isPlayingRef.current)) {
        drawOnce();
        return;
      }

      if (time - lastDrawAtRef.current >= HAMSA_WEBGL_FRAME_MS) {
        drawOnce();
        lastDrawAtRef.current = time;
      }

      requestRef.current = requestAnimationFrame(render);
    };

    drawFrameRef.current = render;

    const ensureLoop = () => {
      stopLoop();
      requestRef.current = requestAnimationFrame(render);
    };

    ensureLoop();
    document.addEventListener("visibilitychange", ensureLoop);

    return () => {
      document.removeEventListener("visibilitychange", ensureLoop);
      stopLoop();
      const loseContext = gl.getExtension("WEBGL_lose_context") as
        | { loseContext: () => void }
        | null;
      loseContext?.loseContext();
    };
  }, [renderState, prevColor, currColor, themeBlend, viewAlpha]);

  useEffect(() => {
    if (drawFrameRef.current) {
      if (requestRef.current != null) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      }
      requestRef.current = requestAnimationFrame(drawFrameRef.current);
    }
  }, [isPlaying]);

  return (
    <Animated.View style={[styles.container, style, animatedStyle]} {...props}>
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
        }}
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
  },
});

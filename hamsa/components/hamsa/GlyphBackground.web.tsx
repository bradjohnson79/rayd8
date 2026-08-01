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
  getHamsaFrameMs,
  shouldRunHamsaWebglLoop,
} from "../../utils/webglRenderLoop";
import {
  installHamsaPerfProbe,
  markHamsaDraw,
  setHamsaSurfaceContext,
  setHamsaSurfaceLoop,
} from "../../utils/hamsaPerfProbe";

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
  glyphColor,
  isPlaying = false,
  ...props
}: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);
  const lastDrawAtRef = useRef(0);
  const isPlayingRef = useRef(isPlaying);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<any>(null);

  useEffect(() => {
    installHamsaPerfProbe();
  }, []);

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

    const stopLoop = () => {
      if (requestRef.current != null) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      }
      setHamsaSurfaceLoop("glyph", false);
    };

    const loseContext = () => {
      stopLoop();
      const gl = glRef.current;
      if (gl) {
        const ext = gl.getExtension("WEBGL_lose_context") as
          | { loseContext: () => void }
          | null;
        ext?.loseContext();
      }
      glRef.current = null;
      programRef.current = null;
      setHamsaSurfaceContext("glyph", false);
    };

    const ensureGl = () => {
      if (glRef.current && programRef.current) return true;
      if (!isPlayingRef.current) return false;

      const gl = canvas.getContext("webgl", {
        alpha: true,
        antialias: false,
        powerPreference: "low-power",
      });
      if (!gl) return false;

      const vsSource = `
        attribute vec4 aVertexPosition;
        void main() { gl_Position = aVertexPosition; }
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
          vec3 lightColor = mix(baseColor, vec3(0.5), 0.10);
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
      const positionBuffer = gl.createBuffer()!;
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1.0, 1.0, 1.0, 1.0, -1.0, -1.0, 1.0, -1.0]),
        gl.STATIC_DRAW,
      );

      glRef.current = gl;
      programRef.current = {
        program: shaderProgram,
        vertexPosition: gl.getAttribLocation(shaderProgram, "aVertexPosition"),
        time: gl.getUniformLocation(shaderProgram, "u_time"),
        resolution: gl.getUniformLocation(shaderProgram, "u_resolution"),
        prevColor: gl.getUniformLocation(shaderProgram, "u_prevColor"),
        currColor: gl.getUniformLocation(shaderProgram, "u_currColor"),
        themeBlend: gl.getUniformLocation(shaderProgram, "u_themeBlend"),
        pulse: gl.getUniformLocation(shaderProgram, "u_pulse"),
        globalAlpha: gl.getUniformLocation(shaderProgram, "u_globalAlpha"),
        positionBuffer,
      };
      setHamsaSurfaceContext("glyph", true);
      return true;
    };

    const drawOnce = () => {
      if (!ensureGl()) return;
      const gl = glRef.current!;
      const p = programRef.current!;
      const displayWidth = canvas.clientWidth;
      const displayHeight = canvas.clientHeight;
      if (displayWidth === 0 || displayHeight === 0) return;
      if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;
        gl.viewport(0, 0, displayWidth, displayHeight);
      }
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(p.program);
      gl.bindBuffer(gl.ARRAY_BUFFER, p.positionBuffer);
      gl.vertexAttribPointer(p.vertexPosition, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(p.vertexPosition);
      gl.uniform1f(p.time, renderState.time.value);
      gl.uniform2f(p.resolution, canvas.width, canvas.height);
      gl.uniform3fv(p.prevColor, prevColor.value);
      gl.uniform3fv(p.currColor, currColor.value);
      gl.uniform1f(p.themeBlend, themeBlend.value);
      gl.uniform1f(p.pulse, renderState.pulse.value);
      gl.uniform1f(p.globalAlpha, viewAlpha.value);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      markHamsaDraw("glyph");
    };

    const render = (time: number) => {
      requestRef.current = null;
      if (!shouldRunHamsaWebglLoop(isPlayingRef.current)) {
        if (glRef.current) drawOnce();
        setHamsaSurfaceLoop("glyph", false);
        return;
      }
      if (time - lastDrawAtRef.current >= getHamsaFrameMs()) {
        drawOnce();
        lastDrawAtRef.current = time;
      }
      setHamsaSurfaceLoop("glyph", true);
      requestRef.current = requestAnimationFrame(render);
    };

    const ensureLoop = () => {
      stopLoop();
      if (!isPlayingRef.current && !glRef.current) return;
      requestRef.current = requestAnimationFrame(render);
    };

    if (isPlaying) {
      ensureLoop();
    } else if (glRef.current) {
      drawOnce();
      loseContext();
    }

    document.addEventListener("visibilitychange", ensureLoop);
    return () => {
      document.removeEventListener("visibilitychange", ensureLoop);
      loseContext();
    };
  }, [isPlaying, renderState, prevColor, currColor, themeBlend, viewAlpha]);

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
  container: { overflow: "hidden" },
});

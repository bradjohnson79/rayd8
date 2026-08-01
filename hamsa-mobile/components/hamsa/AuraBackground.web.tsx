import React, { useEffect, useRef } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import {
  getHamsaFrameMs,
  shouldRunHamsaWebglLoop,
} from "../../utils/webglRenderLoop";
import {
  getHamsaRenderScale,
  installHamsaPerfProbe,
  markHamsaDraw,
  setHamsaPlaying,
  setHamsaSurfaceContext,
  setHamsaSurfaceLoop,
} from "../../utils/hamsaPerfProbe";

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
  isPlaying = false,
}: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());
  const lastDrawAtRef = useRef<number>(0);
  const elapsedTimeRef = useRef<number>(0);
  const isPlayingRef = useRef(isPlaying);
  const speedRef = useRef(speed);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programInfoRef = useRef<{
    program: WebGLProgram;
    attribLocations: { vertexPosition: number };
    uniformLocations: {
      time: WebGLUniformLocation | null;
      resolution: WebGLUniformLocation | null;
    };
    positionBuffer: WebGLBuffer;
  } | null>(null);

  useEffect(() => {
    installHamsaPerfProbe();
  }, []);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
    speedRef.current = speed;
    setHamsaPlaying(isPlaying);
  }, [isPlaying, speed]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const stopLoop = () => {
      if (requestRef.current != null) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      }
      setHamsaSurfaceLoop("aura", false);
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
      programInfoRef.current = null;
      setHamsaSurfaceContext("aura", false);
    };

    const ensureGl = () => {
      if (glRef.current && programInfoRef.current) {
        return true;
      }
      if (!isPlayingRef.current) {
        return false;
      }

      const gl = canvas.getContext("webgl", {
        alpha: false,
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
        void main() {
          vec2 uv = gl_FragCoord.xy / u_resolution;
          float t = u_time * 0.55;
          float r = sin(uv.x * 3.0 + t) * 0.5 + 0.5;
          float g = sin(uv.y * 2.0 + t * 1.1) * 0.5 + 0.5;
          float b = sin((uv.x + uv.y) * 2.0 + t * 0.9) * 0.5 + 0.5;
          vec3 color = vec3(r, g, b);
          vec2 center = uv - 0.5;
          float glow = 1.0 - smoothstep(0.0, 1.1, length(center));
          color *= glow;
          gl_FragColor = vec4(color, 1.0);
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
      programInfoRef.current = {
        program: shaderProgram,
        attribLocations: {
          vertexPosition: gl.getAttribLocation(shaderProgram, "aVertexPosition"),
        },
        uniformLocations: {
          time: gl.getUniformLocation(shaderProgram, "u_time"),
          resolution: gl.getUniformLocation(shaderProgram, "u_resolution"),
        },
        positionBuffer,
      };
      setHamsaSurfaceContext("aura", true);
      return true;
    };

    const drawOnce = (time: number) => {
      if (!ensureGl()) return;
      const gl = glRef.current!;
      const programInfo = programInfoRef.current!;

      const dt = (time - lastTimeRef.current) / 1000;
      lastTimeRef.current = time;
      if (isPlayingRef.current) {
        elapsedTimeRef.current += dt * speedRef.current;
      }

      const scale = Math.max(0.5, Math.min(1.5, getHamsaRenderScale()));
      const width = Math.max(1, Math.floor(canvas.clientWidth * scale));
      const height = Math.max(1, Math.floor(canvas.clientHeight * scale));
      if (canvas.clientWidth === 0 || canvas.clientHeight === 0) return;

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }

      gl.clearColor(0.0, 0.0, 0.0, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(programInfo.program);
      gl.bindBuffer(gl.ARRAY_BUFFER, programInfo.positionBuffer);
      gl.vertexAttribPointer(
        programInfo.attribLocations.vertexPosition,
        2,
        gl.FLOAT,
        false,
        0,
        0,
      );
      gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);
      gl.uniform1f(programInfo.uniformLocations.time, elapsedTimeRef.current);
      gl.uniform2f(
        programInfo.uniformLocations.resolution,
        canvas.width,
        canvas.height,
      );
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      lastDrawAtRef.current = time;
      markHamsaDraw("aura");
    };

    const render = (time: number) => {
      requestRef.current = null;
      if (!shouldRunHamsaWebglLoop(isPlayingRef.current)) {
        if (glRef.current) {
          drawOnce(time);
        }
        setHamsaSurfaceLoop("aura", false);
        return;
      }

      if (time - lastDrawAtRef.current >= getHamsaFrameMs()) {
        drawOnce(time);
      }

      setHamsaSurfaceLoop("aura", true);
      requestRef.current = requestAnimationFrame(render);
    };

    const ensureLoop = () => {
      stopLoop();
      if (!isPlayingRef.current && !glRef.current) {
        return;
      }
      lastTimeRef.current = performance.now();
      requestRef.current = requestAnimationFrame(render);
    };

    const onVisibility = () => ensureLoop();

    if (isPlaying) {
      ensureLoop();
    } else if (glRef.current) {
      // Bounded terminal draw, then dispose context on stop.
      drawOnce(performance.now());
      loseContext();
    }

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      loseContext();
    };
  }, [isPlaying]);

  return (
    <View style={[styles.container, style]}>
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
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1e1e2e" },
});

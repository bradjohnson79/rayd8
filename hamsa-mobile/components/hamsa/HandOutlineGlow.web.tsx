import React, { useEffect, useRef } from "react";
import { StyleSheet, ViewProps } from "react-native";
import { AnimatedProps } from "react-native-reanimated";
import { HamsaRenderState } from "../../hooks/useHamsaRenderEngine";
import {
  getHamsaFrameMs,
  shouldRunHamsaWebglLoop,
} from "../../utils/webglRenderLoop";
import {
  getHamsaRenderScale,
  installHamsaPerfProbe,
  markHamsaDraw,
  setHamsaSurfaceContext,
  setHamsaSurfaceLoop,
} from "../../utils/hamsaPerfProbe";

interface HandOutlineGlowProps extends AnimatedProps<ViewProps> {
  renderState: HamsaRenderState;
  width: number;
  height: number;
  handWidth?: number;
  handHeight?: number;
  handX?: number;
  handY?: number;
  isPlaying?: boolean;
}

export const HandOutlineGlow: React.FC<HandOutlineGlowProps> = ({
  renderState,
  handWidth,
  handHeight,
  handX,
  handY,
  isPlaying = false,
  style,
  ...props
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);
  const lastDrawAtRef = useRef(0);
  const isPlayingRef = useRef(isPlaying);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<any>(null);

  const hWidth = handWidth ?? 0;
  const hHeight = handHeight ?? 0;

  useEffect(() => {
    installHamsaPerfProbe();
  }, []);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const stopLoop = () => {
      if (requestRef.current != null) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      }
      setHamsaSurfaceLoop("hand", false);
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
      setHamsaSurfaceContext("hand", false);
    };

    const ensureGl = () => {
      if (glRef.current && programRef.current) return true;
      if (!isPlayingRef.current) return false;

      const gl = canvas.getContext("webgl", {
        alpha: true,
        premultipliedAlpha: false,
        antialias: false,
        powerPreference: "low-power",
      });
      if (!gl) return false;
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      const vsSource = `
        attribute vec4 aVertexPosition;
        void main() { gl_Position = aVertexPosition; }
      `;
      const fsSource = `
        precision mediump float;
        uniform float u_time;
        uniform vec2 u_resolution;
        uniform vec2 u_handResolution;
        uniform vec2 u_centerPosition;
        uniform vec3 u_prevColor;
        uniform vec3 u_currColor;
        uniform float u_themeBlend;
        uniform float u_pulse;
        void main() {
          vec2 pos = gl_FragCoord.xy;
          vec2 skiaPos = vec2(pos.x, u_resolution.y - pos.y);
          vec2 p = skiaPos - u_centerPosition;
          float scale = max(u_handResolution.x, u_handResolution.y);
          if (scale <= 0.0) scale = min(u_resolution.x, u_resolution.y) * 0.5;
          float dist = length(p) / scale;
          float radius = 0.40 + 0.2 * u_pulse;
          float alpha = 1.0 - smoothstep(0.1, radius, dist);
          vec3 baseColor = mix(u_prevColor, u_currColor, u_themeBlend);
          float noise = sin(dist * 20.0 - u_time * 3.0) * 0.5 + 0.5;
          vec3 fluidColor = mix(baseColor, vec3(0.4), noise * 0.1);
          gl_FragColor = vec4(fluidColor, alpha * 0.85);
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
        handResolution: gl.getUniformLocation(shaderProgram, "u_handResolution"),
        centerPosition: gl.getUniformLocation(shaderProgram, "u_centerPosition"),
        prevColor: gl.getUniformLocation(shaderProgram, "u_prevColor"),
        currColor: gl.getUniformLocation(shaderProgram, "u_currColor"),
        themeBlend: gl.getUniformLocation(shaderProgram, "u_themeBlend"),
        pulse: gl.getUniformLocation(shaderProgram, "u_pulse"),
        positionBuffer,
      };
      setHamsaSurfaceContext("hand", true);
      return true;
    };

    const drawOnce = () => {
      if (!ensureGl()) return;
      const gl = glRef.current!;
      const p = programRef.current!;
      const scale = Math.max(0.5, Math.min(1.5, getHamsaRenderScale()));
      const displayWidth = Math.max(1, Math.floor(canvas.clientWidth * scale));
      const displayHeight = Math.max(1, Math.floor(canvas.clientHeight * scale));
      if (canvas.clientWidth === 0 || canvas.clientHeight === 0) return;
      if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;
        gl.viewport(0, 0, displayWidth, displayHeight);
      }
      const currentCx =
        handX !== undefined && handWidth !== undefined
          ? handX + handWidth / 2
          : canvas.width / 2;
      const currentCy =
        handY !== undefined && handHeight !== undefined
          ? handY + handHeight / 2
          : canvas.height / 2;

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(p.program);
      gl.bindBuffer(gl.ARRAY_BUFFER, p.positionBuffer);
      gl.vertexAttribPointer(p.vertexPosition, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(p.vertexPosition);
      gl.uniform1f(p.time, renderState.time.value);
      gl.uniform2f(p.resolution, canvas.width, canvas.height);
      gl.uniform2f(p.handResolution, hWidth || 0, hHeight || 0);
      gl.uniform2f(p.centerPosition, currentCx, currentCy);
      gl.uniform3fv(p.prevColor, renderState.activeColors.prev.value);
      gl.uniform3fv(p.currColor, renderState.activeColors.curr.value);
      gl.uniform1f(p.themeBlend, renderState.themeBlend.value);
      gl.uniform1f(p.pulse, renderState.pulse.value);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      markHamsaDraw("hand");
    };

    const render = (time: number) => {
      requestRef.current = null;
      if (!shouldRunHamsaWebglLoop(isPlayingRef.current)) {
        if (glRef.current) drawOnce();
        setHamsaSurfaceLoop("hand", false);
        return;
      }
      if (time - lastDrawAtRef.current >= getHamsaFrameMs()) {
        drawOnce();
        lastDrawAtRef.current = time;
      }
      setHamsaSurfaceLoop("hand", true);
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
  }, [
    isPlaying,
    renderState,
    hWidth,
    hHeight,
    handX,
    handY,
    handWidth,
    handHeight,
  ]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        ...(StyleSheet.flatten(style) as any),
      }}
      {...(props as any)}
    />
  );
};

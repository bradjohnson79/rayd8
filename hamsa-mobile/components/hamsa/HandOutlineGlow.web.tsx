import React, { useEffect, useRef } from "react";
import { StyleSheet, ViewProps } from "react-native";
import { AnimatedProps } from "react-native-reanimated";
import { HamsaRenderState } from "../../hooks/useHamsaRenderEngine";
import {
  HAMSA_WEBGL_FRAME_MS,
  shouldRunHamsaWebglLoop,
} from "../../utils/webglRenderLoop";

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
  width,
  height,
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
  const drawFrameRef = useRef<((time: number) => void) | null>(null);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const cx =
    handX !== undefined && handWidth !== undefined
      ? handX + handWidth / 2
      : width / 2;
  const cy =
    handY !== undefined && handHeight !== undefined
      ? handY + handHeight / 2
      : height / 2;

  const hWidth = handWidth ?? width;
  const hHeight = handHeight ?? height;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", {
      alpha: true,
      premultipliedAlpha: false,
      antialias: false,
      powerPreference: "low-power",
    });
    if (!gl) return;

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

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

        float breath = u_pulse;
        float radius = 0.40 + 0.2 * breath;

        float alpha = 1.0 - smoothstep(0.1, radius, dist);

        vec3 baseColor = mix(u_prevColor, u_currColor, u_themeBlend);
        float t = u_time;
        float noise = sin(dist * 20.0 - t * 3.0) * 0.5 + 0.5;

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

    const programInfo = {
      program: shaderProgram,
      attribLocations: {
        vertexPosition: gl.getAttribLocation(shaderProgram, "aVertexPosition"),
      },
      uniformLocations: {
        time: gl.getUniformLocation(shaderProgram, "u_time"),
        resolution: gl.getUniformLocation(shaderProgram, "u_resolution"),
        handResolution: gl.getUniformLocation(
          shaderProgram,
          "u_handResolution",
        ),
        centerPosition: gl.getUniformLocation(
          shaderProgram,
          "u_centerPosition",
        ),
        prevColor: gl.getUniformLocation(shaderProgram, "u_prevColor"),
        currColor: gl.getUniformLocation(shaderProgram, "u_currColor"),
        themeBlend: gl.getUniformLocation(shaderProgram, "u_themeBlend"),
        pulse: gl.getUniformLocation(shaderProgram, "u_pulse"),
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
      gl.uniform2f(
        programInfo.uniformLocations.handResolution,
        hWidth || 0,
        hHeight || 0,
      );
      gl.uniform2f(
        programInfo.uniformLocations.centerPosition,
        currentCx,
        currentCy,
      );
      gl.uniform3fv(
        programInfo.uniformLocations.prevColor,
        renderState.activeColors.prev.value,
      );
      gl.uniform3fv(
        programInfo.uniformLocations.currColor,
        renderState.activeColors.curr.value,
      );
      gl.uniform1f(
        programInfo.uniformLocations.themeBlend,
        renderState.themeBlend.value,
      );
      gl.uniform1f(programInfo.uniformLocations.pulse, renderState.pulse.value);

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
  }, [renderState, hWidth, hHeight, cx, cy, handX, handY, handWidth, handHeight]);

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

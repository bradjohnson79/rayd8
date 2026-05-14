/**
 * WebGL Implementation of Hamsa Hand Outline Glow
 * Translated from SKSL (React Native Skia) to GLSL (WebGL)
 */

const canvas = document.getElementById("glCanvas");
const gl = canvas.getContext("webgl");

if (!gl) {
  alert("WebGL not supported");
}

// Vertex Shader
const vsSource = `
    attribute vec4 aVertexPosition;
    void main() {
        gl_Position = aVertexPosition;
    }
`;

// Fragment Shader (Translated from SKSL)
const fsSource = `
    precision highp float;

    uniform float u_time;
    uniform vec2 u_resolution;
    uniform vec2 u_handResolution;
    uniform vec2 u_centerPosition;
    uniform vec3 u_prevColor;
    uniform vec3 u_currColor;
    uniform float u_themeBlend;
    uniform float u_pulse;

    void main() {
        // gl_FragCoord is in pixel coordinates, (0,0) at bottom-left
        vec2 pos = gl_FragCoord.xy;
        
        // In Skia, pos is (0,0) at top-left. 
        // We flip Y to match Skia's coordinate system if u_centerPosition expects top-left.
        vec2 skiaPos = vec2(pos.x, u_resolution.y - pos.y);

        // Vector from center in pixels
        vec2 p = skiaPos - u_centerPosition;

        // Normalize using a single dimension to ensure the glow is perfectly round.
        float scale = max(u_handResolution.x, u_handResolution.y);
        float dist = length(p) / scale;

        // Base radius + breathing expansion
        float radius = 0.40 + 0.2 * u_pulse;

        // Soft glow edge
        float alpha = 1.0 - smoothstep(0.1, radius, dist);

        // Theme color blend
        vec3 baseColor = mix(u_prevColor, u_currColor, u_themeBlend);

        // Fluid / breathing noise
        float noise = sin(dist * 12.0 - u_time) * 0.5 + 0.5;

        // Bright fluid mix
        vec3 fluidColor = mix(baseColor, vec3(1.0), noise * 0.15);

        // Premultiplied alpha output (standard for many graphics engines)
        gl_FragColor = vec4(fluidColor * alpha, alpha);
    }
`;

function initShaderProgram(gl, vsSource, fsSource) {
  const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
  const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

  const shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    console.error(
      "Unable to initialize the shader program: " +
        gl.getProgramInfoLog(shaderProgram),
    );
    return null;
  }

  return shaderProgram;
}

function loadShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(
      "An error occurred compiling the shaders: " + gl.getShaderInfoLog(shader),
    );
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

const shaderProgram = initShaderProgram(gl, vsSource, fsSource);

const programInfo = {
  program: shaderProgram,
  attribLocations: {
    vertexPosition: gl.getAttribLocation(shaderProgram, "aVertexPosition"),
  },
  uniformLocations: {
    time: gl.getUniformLocation(shaderProgram, "u_time"),
    resolution: gl.getUniformLocation(shaderProgram, "u_resolution"),
    handResolution: gl.getUniformLocation(shaderProgram, "u_handResolution"),
    centerPosition: gl.getUniformLocation(shaderProgram, "u_centerPosition"),
    prevColor: gl.getUniformLocation(shaderProgram, "u_prevColor"),
    currColor: gl.getUniformLocation(shaderProgram, "u_currColor"),
    themeBlend: gl.getUniformLocation(shaderProgram, "u_themeBlend"),
    pulse: gl.getUniformLocation(shaderProgram, "u_pulse"),
  },
};

const buffers = initBuffers(gl);

function initBuffers(gl) {
  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

  // Full screen quad
  const positions = [-1.0, 1.0, 1.0, 1.0, -1.0, -1.0, 1.0, -1.0];

  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

  return {
    position: positionBuffer,
  };
}

function resizeCanvasToDisplaySize(canvas) {
  const displayWidth = canvas.clientWidth;
  const displayHeight = canvas.clientHeight;

  if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
    canvas.width = displayWidth;
    canvas.height = displayHeight;
    return true;
  }
  return false;
}

function render(now) {
  now *= 0.001; // convert to seconds

  resizeCanvasToDisplaySize(gl.canvas);
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

  gl.clearColor(0.0, 0.0, 0.0, 0.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.useProgram(programInfo.program);

  // Vertex positions
  {
    const numComponents = 2;
    const type = gl.FLOAT;
    const normalize = false;
    const stride = 0;
    const offset = 0;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
    gl.vertexAttribPointer(
      programInfo.attribLocations.vertexPosition,
      numComponents,
      type,
      normalize,
      stride,
      offset,
    );
    gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);
  }

  // Uniforms
  gl.uniform1f(programInfo.uniformLocations.time, now);
  gl.uniform2f(
    programInfo.uniformLocations.resolution,
    gl.canvas.width,
    gl.canvas.height,
  );

  // Simulating the hand resolution and center position
  const handSize = Math.min(gl.canvas.width, gl.canvas.height) * 0.6;
  gl.uniform2f(programInfo.uniformLocations.handResolution, handSize, handSize);
  gl.uniform2f(
    programInfo.uniformLocations.centerPosition,
    gl.canvas.width / 2,
    gl.canvas.height / 2,
  );

  // Pulse simulation (sin wave)
  const pulseValue = Math.sin(now * 2.0) * 0.5 + 0.5;
  gl.uniform1f(programInfo.uniformLocations.pulse, pulseValue);

  // Color simulation (cyan to magenta)
  gl.uniform3f(programInfo.uniformLocations.prevColor, 0.0, 0.8, 1.0); // Cyan
  gl.uniform3f(programInfo.uniformLocations.currColor, 1.0, 0.2, 0.8); // Magenta

  // Blend simulation (oscillating)
  const blend = Math.sin(now * 0.5) * 0.5 + 0.5;
  gl.uniform1f(programInfo.uniformLocations.themeBlend, blend);

  {
    const offset = 0;
    const vertexCount = 4;
    gl.drawArrays(gl.TRIANGLE_STRIP, offset, vertexCount);
  }

  requestAnimationFrame(render);
}

requestAnimationFrame(render);

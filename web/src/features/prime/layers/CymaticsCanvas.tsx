import { useEffect, useRef } from 'react'
import type { PrimePrescription } from '../../../../../api/src/modules/prime/core/prescription.ts'

const VERTEX = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`

const FRAGMENT = `
precision mediump float;
uniform vec2 u_resolution;
uniform float u_n;
uniform float u_m;
uniform float u_opacity;
uniform float u_circle;
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float field;
  if (u_circle > 0.5) {
    vec2 centered = uv - vec2(0.5);
    float radius = length(centered);
    float angle = atan(centered.y, centered.x);
    field = abs(sin(u_n * angle) * sin(u_m * 12.0 * radius));
  } else {
    float a = sin(u_n * 3.14159 * uv.x) * sin(u_m * 3.14159 * uv.y);
    float b = sin(u_m * 3.14159 * uv.x) * sin(u_n * 3.14159 * uv.y);
    field = abs(a + b);
  }
  float line = smoothstep(0.12, 0.0, field);
  gl_FragColor = vec4(0.72, 0.88, 1.0, line * u_opacity);
}
`

function drawFallback(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  geometry: 'square' | 'circle',
  opacity: number,
) {
  context.clearRect(0, 0, width, height)
  const step = 8
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const u = x / width
      const v = y / height
      const value =
        geometry === 'circle'
          ? Math.abs(Math.sin(12 * Math.hypot(u - 0.5, v - 0.5)))
          : Math.abs(Math.sin(3 * Math.PI * u) * Math.sin(4 * Math.PI * v) + Math.sin(4 * Math.PI * u) * Math.sin(3 * Math.PI * v))
      if (value < 0.15) {
        context.fillStyle = `rgba(180, 220, 255, ${opacity})`
        context.fillRect(x, y, step - 1, step - 1)
      }
    }
  }
}

export function CymaticsCanvas({ prescription }: { prescription: PrimePrescription }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !prescription.cymatics.enabled) {
      return
    }
    const rect = canvas.getBoundingClientRect()
    canvas.width = Math.max(1, Math.floor(rect.width))
    canvas.height = Math.max(1, Math.floor(rect.height))
    const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true })
    if (!gl) {
      const context = canvas.getContext('2d')
      if (context) {
        drawFallback(context, canvas.width, canvas.height, prescription.cymatics.geometry, prescription.cymatics.opacity)
      }
      return
    }

    const vertex = gl.createShader(gl.VERTEX_SHADER)
    const fragment = gl.createShader(gl.FRAGMENT_SHADER)
    const program = gl.createProgram()
    if (!vertex || !fragment || !program) {
      return
    }
    gl.shaderSource(vertex, VERTEX)
    gl.shaderSource(fragment, FRAGMENT)
    gl.compileShader(vertex)
    gl.compileShader(fragment)
    gl.attachShader(program, vertex)
    gl.attachShader(program, fragment)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const context = canvas.getContext('2d')
      if (context) {
        drawFallback(context, canvas.width, canvas.height, prescription.cymatics.geometry, prescription.cymatics.opacity)
      }
      return
    }
    gl.useProgram(program)
    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const location = gl.getAttribLocation(program, 'a_position')
    gl.enableVertexAttribArray(location)
    gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0)
    gl.uniform2f(gl.getUniformLocation(program, 'u_resolution'), canvas.width, canvas.height)
    gl.uniform1f(gl.getUniformLocation(program, 'u_n'), prescription.cymatics.formula === 'demo-rise' ? 5 : 3)
    gl.uniform1f(gl.getUniformLocation(program, 'u_m'), prescription.cymatics.formula === 'demo-warm' ? 2 : 4)
    gl.uniform1f(gl.getUniformLocation(program, 'u_opacity'), prescription.cymatics.opacity)
    gl.uniform1f(gl.getUniformLocation(program, 'u_circle'), prescription.cymatics.geometry === 'circle' ? 1 : 0)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

    return () => {
      gl.deleteProgram(program)
      gl.deleteShader(vertex)
      gl.deleteShader(fragment)
      gl.deleteBuffer(buffer)
    }
  }, [prescription])

  if (!prescription.cymatics.enabled) {
    return null
  }

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" data-testid="prime-cymatics" />
}

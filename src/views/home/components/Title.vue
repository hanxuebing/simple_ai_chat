<script setup>
const props = defineProps({
  text: {
    type: String,
    required: true,
  },
  tag: {
    type: String,
    default: 'p',
  },
})

const canvasRef = ref(null)
const wrapRef = ref(null)

let gl = null
let textCanvas = null
let textCtx = null
let program = null
let texture = null
let animationId = 0
let animationStart = 0
let cycleSeed = Math.random() * 1000
let width = 1
let height = 1
let dpr = 1

const CHAR_INTERVAL = 0.085
const CHAR_LOCK_DELAY = 0.055
const BLOCK_PHASE = 0.18
const STABILIZE_TIME = 0.9
const IDLE_GLITCH_INTERVAL = 1.75

const pointer = reactive({
  x: 0.5,
  y: 0.5,
  tx: 0.5,
  ty: 0.5,
  inside: false,
  power: 0,
})

const trail = reactive(
  Array.from({ length: 6 }, () => ({
    x: 0.5,
    y: 0.5,
    a: 0,
  })),
)

const clickWave = reactive({
  x: 0.5,
  y: 0.5,
  startAt: -10,
  power: 0,
})

let uniforms = null
let onMove = null
let onEnter = null
let onLeave = null
let onClick = null
let onResize = null

const vertexShaderSource = `
  attribute vec2 a_position;
  attribute vec2 a_uv;
  varying vec2 v_uv;

  void main() {
    v_uv = a_uv;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`

const fragmentShaderSource = `
  precision mediump float;

  varying vec2 v_uv;
  uniform sampler2D u_text;
  uniform vec2 u_resolution;
  uniform float u_time;
  uniform float u_globalGlitch;
  uniform float u_idlePulse;
  uniform float u_seed;

  uniform vec2 u_pointer;
  uniform float u_pointerPower;

  uniform vec3 u_trail0;
  uniform vec3 u_trail1;
  uniform vec3 u_trail2;
  uniform vec3 u_trail3;
  uniform vec3 u_trail4;
  uniform vec3 u_trail5;

  uniform vec2 u_clickPos;
  uniform float u_clickAge;
  uniform float u_clickPower;

  float rand(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123 + u_seed);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);

    float a = rand(i);
    float b = rand(i + vec2(1.0, 0.0));
    float c = rand(i + vec2(0.0, 1.0));
    float d = rand(i + vec2(1.0, 1.0));

    vec2 u = f * f * (3.0 - 2.0 * f);

    return mix(a, b, u.x)
         + (c - a) * u.y * (1.0 - u.x)
         + (d - b) * u.x * u.y;
  }

  float trailField(vec2 uv, vec3 p, float radius) {
    float d = length(uv - p.xy);
    return smoothstep(radius, 0.0, d) * p.z;
  }

  void main() {
    vec2 uv = v_uv;

    vec2 toPointer = uv - u_pointer;
    float distToPointer = length(toPointer);
    float pointerField = smoothstep(0.30, 0.0, distToPointer) * u_pointerPower;
    float pointerRing = smoothstep(0.065, 0.0, abs(distToPointer - 0.11)) * u_pointerPower;
    vec2 dir = distToPointer > 0.0001 ? normalize(toPointer) : vec2(0.0);

    float trailFieldSum = 0.0;
    trailFieldSum += trailField(uv, u_trail0, 0.14);
    trailFieldSum += trailField(uv, u_trail1, 0.13);
    trailFieldSum += trailField(uv, u_trail2, 0.12);
    trailFieldSum += trailField(uv, u_trail3, 0.11);
    trailFieldSum += trailField(uv, u_trail4, 0.10);
    trailFieldSum += trailField(uv, u_trail5, 0.09);
    trailFieldSum = clamp(trailFieldSum, 0.0, 1.0);

    float clickRadius = u_clickAge * 0.38;
    float clickRing = smoothstep(0.035, 0.0, abs(length(uv - u_clickPos) - clickRadius)) * u_clickPower;
    float clickPulse = smoothstep(0.18, 0.0, length(uv - u_clickPos)) * max(0.0, 1.0 - u_clickAge * 2.2) * u_clickPower;

    uv += dir * pointerField * 0.022;
    uv.x += (noise(vec2(uv.y * 90.0, u_time * 8.0)) - 0.5) * pointerField * 0.022;
    uv.y += (noise(vec2(uv.x * 60.0, u_time * 6.0 + 11.0)) - 0.5) * pointerField * 0.010;

    uv.x += (noise(vec2(uv.y * 110.0 + 7.0, u_time * 12.0)) - 0.5) * trailFieldSum * 0.028;
    uv.y += (noise(vec2(uv.x * 85.0 + 17.0, u_time * 10.0)) - 0.5) * trailFieldSum * 0.012;

    vec2 clickDir = length(uv - u_clickPos) > 0.0001 ? normalize(uv - u_clickPos) : vec2(0.0);
    uv += clickDir * clickRing * 0.03;

    float microJitter = step(0.92, fract(u_time * 8.0)) * 0.0018;
    uv.x += (rand(vec2(floor(u_time * 30.0), 1.0)) - 0.5) * microJitter;
    uv.y += (rand(vec2(2.0, floor(u_time * 27.0))) - 0.5) * microJitter;

    float bands = 0.0;
    for (int i = 0; i < 5; i++) {
      float fi = float(i);
      float y = fract(u_time * (0.11 + fi * 0.03) + fi * 0.17);
      float band = smoothstep(0.035, 0.0, abs(uv.y - y));
      bands += band;
    }

    float lineGlitch = bands * u_globalGlitch;
    uv.x += (noise(vec2(uv.y * 60.0, floor(u_time * 40.0))) - 0.5) * 0.065 * lineGlitch;

    vec2 textUv = floor(uv * vec2(132.0, 80.0)) / vec2(132.0, 80.0);
    vec4 tex = texture2D(u_text, textUv);
    float ink = tex.a;

    float edge = 0.0;
    edge += texture2D(u_text, textUv + vec2( 0.0035, 0.0)).a;
    edge += texture2D(u_text, textUv + vec2(-0.0035, 0.0)).a;
    edge += texture2D(u_text, textUv + vec2(0.0,  0.0035)).a;
    edge += texture2D(u_text, textUv + vec2(0.0, -0.0035)).a;
    edge = max(0.0, edge * 0.25 - ink);

    float scan = 0.90 + 0.10 * sin(uv.y * u_resolution.y * 1.1);
    scan *= 0.97 + 0.03 * sin(u_time * 30.0 + uv.y * 20.0);

    float grain = (rand(vec2(
      floor(uv.x * u_resolution.x * 0.7),
      floor(uv.y * u_resolution.y * 0.7) + floor(u_time * 20.0)
    )) - 0.5) * 0.18;

    float flicker = 0.97 + 0.03 * sin(u_time * 23.0 + 1.7);

    float alpha = ink;
    alpha += edge * 0.40;
    alpha += grain * 0.10 * ink;
    alpha *= scan * flicker;

    alpha += lineGlitch * 0.10 * (rand(vec2(uv.y * 100.0, floor(u_time * 55.0))) - 0.5);
    alpha -= lineGlitch * 0.12 * step(0.82, rand(vec2(floor(uv.y * 130.0), floor(u_time * 50.0))));
    alpha += u_idlePulse * 0.04 * (noise(vec2(uv * 18.0 + u_time * 0.7)) - 0.5) * ink;

    alpha += pointerField * 0.24 * ink;
    alpha += pointerRing * 0.18 * ink;
    alpha -= step(0.82, rand(vec2(floor(uv.y * 180.0), floor(u_time * 55.0)))) * pointerField * 0.08 * ink;
    alpha += (noise(vec2(distToPointer * 24.0, u_time * 10.0)) - 0.5) * 0.08 * pointerField * ink;

    alpha += trailFieldSum * 0.22 * ink;
    alpha += (noise(vec2(uv.x * 40.0, uv.y * 55.0 + u_time * 14.0)) - 0.5) * 0.10 * trailFieldSum * ink;

    float blockMask = step(0.56, rand(floor(uv * vec2(92.0, 56.0)) + floor(u_time * 6.0)));
    alpha -= blockMask * 0.08 * ink;
    alpha += (1.0 - blockMask) * 0.035 * ink;

    alpha += clickRing * 0.45 * ink;
    alpha += clickPulse * 0.20 * ink;
    alpha -= step(0.86, rand(vec2(floor(length(uv - u_clickPos) * 240.0), floor(u_time * 90.0)))) * clickRing * 0.12 * ink;

    alpha = smoothstep(0.06, 0.62, alpha);
    alpha = clamp(alpha, 0.0, 1.0);

    gl_FragColor = vec4(vec3(0.0), alpha);
  }
`

function createShader(type, source) {
  const shader = gl.createShader(type)
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader)
    gl.deleteShader(shader)
    throw new Error(`Shader compile error: ${info ?? 'unknown'}`)
  }
  return shader
}

function createProgram(vsSource, fsSource) {
  const vs = createShader(gl.VERTEX_SHADER, vsSource)
  const fs = createShader(gl.FRAGMENT_SHADER, fsSource)
  const next = gl.createProgram()
  gl.attachShader(next, vs)
  gl.attachShader(next, fs)
  gl.linkProgram(next)
  if (!gl.getProgramParameter(next, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(next)
    throw new Error(`Program link error: ${info ?? 'unknown'}`)
  }
  return next
}

function mechanicalGlitchStrength(t) {
  const intro = Math.max(0, 1 - t / 0.55)
  const cyc = Math.max(0, Math.sin((t / IDLE_GLITCH_INTERVAL) * Math.PI * 2))
  const pulse = Math.pow(cyc, 18) * 0.9
  const kick1 = Math.exp(-Math.pow((t - 0.1) / 0.035, 2)) * 1
  const kick2 = Math.exp(-Math.pow((t - 0.26) / 0.025, 2)) * 0.8
  const kick3 = Math.exp(-Math.pow((t - 0.43) / 0.03, 2)) * 0.7
  return Math.min(1, intro * 0.7 + pulse + kick1 + kick2 + kick3)
}

function randomGlyph(n) {
  const chars = '01#@%&/\\\\[]{}<>-=+*'
  return chars[n % chars.length]
}

function getVisibleChars(text, t) {
  let count = 0
  for (let i = 0; i < text.length; i += 1) {
    const start = BLOCK_PHASE + i * CHAR_INTERVAL
    if (t >= start) count += 1
  }
  return count
}

function drawBootBlocks(ctx, w, h, t) {
  ctx.save()
  ctx.fillStyle = 'rgba(0,0,0,0.95)'
  const prog = t / BLOCK_PHASE
  const blocks = Math.floor(18 + prog * 40)

  for (let i = 0; i < blocks; i += 1) {
    const bw = 10 + (i % 5) * 6
    const bh = 8 + (i % 4) * 5
    const x = w * 0.2 + ((i * 37) % Math.floor(w * 0.6))
    const y = h * 0.36 + ((i * 19) % Math.floor(h * 0.28))
    if ((i + Math.floor(t * 90)) % 3 !== 0) {
      ctx.fillRect(x, y, bw, bh)
    }
  }

  ctx.restore()
}

function drawMechanicalText(ctx, text, cx, cy, fontSize, t) {
  if (!text) return

  const chars = text.split('')
  const totalWidth = ctx.measureText(text).width
  let cursorX = cx - totalWidth / 2
  const influenceRadius = 0.12
  const normPointerX = pointer.x
  const normPointerY = 1 - pointer.y

  for (let i = 0; i < chars.length; i += 1) {
    const ch = chars[i]
    const w = ctx.measureText(ch).width
    const start = BLOCK_PHASE + i * CHAR_INTERVAL
    const localT = t - start
    const charCenterX = (cursorX + w * 0.5) / textCanvas.width
    const charCenterY = cy / textCanvas.height
    const dx = charCenterX - normPointerX
    const dy = charCenterY - normPointerY
    const dist = Math.sqrt(dx * dx + dy * dy)
    const hoverPower = Math.max(0, 1 - dist / influenceRadius) * pointer.power

    if (localT < 0) {
      cursorX += w
      continue
    }

    const locked = localT > CHAR_LOCK_DELAY
    ctx.save()

    if (!locked) {
      const snap = Math.floor(localT * 60) % 2 === 0 ? -2 : 2
      const ySnap = Math.floor(localT * 32) % 2 === 0 ? 1 : -1
      ctx.translate(snap, ySnap)
    }

    if (hoverPower > 0.01 && ch !== ' ') {
      const hoverJitterX = Math.sin(t * 30 + i * 1.3) * 1.8 * hoverPower
      const hoverJitterY = Math.cos(t * 22 + i * 0.9) * 1.2 * hoverPower
      ctx.translate(hoverJitterX, hoverJitterY)
    }

    if (!locked && ch !== ' ') {
      const glyph =
        hoverPower > 0.35 ? randomGlyph(i + Math.floor(t * 120)) : randomGlyph(i + Math.floor(t * 70))
      ctx.fillStyle = `rgba(0,0,0,${0.42 + hoverPower * 0.2})`
      ctx.fillText(glyph, cursorX, cy)
      ctx.fillStyle = `rgba(0,0,0,${0.92 + hoverPower * 0.05})`
      const barY = cy + fontSize * 0.12
      ctx.fillRect(cursorX - 1, barY, w + 2, 2)
    } else {
      ctx.fillStyle = 'rgba(0,0,0,1)'
      ctx.fillText(ch, cursorX, cy)

      if ((i + Math.floor(t * 4)) % 7 === 0 && t < 1.2) {
        ctx.globalAlpha = 0.12
        ctx.fillStyle = '#000'
        ctx.fillText(ch, cursorX + 2, cy)
      }

      if (hoverPower > 0.08 && ch !== ' ') {
        ctx.globalAlpha = 0.12 + hoverPower * 0.18
        ctx.fillStyle = '#000'
        ctx.fillText(ch, cursorX + 2 + hoverPower * 3, cy)

        if (hoverPower > 0.45 && Math.floor(t * 40 + i) % 3 === 0) {
          ctx.globalAlpha = 0.35
          ctx.fillStyle = '#000'
          ctx.fillText(randomGlyph(i + Math.floor(t * 180)), cursorX, cy)
        }
      }
    }

    ctx.restore()
    cursorX += w
  }
}

function renderTextToTexture(nowSec) {
  const t = Math.max(0, nowSec - animationStart)
  const tw = textCanvas.width
  const th = textCanvas.height

  textCtx.clearRect(0, 0, tw, th)
  textCtx.imageSmoothingEnabled = false

  const baseFont = Math.floor(Math.min(tw * 0.16, th * 0.72))
  const fontSize = Math.max(40, Math.min(98, baseFont))
  textCtx.textAlign = 'center'
  textCtx.textBaseline = 'middle'
  textCtx.font = `700 ${fontSize}px "Cascadia Mono", "Consolas", "Microsoft YaHei", monospace`

  const cx = tw * 0.5
  const cy = th * 0.5
  const safeText = String(props.text ?? '').trim() || 'CYBER PIXEL'
  const visibleCount = getVisibleChars(safeText, t)
  const visibleText = safeText.slice(0, visibleCount)

  if (t < BLOCK_PHASE) {
    drawBootBlocks(textCtx, tw, th, t)
  }

  drawMechanicalText(textCtx, visibleText, cx, cy, fontSize, t)

  if (visibleCount < safeText.length && t > BLOCK_PHASE * 0.6) {
    const garble = safeText
      .slice(visibleCount)
      .split('')
      .map((ch) => (ch === ' ' ? ' ' : randomGlyph(Math.floor((t * 100 + ch.charCodeAt(0)) % 999))))
      .join('')
    const preview = visibleText + garble
    textCtx.save()
    const jitter = Math.floor(t * 40) % 2 === 0 ? 1 : -1
    textCtx.translate(jitter, 0)
    textCtx.fillStyle = 'rgba(0,0,0,0.35)'
    textCtx.fillText(preview, cx, cy)
    textCtx.restore()
  }

  if (t > STABILIZE_TIME) {
    textCtx.save()
    textCtx.globalAlpha = 0.14
    textCtx.fillStyle = '#000'
    textCtx.fillText(safeText, cx, cy)
    textCtx.restore()
  }

  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textCanvas)
}

function updatePointer() {
  pointer.x += (pointer.tx - pointer.x) * 0.18
  pointer.y += (pointer.ty - pointer.y) * 0.18
  const targetPower = pointer.inside ? 1 : 0
  pointer.power += (targetPower - pointer.power) * 0.12

  for (let i = trail.length - 1; i > 0; i -= 1) {
    trail[i].x += (trail[i - 1].x - trail[i].x) * 0.35
    trail[i].y += (trail[i - 1].y - trail[i].y) * 0.35
    trail[i].a += (trail[i - 1].a * 0.82 - trail[i].a) * 0.28
  }
  trail[0].x = pointer.x
  trail[0].y = pointer.y
  trail[0].a += ((pointer.inside ? 1 : 0) * pointer.power - trail[0].a) * 0.45

  if (clickWave.power > 0.001) {
    clickWave.power *= 0.965
  }
}

function renderAtTime(nowSec) {
  if (!gl || !uniforms) return
  updatePointer()
  const t = Math.max(0, nowSec - animationStart)
  renderTextToTexture(nowSec)

  gl.viewport(0, 0, width, height)
  gl.clearColor(0, 0, 0, 0)
  gl.clear(gl.COLOR_BUFFER_BIT)
  gl.enable(gl.BLEND)
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

  gl.useProgram(program)
  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_2D, texture)

  gl.uniform2f(uniforms.uResolution, width, height)
  gl.uniform1f(uniforms.uTime, nowSec)
  gl.uniform1f(uniforms.uGlobalGlitch, mechanicalGlitchStrength(t))
  gl.uniform1f(uniforms.uIdlePulse, t > 1 ? 1 : 0)
  gl.uniform1f(uniforms.uSeed, cycleSeed)
  gl.uniform2f(uniforms.uPointer, pointer.x, pointer.y)
  gl.uniform1f(uniforms.uPointerPower, pointer.power)

  gl.uniform3f(uniforms.uTrail0, trail[0].x, trail[0].y, trail[0].a)
  gl.uniform3f(uniforms.uTrail1, trail[1].x, trail[1].y, trail[1].a)
  gl.uniform3f(uniforms.uTrail2, trail[2].x, trail[2].y, trail[2].a)
  gl.uniform3f(uniforms.uTrail3, trail[3].x, trail[3].y, trail[3].a)
  gl.uniform3f(uniforms.uTrail4, trail[4].x, trail[4].y, trail[4].a)
  gl.uniform3f(uniforms.uTrail5, trail[5].x, trail[5].y, trail[5].a)

  const clickAge = clickWave.power > 0.001 ? Math.min(1.5, nowSec - clickWave.startAt) : 10
  gl.uniform2f(uniforms.uClickPos, clickWave.x, clickWave.y)
  gl.uniform1f(uniforms.uClickAge, clickAge)
  gl.uniform1f(uniforms.uClickPower, clickWave.power)

  gl.drawArrays(gl.TRIANGLES, 0, 6)
}

function loop(nowMs) {
  renderAtTime(nowMs * 0.001)
  animationId = requestAnimationFrame(loop)
}

function resize() {
  if (!canvasRef.value || !wrapRef.value || !gl) return
  dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2))
  const rect = wrapRef.value.getBoundingClientRect()
  width = Math.max(1, Math.floor(rect.width * dpr))
  height = Math.max(1, Math.floor(Math.max(rect.height, 72) * dpr))
  canvasRef.value.width = width
  canvasRef.value.height = height
  textCanvas.width = Math.max(220, Math.floor(width / 1.35))
  textCanvas.height = Math.max(124, Math.floor(height / 1.08))
}

function restartAnimation() {
  animationStart = performance.now() * 0.001
  cycleSeed = Math.random() * 1000
}

function setupInteraction() {
  const canvas = canvasRef.value
  if (!canvas) return

  onMove = (e) => {
    const rect = canvas.getBoundingClientRect()
    pointer.tx = (e.clientX - rect.left) / rect.width
    pointer.ty = 1 - (e.clientY - rect.top) / rect.height
    pointer.inside = true
  }
  onEnter = () => {
    pointer.inside = true
  }
  onLeave = () => {
    pointer.inside = false
  }
  onClick = (e) => {
    const rect = canvas.getBoundingClientRect()
    clickWave.x = (e.clientX - rect.left) / rect.width
    clickWave.y = 1 - (e.clientY - rect.top) / rect.height
    clickWave.startAt = performance.now() * 0.001
    clickWave.power = 1
  }
  onResize = () => resize()

  canvas.addEventListener('mousemove', onMove)
  canvas.addEventListener('mouseenter', onEnter)
  canvas.addEventListener('mouseleave', onLeave)
  canvas.addEventListener('click', onClick)
  window.addEventListener('resize', onResize)
}

function cleanupInteraction() {
  const canvas = canvasRef.value
  if (!canvas) return
  if (onMove) canvas.removeEventListener('mousemove', onMove)
  if (onEnter) canvas.removeEventListener('mouseenter', onEnter)
  if (onLeave) canvas.removeEventListener('mouseleave', onLeave)
  if (onClick) canvas.removeEventListener('click', onClick)
  if (onResize) window.removeEventListener('resize', onResize)
}

function initGL() {
  const canvas = canvasRef.value
  if (!canvas) return false

  gl = canvas.getContext('webgl', {
    antialias: false,
    alpha: true,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
  })
  if (!gl) return false

  textCanvas = document.createElement('canvas')
  textCtx = textCanvas.getContext('2d', { alpha: true })

  program = createProgram(vertexShaderSource, fragmentShaderSource)
  gl.useProgram(program)

  const quad = new Float32Array([
    -1, -1, 0, 0,
    1, -1, 1, 0,
    -1, 1, 0, 1,
    -1, 1, 0, 1,
    1, -1, 1, 0,
    1, 1, 1, 1,
  ])

  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW)

  const aPosition = gl.getAttribLocation(program, 'a_position')
  const aUv = gl.getAttribLocation(program, 'a_uv')
  gl.enableVertexAttribArray(aPosition)
  gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 16, 0)
  gl.enableVertexAttribArray(aUv)
  gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 16, 8)

  texture = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)

  uniforms = {
    uResolution: gl.getUniformLocation(program, 'u_resolution'),
    uTime: gl.getUniformLocation(program, 'u_time'),
    uGlobalGlitch: gl.getUniformLocation(program, 'u_globalGlitch'),
    uIdlePulse: gl.getUniformLocation(program, 'u_idlePulse'),
    uSeed: gl.getUniformLocation(program, 'u_seed'),
    uPointer: gl.getUniformLocation(program, 'u_pointer'),
    uPointerPower: gl.getUniformLocation(program, 'u_pointerPower'),
    uTrail0: gl.getUniformLocation(program, 'u_trail0'),
    uTrail1: gl.getUniformLocation(program, 'u_trail1'),
    uTrail2: gl.getUniformLocation(program, 'u_trail2'),
    uTrail3: gl.getUniformLocation(program, 'u_trail3'),
    uTrail4: gl.getUniformLocation(program, 'u_trail4'),
    uTrail5: gl.getUniformLocation(program, 'u_trail5'),
    uClickPos: gl.getUniformLocation(program, 'u_clickPos'),
    uClickAge: gl.getUniformLocation(program, 'u_clickAge'),
    uClickPower: gl.getUniformLocation(program, 'u_clickPower'),
  }

  resize()
  return true
}

watch(
  () => props.text,
  () => {
    restartAnimation()
  },
)

onMounted(() => {
  if (!initGL()) return
  restartAnimation()
  setupInteraction()
  animationId = requestAnimationFrame(loop)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(animationId)
  cleanupInteraction()
  if (gl && texture) gl.deleteTexture(texture)
  if (gl && program) gl.deleteProgram(program)
})
</script>

<template>
  <component :is="tag" ref="wrapRef" class="cyber-title" :aria-label="props.text">
    <span class="cyber-title__sr">{{ props.text }}</span>
    <canvas ref="canvasRef" class="cyber-title__canvas" />
  </component>
</template>

<style scoped>
.cyber-title {
  position: relative;
  margin: 0;
  width: min(100%, 500px);
  height: clamp(64px, 9.4vw, 98px);
}

.cyber-title__canvas {
  display: block;
  width: 100%;
  height: 100%;
  background: transparent;
  image-rendering: pixelated;
  cursor: crosshair;
}

.cyber-title__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  border: 0;
  clip: rect(0, 0, 0, 0);
}
</style>




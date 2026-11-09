/**
 * One-pass WebGL renderer for the hero art plate: a single full-screen triangle that
 * samples the plate and adds the live layers (lake ripples, waterfall flow, ring light,
 * core sparkle, beam pulse, module glow, failure and recovery, request packet).
 * One draw call per frame, no allocations per frame, WebGL 1 for reach.
 */
import {
  PLATE_BEAM,
  PLATE_FALLS,
  PLATE_H,
  PLATE_HORIZON_Y,
  PLATE_RINGS,
  PLATE_RIPPLE,
  PLATE_SPHERE,
  PLATE_W,
} from "./plateMap";

export const MODULE_COUNT = 7;

export interface PlateFrame {
  time: number;
  light: boolean;
  /** 0..1 how much of the scene is dimmed by an outage. */
  outage: number;
  /** Per module: x, y (plate px), amber highlight 0..1, failure 0..1. */
  modules: Float32Array;
  /** Per module: recovery glow 0..1. */
  recovery: Float32Array;
  /** Packet x, y (plate px), visibility 0..1, blocked 0/1. */
  packet: Float32Array;
}

export interface PlateRenderer {
  setImage(image: TexImageSource): void;
  resize(width: number, height: number): void;
  render(frame: PlateFrame): void;
  dispose(): void;
}

const f = (n: number) => n.toFixed(1);

const VERTEX = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

/** Exported for tests only. */
export const FRAGMENT = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform float uTime;
uniform float uLight;
uniform float uOutage;
uniform vec4 uMods[${MODULE_COUNT}];
uniform float uRec[${MODULE_COUNT}];
uniform vec4 uPacket;

const vec2 PLATE = vec2(${f(PLATE_W)}, ${f(PLATE_H)});
const vec3 AMBER = vec3(1.0, 0.68, 0.28);
const vec3 RED = vec3(1.0, 0.22, 0.16);
const vec3 SAGE = vec3(0.62, 0.92, 0.62);

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}
float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
float inRect(vec2 p, vec4 r, float soft) {
  vec2 a = smoothstep(r.xy - soft, r.xy + soft, p);
  vec2 b = 1.0 - smoothstep(r.zw - soft, r.zw + soft, p);
  return a.x * a.y * b.x * b.y;
}

void main() {
  vec2 p = vec2(vUv.x, 1.0 - vUv.y) * PLATE;
  float t = uTime;
  float glowScale = mix(1.0, 0.45, uLight);

  // Lake: ripples spreading from under the core, stronger near the viewer.
  vec2 offset = vec2(0.0);
  float below = smoothstep(${f(PLATE_HORIZON_Y)}, ${f(PLATE_HORIZON_Y + 14)}, p.y);
  vec2 rd = (p - vec2(${f(PLATE_RIPPLE.x)}, ${f(PLATE_RIPPLE.y)})) * vec2(0.28, 1.0);
  float rdist = length(rd);
  float depth = clamp((p.y - ${f(PLATE_HORIZON_Y)}) / 220.0, 0.0, 1.0);
  float wave = sin(rdist * 0.11 - t * 1.6) * exp(-rdist * 0.012);
  float swell = fbm(vec2(p.x * 0.012 + t * 0.05, p.y * 0.05 - t * 0.12)) - 0.5;
  offset.x += below * (wave * 2.2 + swell * 5.0) * (0.4 + depth);
  offset.y += below * (wave * 1.2 + swell * 2.0) * (0.4 + depth);

  vec3 col = texture2D(uTex, clamp((p + offset) / PLATE, 0.0, 1.0)).rgb;
  float l = luma(col);

  // Concentric light rings on the water surface.
  float rings = pow(0.5 + 0.5 * sin(rdist * 0.11 - t * 1.6), 10.0) * exp(-rdist * 0.009);
  col += AMBER * rings * below * 0.16 * glowScale * (0.4 + l);

  // Waterfalls: bright streaks sliding down the lit water, mist drifting at the base.
  float falls = 0.0;
  ${PLATE_FALLS.map(
    (r) =>
      `falls = max(falls, inRect(p, vec4(${f(r.x0)}, ${f(r.y0)}, ${f(r.x1)}, ${f(r.y1)}), 4.0));`
  ).join("\n  ")}
  float flow = noise(vec2(p.x * 0.45, p.y * 0.035 - t * 2.6)) * 0.7 + noise(vec2(p.x * 0.9, p.y * 0.08 - t * 4.1)) * 0.3;
  float wet = smoothstep(0.32, 0.7, l);
  col += col * falls * wet * (flow - 0.45) * 0.85;
  float mistBand = smoothstep(705.0, 735.0, p.y) * (1.0 - smoothstep(745.0, 790.0, p.y));
  float mistX = smoothstep(880.0, 930.0, p.x) * (1.0 - smoothstep(1110.0, 1170.0, p.x));
  float mist = fbm(vec2(p.x * 0.018 - t * 0.08, p.y * 0.04 + t * 0.05)) * mistBand * mistX;
  col = mix(col, mix(vec3(0.92, 0.88, 0.8), vec3(1.0), uLight), mist * 0.22);

  // Orbit rings: light streaks travelling along the bright glass.
  vec2 sd = p - vec2(${f(PLATE_SPHERE.x)}, ${f(PLATE_SPHERE.y)});
  float sdist = length(sd);
  float ringZone = inRect(p, vec4(${f(PLATE_RINGS.x0)}, ${f(PLATE_RINGS.y0)}, ${f(PLATE_RINGS.x1)}, ${f(PLATE_RINGS.y1)}), 40.0)
    * smoothstep(${f(PLATE_SPHERE.r - 4)}, ${f(PLATE_SPHERE.r + 10)}, sdist);
  float angle = atan(sd.y * 1.9, sd.x);
  float streak = pow(0.5 + 0.5 * sin(angle * 3.0 - t * 0.7), 14.0) + pow(0.5 + 0.5 * sin(angle * 2.0 + t * 0.45 + 1.3), 22.0);
  float glass = smoothstep(0.38, 0.75, l) * smoothstep(0.0, 0.12, col.r - col.b);
  // The light plate's cream sky is as bright and warm as the glass, so there the streaks
  // also need local contrast (a glass edge or highlight), or they tint the whole ring box.
  vec2 px = 6.0 / PLATE;
  vec2 uv = p / PLATE;
  float around = 0.25 * (luma(texture2D(uTex, uv + vec2(px.x, 0.0)).rgb) + luma(texture2D(uTex, uv - vec2(px.x, 0.0)).rgb)
    + luma(texture2D(uTex, uv + vec2(0.0, px.y)).rgb) + luma(texture2D(uTex, uv - vec2(0.0, px.y)).rgb));
  glass *= mix(1.0, smoothstep(0.015, 0.06, abs(l - around)), uLight);
  col += AMBER * streak * glass * ringZone * 0.55 * glowScale;

  // Core: gold nodes twinkle, the beam pulses down into the island.
  float core = 1.0 - smoothstep(${f(PLATE_SPHERE.r - 12)}, ${f(PLATE_SPHERE.r)}, sdist);
  float twinkle = 0.5 + 0.5 * sin(t * 1.6 + noise(p * 0.045) * 9.0);
  col += col * core * smoothstep(0.45, 0.85, l) * (twinkle - 0.35) * 0.7 * glowScale;
  float bx = abs(p.x - ${f(PLATE_BEAM.x)});
  float beamY = smoothstep(${f(PLATE_BEAM.y0)}, ${f(PLATE_BEAM.y0 + 12)}, p.y) * (1.0 - smoothstep(${f(PLATE_BEAM.y1 - 15)}, ${f(PLATE_BEAM.y1)}, p.y));
  float pulse = pow(0.5 + 0.5 * sin(p.y * 0.07 - t * 3.2), 6.0);
  col += AMBER * exp(-bx * bx / 14.0) * beamY * (0.15 + pulse * 0.45) * glowScale;

  // Outage: the whole scene loses a little light while a service is down.
  col *= 1.0 - uOutage * 0.18;

  // Modules: hover/selection glow, failure red with an expanding pulse, recovery calm.
  for (int i = 0; i < ${MODULE_COUNT}; i++) {
    vec4 m = uMods[i];
    float d = length(p - m.xy);
    float halo = exp(-d * d / 1800.0);
    col += AMBER * halo * m.z * 0.55 * glowScale;
    if (m.w > 0.0) {
      float near = 1.0 - smoothstep(26.0, 52.0, d);
      float lum = luma(col);
      col = mix(col, RED * (0.35 + lum * 1.6) * mix(1.0, 0.85, uLight), near * m.w * 0.85);
      float wavefront = mod(t * 46.0, 70.0) + 22.0;
      float edge = exp(-pow((d - wavefront) / 3.2, 2.0)) * (1.0 - (wavefront - 22.0) / 70.0);
      col += RED * (edge * 0.7 + halo * 0.35) * m.w * mix(1.0, 0.7, uLight);
    }
    float rec = uRec[i];
    col += mix(SAGE, AMBER, 0.45) * halo * rec * 0.55 * glowScale;
  }

  // Request packet.
  if (uPacket.z > 0.0) {
    float d = length(p - uPacket.xy);
    vec3 tint = mix(AMBER, RED, uPacket.w);
    float g = exp(-d * d / 60.0) * 1.1 + exp(-d * d / 900.0) * 0.4;
    col += tint * g * uPacket.z * mix(1.0, 0.75, uLight);
    col = mix(col, vec3(1.0, 0.97, 0.9), exp(-d * d / 10.0) * uPacket.z);
  }

  gl_FragColor = vec4(col, 1.0);
}`;

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Hero plate: could not create shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Hero plate shader failed to compile: ${log ?? "unknown error"}`);
  }
  return shader;
}

/** Throws when WebGL is unavailable or the shader fails, so the caller can fall back loudly. */
export function createPlateRenderer(canvas: HTMLCanvasElement): PlateRenderer {
  const gl = canvas.getContext("webgl", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    powerPreference: "low-power",
  });
  if (!gl) throw new Error("Hero plate: WebGL is unavailable");

  const program = gl.createProgram();
  if (!program) throw new Error("Hero plate: could not create program");
  const vs = compile(gl, gl.VERTEX_SHADER, VERTEX);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`Hero plate program failed to link: ${gl.getProgramInfoLog(program) ?? ""}`);
  }
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const texture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  const u = (name: string) => gl.getUniformLocation(program, name);
  const uTex = u("uTex");
  const uTime = u("uTime");
  const uLight = u("uLight");
  const uOutage = u("uOutage");
  const uMods = u("uMods");
  const uRec = u("uRec");
  const uPacket = u("uPacket");
  gl.uniform1i(uTex, 0);

  let hasImage = false;

  return {
    setImage(image) {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
      hasImage = true;
    },
    resize(width, height) {
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl.viewport(0, 0, width, height);
    },
    render(frame) {
      if (!hasImage) return;
      gl.uniform1f(uTime, frame.time);
      gl.uniform1f(uLight, frame.light ? 1 : 0);
      gl.uniform1f(uOutage, frame.outage);
      gl.uniform4fv(uMods, frame.modules);
      gl.uniform1fv(uRec, frame.recovery);
      gl.uniform4fv(uPacket, frame.packet);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    dispose() {
      gl.deleteTexture(texture);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    },
  };
}

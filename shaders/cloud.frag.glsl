uniform float uTime;
uniform float uDepth;      // plane depth position (0.0–1.0)
uniform float uOpacity;
uniform vec2  uSpeed;      // drift speed
uniform vec3  uColorA;     // dark edge color
uniform vec3  uColorB;     // lighter center/highlight color

varying vec2 vUv;
varying vec3 vWorldPosition;

// ── Hash & noise helpers ──────────────────────────────────

float hash(vec2 p) {
  p = fract(p * vec2(127.1, 311.7));
  p += dot(p, p + 19.19);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);

  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));

  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// Fractional Brownian Motion — layered noise
float fbm(vec2 p) {
  float val = 0.0;
  float amp = 0.5;
  float freq = 1.0;
  for (int i = 0; i < 6; i++) {
    val += amp * noise(p * freq);
    amp  *= 0.5;
    freq *= 2.1;
  }
  return val;
}

void main() {
  // Drift UV over time at per-plane speed
  vec2 driftedUv = vUv + uSpeed * uTime;

  // Two-octave FBM warp for extra "cloud" feel
  vec2 warp = vec2(
    fbm(driftedUv * 1.2 + vec2(0.8, 0.3)),
    fbm(driftedUv * 1.2 + vec2(0.2, 0.9))
  );
  float density = fbm(driftedUv * 2.0 + warp * 0.6);

  // Remap: crush thin areas, keep thick cloud bulges
  density = smoothstep(0.38, 0.78, density);

  // Radial vignette — darker at edges, slightly brighter center
  vec2 centered = vUv - 0.5;
  float vignette = 1.0 - dot(centered, centered) * 2.2;
  vignette = clamp(vignette, 0.0, 1.0);

  // Light source: upper-center warmth
  float lightAngle = dot(normalize(vec3(centered.x, centered.y + 0.3, 1.0)),
                         normalize(vec3(0.0, 0.4, 1.0)));
  lightAngle = clamp(lightAngle, 0.0, 1.0);

  // Blend dark/light cloud colors
  vec3 cloudColor = mix(uColorA, uColorB, density * lightAngle * 0.6 + vignette * 0.15);

  float alpha = density * vignette * uOpacity;

  // Depth-based fade: deeper planes are dimmer
  alpha *= (1.0 - uDepth * 0.4);

  gl_FragColor = vec4(cloudColor, alpha);
}

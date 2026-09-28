// Underside of the suspended sea, seen from below. The screen above a horizon
// line is projected onto a plane overhead; a moving height field bends the
// ceiling plate and focuses cyan caustics, a faint amber rim lights the lower
// edge from the world below, and uReveal opens the fog from the top down.
precision mediump float;

uniform vec2 uRes;
uniform float uTime;
uniform float uReveal;
uniform float uPalette; // 0 = dusk over Elaris, 1 = night
uniform float uPlateReady;
uniform sampler2D uPlate;

const float HORIZON = 0.16;

float hash(vec2 p) {
  p = fract(p * vec2(233.34, 851.73));
  p += dot(p, p + 23.45);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + 1.0), u.x), u.y);
}

float waves(vec2 p, float t) {
  float h = 0.5 * sin(dot(p, vec2(0.83, 0.56)) * 1.9 + t * 0.8);
  h += 0.3 * sin(dot(p, vec2(-0.47, 0.88)) * 2.7 - t * 0.63);
  h += 0.2 * sin(dot(p, vec2(0.12, -0.99)) * 3.6 + t * 1.1);
  return h + 0.7 * vnoise(p * 2.1 + vec2(t * 0.11, -t * 0.07));
}

// Distance to the nearest line of a drifting, domain-warped grid.
float gridLine(vec2 p, float t, float phase) {
  vec2 w = p + 0.32 * vec2(sin(p.y * 1.7 + t * 0.55 + phase), sin(p.x * 1.4 - t * 0.48 + phase));
  vec2 g = abs(fract(w) - 0.5);
  return min(g.x, g.y);
}

float caustics(vec2 p, float t) {
  float a = gridLine(p * 1.6, t, 0.0);
  float b = gridLine(mat2(0.78, -0.62, 0.62, 0.78) * p * 2.2 + vec2(t * 0.09, -t * 0.06), t * 1.2, 2.1);
  float c = exp(-a * 11.0) + exp(-b * 13.0);
  return pow(c * 0.5, 2.6);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  float aspect = uRes.x / uRes.y;
  float d = max(uv.y - HORIZON, 0.02);
  vec2 p = vec2((uv.x - 0.5) * aspect / d, 1.0 / d) * 0.9;
  float t = uTime;

  float e = 0.04;
  float h = waves(p, t);
  vec2 n = vec2(waves(p + vec2(e, 0.0), t) - h, waves(p + vec2(0.0, e), t) - h) / e;

  // The plate is laid on the overhead plane and mirrored as it recedes.
  vec2 q = vec2(p.x * 0.42 + 0.5 + t * 0.004, (p.y - 1.05) * 0.95) + n * 0.006;
  q = 1.0 - abs(1.0 - mod(q, 2.0));
  vec3 plate = texture2D(uPlate, q).rgb * uPlateReady;

  float overhead = smoothstep(HORIZON, 1.0, uv.y);
  vec3 deep = mix(vec3(0.010, 0.060, 0.070), vec3(0.004, 0.018, 0.040), uPalette);
  vec3 teal = mix(vec3(0.050, 0.380, 0.400), vec3(0.030, 0.200, 0.280), uPalette);
  vec3 cyan = mix(vec3(0.560, 0.960, 1.000), vec3(0.380, 0.780, 0.960), uPalette);
  vec3 amber = vec3(0.900, 0.480, 0.200);

  vec3 col = deep + plate * mix(0.35, 1.05, overhead);
  col = mix(col, teal * (0.35 + overhead), 0.22);
  col += cyan * caustics(p + n * 0.12, t) * mix(0.08, 0.5, overhead) * (1.0 - 0.45 * uPalette);
  float rim = exp(-pow((uv.y - HORIZON - 0.12) / 0.07, 2.0));
  col += amber * rim * (0.1 - 0.06 * uPalette);

  float fogFade = smoothstep(HORIZON + 0.04, HORIZON + 0.42, uv.y);
  float tear = 0.65 * vnoise(vec2(uv.x * 3.2, uv.y * 1.8 + t * 0.03)) + 0.35 * vnoise(uv * 11.0 - t * 0.05);
  float front = mix(1.35, -0.25, uReveal);
  float open = smoothstep(front - 0.1, front + 0.1, uv.y + (tear - 0.5) * 0.4);
  col += cyan * open * (1.0 - open) * 0.9;

  float alpha = fogFade * open;
  gl_FragColor = vec4(col * alpha, alpha);
}

// WebGL water ceiling: one fullscreen triangle running ceiling.frag.glsl.
// Shared by the home hero and, with the night palette, the Arc 2 cutscene.
// Budgets: DPR capped at 1.5 times a render scale; when the average frame
// over 90 frames passes 24ms the scale drops to 0.5, past 28ms the renderer
// stops and reports a fallback so the caller can show the still plate. The
// program links in the background (KHR_parallel_shader_compile when present)
// so page load never waits on the GPU. The drawing buffer is sized in its own
// task from ResizeObserver sizes, never inside a frame: each width/height
// assignment reallocates it and stalls on the GPU.
import fragmentSource from "./ceiling.frag.glsl?raw";

export type CeilingPalette = "dusk" | "night";
export type CeilingFallbackReason = "slow" | "context-lost" | "shader" | "plate-error";

export interface CeilingOptions {
  plateUrl: string;
  palette?: CeilingPalette;
  /** Render scale against the capped CSS pixel size (0.75 desktop, 0.5 low-end). */
  scale?: number;
  /** Frame cap; 30 on low-end devices. */
  fps?: number;
  onFallback?: (reason: CeilingFallbackReason) => void;
}

export interface CeilingRenderer {
  setReveal(value: number): void;
  setPalette(palette: CeilingPalette): void;
  start(): void;
  stop(): void;
  dispose(): void;
}

const VERTEX = "attribute vec2 aPos;void main(){gl_Position=vec4(aPos,0.0,1.0);}";
const SAMPLE_FRAMES = 90;
const RESIZE_SETTLE_MS = 150;
const COMPLETION_STATUS_KHR = 0x91b1;

/** Returns null without WebGL; the caller keeps its static composition. */
export function createCeilingRenderer(canvas: HTMLCanvasElement, options: CeilingOptions): CeilingRenderer | null {
  const gl = canvas.getContext("webgl", { alpha: true, antialias: false, depth: false, premultipliedAlpha: true });
  const program = gl?.createProgram();
  if (!gl || !program) return null;
  for (const [type, source] of [
    [gl.VERTEX_SHADER, VERTEX],
    [gl.FRAGMENT_SHADER, fragmentSource],
  ] as const) {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    gl.attachShader(program, shader);
  }
  gl.linkProgram(program);
  const parallel = gl.getExtension("KHR_parallel_shader_compile") !== null;

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([4, 20, 24, 255]));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

  let uniforms: Record<"uRes" | "uTime" | "uReveal" | "uPalette" | "uPlateReady", WebGLUniformLocation | null> | null = null;
  let scale = options.scale ?? 0.75;
  const minInterval = 1000 / (options.fps ?? 60) - 2;
  let palette = options.palette === "night" ? 1 : 0;
  let plateReady = 0;
  let reveal = 0;
  let wanted = false;
  let visible = true;
  let dead = false;
  let raf = 0;
  let poll = 0;
  let lastFrame = 0;
  let lastDraw = 0;
  let frames = 0;
  let frameSum = 0;
  let sized = false;
  let cssWidth = 0;
  let cssHeight = 0;
  let sizeTimer = 0;

  const applySize = () => {
    sizeTimer = 0;
    if (dead || !uniforms || cssWidth === 0 || cssHeight === 0) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5) * scale;
    const width = Math.max(1, Math.round(cssWidth * ratio));
    const height = Math.max(1, Math.round(cssHeight * ratio));
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    gl.viewport(0, 0, width, height);
    gl.uniform2f(uniforms.uRes, width, height);
    sized = true;
  };
  const scheduleSize = (delay: number) => {
    if (sizeTimer || dead) return;
    sizeTimer = window.setTimeout(applySize, delay);
  };

  // Program setup once linking finished; polled so the check itself never blocks.
  const link = () => {
    poll = 0;
    if (dead || uniforms) return;
    if (parallel && !gl.getProgramParameter(program, COMPLETION_STATUS_KHR)) {
      poll = window.setTimeout(link, 60);
      return;
    }
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return fail("shader");
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    const u = (name: string) => gl.getUniformLocation(program, name);
    uniforms = { uRes: u("uRes"), uTime: u("uTime"), uReveal: u("uReveal"), uPalette: u("uPalette"), uPlateReady: u("uPlateReady") };
    gl.uniform1i(u("uPlate"), 0);
    applySize();
    sync();
  };
  poll = window.setTimeout(link, parallel ? 0 : 120);

  const plate = new Image();
  plate.decoding = "async";
  plate.onload = () => {
    if (dead) return;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, plate);
    plateReady = 1;
  };
  plate.onerror = () => fail("plate-error");
  plate.src = options.plateUrl;

  const frame = (now: number) => {
    raf = 0;
    if (lastFrame) {
      frameSum += now - lastFrame;
      if (++frames === SAMPLE_FRAMES) {
        const average = frameSum / frames;
        frames = 0;
        frameSum = 0;
        if (average > 28) return fail("slow");
        if (average > 24 && scale > 0.5) {
          scale = 0.5;
          scheduleSize(0);
        }
      }
    }
    lastFrame = now;
    raf = requestAnimationFrame(frame);
    if (!uniforms || !sized || now - lastDraw < minInterval) return;
    lastDraw = now;
    gl.uniform1f(uniforms.uTime, now / 1000);
    gl.uniform1f(uniforms.uReveal, reveal);
    gl.uniform1f(uniforms.uPalette, palette);
    gl.uniform1f(uniforms.uPlateReady, plateReady);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const halt = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    lastFrame = 0;
    frames = 0;
    frameSum = 0;
  };

  // Idle while the fog is closed: nothing of the ceiling is visible then.
  const sync = () => {
    const run = wanted && visible && !dead && uniforms !== null && !document.hidden && reveal > 0.001;
    if (run && !raf) raf = requestAnimationFrame(frame);
    if (!run) {
      halt();
      if (!dead && reveal <= 0.001) gl.clear(gl.COLOR_BUFFER_BIT);
    }
  };

  function fail(reason: CeilingFallbackReason) {
    if (dead) return;
    renderer.dispose();
    options.onFallback?.(reason);
  }

  const onLost = (event: Event) => {
    event.preventDefault();
    fail("context-lost");
  };
  // Device pixel ratio changes (zoom, another screen) arrive as window resizes.
  const onResize = () => scheduleSize(RESIZE_SETTLE_MS);
  const sizeObserver = new ResizeObserver(([entry]) => {
    if (!entry) return;
    const first = cssWidth === 0;
    cssWidth = entry.contentRect.width;
    cssHeight = entry.contentRect.height;
    scheduleSize(first ? 0 : RESIZE_SETTLE_MS);
  });
  sizeObserver.observe(canvas);
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? true;
    sync();
  });
  observer.observe(canvas);
  canvas.addEventListener("webglcontextlost", onLost);
  window.addEventListener("resize", onResize);
  document.addEventListener("visibilitychange", sync);

  const renderer: CeilingRenderer = {
    setReveal(value) {
      reveal = Math.min(1, Math.max(0, value));
      sync();
    },
    setPalette(next) {
      palette = next === "night" ? 1 : 0;
    },
    start() {
      wanted = true;
      sync();
    },
    stop() {
      wanted = false;
      sync();
    },
    dispose() {
      if (dead) return;
      dead = true;
      halt();
      window.clearTimeout(poll);
      window.clearTimeout(sizeTimer);
      plate.onload = null;
      plate.onerror = null;
      observer.disconnect();
      sizeObserver.disconnect();
      canvas.removeEventListener("webglcontextlost", onLost);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", sync);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
  return renderer;
}

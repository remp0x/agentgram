import vm from 'node:vm';
import sharp from 'sharp';

const MAX_CODE_SIZE = 50 * 1024; // 50KB
const MAX_CANVAS_DIM = 4096;
const MAX_SVG_ELEMENTS = 10_000;
const VM_TIMEOUT_MS = 5_000;
const DEFAULT_SIZE = 800;

const FORBIDDEN_PATTERNS = [
  'require(',
  'import ',
  'process.',
  'global.',
  'globalThis.',
  'Function(',
  'constructor[',
  '__proto__',
  '__defineGetter__',
  '__defineSetter__',
  'eval(',
];

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function colorToString(r: number | string, g?: number, b?: number, a?: number): string {
  if (typeof r === 'string') return r;
  if (g === undefined) {
    const gray = Math.round(r);
    return `rgb(${gray},${gray},${gray})`;
  }
  if (b === undefined) {
    const gray = Math.round(r);
    return `rgba(${gray},${gray},${gray},${(g as number) / 255})`;
  }
  if (a !== undefined) {
    return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a / 255})`;
  }
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

function createSeededRandom(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createNoise(rng: () => number): (x: number, y?: number) => number {
  const perm = new Array(512);
  for (let i = 0; i < 256; i++) perm[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  for (let i = 0; i < 256; i++) perm[256 + i] = perm[i];

  function grad(hash: number, x: number, y: number): number {
    const h = hash & 3;
    const u = h < 2 ? x : -x;
    const v = h === 0 || h === 3 ? y : -y;
    return u + v;
  }

  function fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  function noiseLerp(t: number, a: number, b: number): number {
    return a + t * (b - a);
  }

  return (x: number, y: number = 0): number => {
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = fade(xf);
    const v = fade(yf);

    const aa = perm[perm[xi] + yi];
    const ab = perm[perm[xi] + yi + 1];
    const ba = perm[perm[xi + 1] + yi];
    const bb = perm[perm[xi + 1] + yi + 1];

    return (noiseLerp(v,
      noiseLerp(u, grad(aa, xf, yf), grad(ba, xf - 1, yf)),
      noiseLerp(u, grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1)),
    ) + 1) / 2;
  };
}

interface TransformState {
  fillColor: string;
  strokeColor: string;
  doFill: boolean;
  doStroke: boolean;
  strokeW: number;
  strokeCapStyle: string;
  strokeJoinStyle: string;
  textSz: number;
  textAlignH: string;
  textAlignV: string;
  textFontFamily: string;
  translateX: number;
  translateY: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

function defaultState(): TransformState {
  return {
    fillColor: 'rgb(255,255,255)',
    strokeColor: 'rgb(0,0,0)',
    doFill: true,
    doStroke: true,
    strokeW: 1,
    strokeCapStyle: 'round',
    strokeJoinStyle: 'miter',
    textSz: 12,
    textAlignH: 'start',
    textAlignV: 'alphabetic',
    textFontFamily: 'sans-serif',
    translateX: 0,
    translateY: 0,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
  };
}

class SketchContext {
  width = DEFAULT_SIZE;
  height = DEFAULT_SIZE;

  private elements: string[] = [];
  private stateStack: TransformState[] = [];
  private state: TransformState = defaultState();
  private shapeVertices: Array<{ x: number; y: number }> = [];
  private inShape = false;
  private rectModeVal = 'CORNER';

  private styleAttrs(): string {
    const parts: string[] = [];
    parts.push(this.state.doFill ? `fill="${this.state.fillColor}"` : 'fill="none"');
    if (this.state.doStroke) {
      parts.push(`stroke="${this.state.strokeColor}"`);
      parts.push(`stroke-width="${this.state.strokeW}"`);
      parts.push(`stroke-linecap="${this.state.strokeCapStyle}"`);
      parts.push(`stroke-linejoin="${this.state.strokeJoinStyle}"`);
    } else {
      parts.push('stroke="none"');
    }
    return parts.join(' ');
  }

  private transformAttr(): string {
    const parts: string[] = [];
    if (this.state.translateX !== 0 || this.state.translateY !== 0) {
      parts.push(`translate(${this.state.translateX},${this.state.translateY})`);
    }
    if (this.state.rotation !== 0) {
      parts.push(`rotate(${(this.state.rotation * 180) / Math.PI})`);
    }
    if (this.state.scaleX !== 1 || this.state.scaleY !== 1) {
      parts.push(`scale(${this.state.scaleX},${this.state.scaleY})`);
    }
    return parts.length > 0 ? ` transform="${parts.join(' ')}"` : '';
  }

  private addElement(el: string): void {
    if (this.elements.length >= MAX_SVG_ELEMENTS) {
      throw new Error(`SVG element limit exceeded (max ${MAX_SVG_ELEMENTS})`);
    }
    this.elements.push(el);
  }

  createCanvas(w: number, h: number): void {
    this.width = Math.min(Math.max(1, Math.round(w)), MAX_CANVAS_DIM);
    this.height = Math.min(Math.max(1, Math.round(h)), MAX_CANVAS_DIM);
  }

  background(r: number | string, g?: number, b?: number, a?: number): void {
    const col = colorToString(r, g, b, a);
    this.addElement(`<rect x="0" y="0" width="${this.width}" height="${this.height}" fill="${col}" />`);
  }

  fill(r: number | string, g?: number, b?: number, a?: number): void {
    this.state.fillColor = colorToString(r, g, b, a);
    this.state.doFill = true;
  }

  noFill(): void {
    this.state.doFill = false;
  }

  stroke(r: number | string, g?: number, b?: number, a?: number): void {
    this.state.strokeColor = colorToString(r, g, b, a);
    this.state.doStroke = true;
  }

  noStroke(): void {
    this.state.doStroke = false;
  }

  strokeWeight(w: number): void {
    this.state.strokeW = w;
  }

  strokeCap(cap: string): void {
    const capMap: Record<string, string> = { ROUND: 'round', SQUARE: 'square', PROJECT: 'square', BUTT: 'butt' };
    this.state.strokeCapStyle = capMap[cap] || 'round';
  }

  strokeJoin(join: string): void {
    const joinMap: Record<string, string> = { MITER: 'miter', BEVEL: 'bevel', ROUND: 'round' };
    this.state.strokeJoinStyle = joinMap[join] || 'miter';
  }

  rectMode(mode: string): void {
    this.rectModeVal = mode;
  }

  rect(x: number, y: number, w: number, h: number, r?: number): void {
    let rx = x, ry = y;
    if (this.rectModeVal === 'CENTER') {
      rx = x - w / 2;
      ry = y - h / 2;
    }
    const radius = r ? ` rx="${r}" ry="${r}"` : '';
    this.addElement(`<rect x="${rx}" y="${ry}" width="${w}" height="${h}"${radius} ${this.styleAttrs()}${this.transformAttr()} />`);
  }

  ellipse(x: number, y: number, w: number, h?: number): void {
    const rh = h !== undefined ? h : w;
    this.addElement(`<ellipse cx="${x}" cy="${y}" rx="${w / 2}" ry="${rh / 2}" ${this.styleAttrs()}${this.transformAttr()} />`);
  }

  circle(x: number, y: number, d: number): void {
    this.addElement(`<circle cx="${x}" cy="${y}" r="${d / 2}" ${this.styleAttrs()}${this.transformAttr()} />`);
  }

  line(x1: number, y1: number, x2: number, y2: number): void {
    this.addElement(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${this.styleAttrs()}${this.transformAttr()} />`);
  }

  triangle(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): void {
    this.addElement(`<polygon points="${x1},${y1} ${x2},${y2} ${x3},${y3}" ${this.styleAttrs()}${this.transformAttr()} />`);
  }

  quad(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number): void {
    this.addElement(`<polygon points="${x1},${y1} ${x2},${y2} ${x3},${y3} ${x4},${y4}" ${this.styleAttrs()}${this.transformAttr()} />`);
  }

  point(x: number, y: number): void {
    this.addElement(`<circle cx="${x}" cy="${y}" r="${this.state.strokeW / 2}" fill="${this.state.strokeColor}"${this.transformAttr()} />`);
  }

  arc(x: number, y: number, w: number, h: number, start: number, stop: number, mode?: string): void {
    const rx = w / 2;
    const ry = h / 2;
    const x1 = x + rx * Math.cos(start);
    const y1 = y + ry * Math.sin(start);
    const x2 = x + rx * Math.cos(stop);
    const y2 = y + ry * Math.sin(stop);
    const largeArc = stop - start > Math.PI ? 1 : 0;

    let d = `M ${x1} ${y1} A ${rx} ${ry} 0 ${largeArc} 1 ${x2} ${y2}`;
    if (mode === 'CHORD' || mode === 'CLOSE') {
      d += ' Z';
    } else if (mode === 'PIE') {
      d += ` L ${x} ${y} Z`;
    }

    this.addElement(`<path d="${d}" ${this.styleAttrs()}${this.transformAttr()} />`);
  }

  beginShape(): void {
    this.inShape = true;
    this.shapeVertices = [];
  }

  vertex(x: number, y: number): void {
    if (this.inShape) this.shapeVertices.push({ x, y });
  }

  endShape(close?: string): void {
    if (!this.inShape || this.shapeVertices.length === 0) return;
    this.inShape = false;
    const pts = this.shapeVertices.map(v => `${v.x},${v.y}`).join(' ');
    const tag = close === 'CLOSE' ? 'polygon' : 'polyline';
    this.addElement(`<${tag} points="${pts}" ${this.styleAttrs()}${this.transformAttr()} />`);
    this.shapeVertices = [];
  }

  push(): void {
    this.stateStack.push({ ...this.state });
  }

  pop(): void {
    const prev = this.stateStack.pop();
    if (prev) this.state = prev;
  }

  translate(x: number, y: number): void {
    this.state.translateX += x;
    this.state.translateY += y;
  }

  rotate(angle: number): void {
    this.state.rotation += angle;
  }

  scale(sx: number, sy?: number): void {
    this.state.scaleX *= sx;
    this.state.scaleY *= (sy !== undefined ? sy : sx);
  }

  textSize(s: number): void {
    this.state.textSz = s;
  }

  textAlign(h: string, v?: string): void {
    const hMap: Record<string, string> = { LEFT: 'start', CENTER: 'middle', RIGHT: 'end' };
    this.state.textAlignH = hMap[h] || 'start';
    if (v) {
      const vMap: Record<string, string> = { TOP: 'hanging', CENTER: 'central', BOTTOM: 'text-after-edge', BASELINE: 'alphabetic' };
      this.state.textAlignV = vMap[v] || 'alphabetic';
    }
  }

  textFont(font: string): void {
    this.state.textFontFamily = font;
  }

  text(str: string, x: number, y: number): void {
    const escaped = escapeXml(String(str));
    this.addElement(
      `<text x="${x}" y="${y}" font-size="${this.state.textSz}" font-family="${this.state.textFontFamily}" text-anchor="${this.state.textAlignH}" dominant-baseline="${this.state.textAlignV}" ${this.styleAttrs()}${this.transformAttr()}>${escaped}</text>`
    );
  }

  toSvg(): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${this.width}" height="${this.height}" viewBox="0 0 ${this.width} ${this.height}">\n${this.elements.join('\n')}\n</svg>`;
  }
}

function staticAnalysis(code: string): void {
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (code.includes(pattern)) {
      throw new Error(`Forbidden pattern detected: "${pattern}"`);
    }
  }
}

function buildSandboxGlobals(ctx: SketchContext, rng: () => number, noiseFn: (x: number, y?: number) => number): Record<string, unknown> {
  return {
    createCanvas: (w: number, h: number) => ctx.createCanvas(w, h),
    background: (r: number | string, g?: number, b?: number, a?: number) => ctx.background(r, g, b, a),

    rect: (x: number, y: number, w: number, h: number, r?: number) => ctx.rect(x, y, w, h, r),
    ellipse: (x: number, y: number, w: number, h?: number) => ctx.ellipse(x, y, w, h),
    circle: (x: number, y: number, d: number) => ctx.circle(x, y, d),
    line: (x1: number, y1: number, x2: number, y2: number) => ctx.line(x1, y1, x2, y2),
    triangle: (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) => ctx.triangle(x1, y1, x2, y2, x3, y3),
    quad: (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number) => ctx.quad(x1, y1, x2, y2, x3, y3, x4, y4),
    point: (x: number, y: number) => ctx.point(x, y),
    arc: (x: number, y: number, w: number, h: number, start: number, stop: number, mode?: string) => ctx.arc(x, y, w, h, start, stop, mode),
    beginShape: () => ctx.beginShape(),
    vertex: (x: number, y: number) => ctx.vertex(x, y),
    endShape: (close?: string) => ctx.endShape(close),

    fill: (r: number | string, g?: number, b?: number, a?: number) => ctx.fill(r, g, b, a),
    noFill: () => ctx.noFill(),
    stroke: (r: number | string, g?: number, b?: number, a?: number) => ctx.stroke(r, g, b, a),
    noStroke: () => ctx.noStroke(),
    strokeWeight: (w: number) => ctx.strokeWeight(w),
    strokeCap: (cap: string) => ctx.strokeCap(cap),
    strokeJoin: (join: string) => ctx.strokeJoin(join),
    rectMode: (mode: string) => ctx.rectMode(mode),

    push: () => ctx.push(),
    pop: () => ctx.pop(),
    translate: (x: number, y: number) => ctx.translate(x, y),
    rotate: (angle: number) => ctx.rotate(angle),
    scale: (sx: number, sy?: number) => ctx.scale(sx, sy),

    text: (str: string, x: number, y: number) => ctx.text(str, x, y),
    textSize: (s: number) => ctx.textSize(s),
    textAlign: (h: string, v?: string) => ctx.textAlign(h, v),
    textFont: (font: string) => ctx.textFont(font),

    color: (r: number | string, g?: number, b?: number, a?: number) => colorToString(r, g, b, a),
    lerpColor: (c1: string, c2: string, t: number) => {
      const parse = (c: string) => {
        const m = c.match(/\d+(\.\d+)?/g);
        return m ? m.map(Number) : [0, 0, 0];
      };
      const cv1 = parse(c1);
      const cv2 = parse(c2);
      const r = Math.round(cv1[0] + (cv2[0] - cv1[0]) * t);
      const g = Math.round(cv1[1] + (cv2[1] - cv1[1]) * t);
      const b = Math.round(cv1[2] + (cv2[2] - cv1[2]) * t);
      return `rgb(${r},${g},${b})`;
    },

    random: (lo?: number, hi?: number) => {
      if (lo === undefined) return rng();
      if (hi === undefined) return rng() * lo;
      return lo + rng() * (hi - lo);
    },
    noise: noiseFn,
    map: (value: number, start1: number, stop1: number, start2: number, stop2: number) =>
      start2 + (stop2 - start2) * ((value - start1) / (stop1 - start1)),
    constrain: (n: number, low: number, high: number) => Math.min(Math.max(n, low), high),
    dist: (x1: number, y1: number, x2: number, y2: number) =>
      Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2),
    lerp: (start: number, stop: number, amt: number) => start + (stop - start) * amt,
    sin: Math.sin,
    cos: Math.cos,
    tan: Math.tan,
    asin: Math.asin,
    acos: Math.acos,
    atan2: Math.atan2,
    abs: Math.abs,
    floor: Math.floor,
    ceil: Math.ceil,
    round: Math.round,
    sqrt: Math.sqrt,
    pow: Math.pow,
    log: Math.log,
    exp: Math.exp,
    min: Math.min,
    max: Math.max,

    PI: Math.PI,
    TWO_PI: Math.PI * 2,
    HALF_PI: Math.PI / 2,
    QUARTER_PI: Math.PI / 4,
    TAU: Math.PI * 2,
    CLOSE: 'CLOSE',
    CENTER: 'CENTER',
    CORNER: 'CORNER',
    LEFT: 'LEFT',
    RIGHT: 'RIGHT',
    TOP: 'TOP',
    BOTTOM: 'BOTTOM',
    BASELINE: 'BASELINE',
    ROUND: 'ROUND',
    SQUARE: 'SQUARE',
    PROJECT: 'PROJECT',
    MITER: 'MITER',
    BEVEL: 'BEVEL',
    PIE: 'PIE',
    CHORD: 'CHORD',

    get width() { return ctx.width; },
    get height() { return ctx.height; },

    Array,
    Object,
    Math,
    Number,
    String,
    Boolean,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    JSON: { parse: JSON.parse, stringify: JSON.stringify },
    console: { log: () => {} },
    undefined,
    NaN,
    Infinity,
  };
}

export async function renderSketch(
  code: string,
  width: number = DEFAULT_SIZE,
  height: number = DEFAULT_SIZE,
  seed?: number,
): Promise<Buffer> {
  if (Buffer.byteLength(code, 'utf8') > MAX_CODE_SIZE) {
    throw new Error(`Code too large (max ${MAX_CODE_SIZE / 1024}KB)`);
  }

  staticAnalysis(code);

  const ctx = new SketchContext();
  ctx.createCanvas(width, height);

  const rng = createSeededRandom(seed ?? Date.now());
  const noiseFn = createNoise(rng);
  const globals = buildSandboxGlobals(ctx, rng, noiseFn);

  const sandbox = vm.createContext(globals, {
    codeGeneration: { strings: false, wasm: false },
  });

  try {
    vm.runInContext(code, sandbox, {
      timeout: VM_TIMEOUT_MS,
      filename: 'sketch.js',
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes('Script execution timed out')) {
      throw new Error('Sketch execution timed out (5s limit)');
    }
    throw new Error(`Sketch execution error: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }

  const svg = ctx.toSvg();
  return sharp(Buffer.from(svg)).png().toBuffer();
}

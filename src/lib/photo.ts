// Tratamento da foto no navegador: remove o fundo e aplica o padrão da loja
// (fundo preto, 675×900, frasco centralizado), devolvendo um WebP pronto para enviar.

export const OUT_W = 675;
export const OUT_H = 900;
const MODEL_SIZE = 320;

type Ort = {
  env: { wasm: { wasmPaths: string; numThreads: number } };
  InferenceSession: { create: (url: string, opts?: unknown) => Promise<OrtSession> };
  Tensor: new (type: string, data: Float32Array, dims: number[]) => unknown;
};
type OrtSession = { inputNames: string[]; outputNames: string[]; run: (feeds: Record<string, unknown>) => Promise<Record<string, { data: Float32Array }>> };

// Motor de IA (onnxruntime-web) vem da CDN; o modelo de recorte (u2netp, 4,4 MB) fica no próprio painel.
const ORT_CDN = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.1/dist/';
let sessionPromise: Promise<OrtSession> | null = null;

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[data-src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.dataset.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Não foi possível carregar o recortador de fundo.'));
    document.head.appendChild(s);
  });
}

async function getSession(): Promise<OrtSession> {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      await loadScript(ORT_CDN + 'ort.min.js');
      const ort = (window as unknown as { ort: Ort }).ort;
      ort.env.wasm.wasmPaths = ORT_CDN;
      ort.env.wasm.numThreads = 1;
      return ort.InferenceSession.create('/models/u2netp.onnx', { executionProviders: ['wasm'] });
    })();
    sessionPromise.catch(() => (sessionPromise = null));
  }
  return sessionPromise;
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Não foi possível abrir a imagem.'));
    img.src = src;
  });
}

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// Fundo já escuro (como as fotos do fornecedor)? Então não precisa recortar.
function borderIsDark(img: HTMLImageElement) {
  const w = 120;
  const h = Math.round((img.naturalHeight / img.naturalWidth) * w) || 120;
  const c = canvas(w, h);
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;
  let dark = 0;
  let total = 0;
  for (let x = 0; x < w; x++) for (const y of [0, 1, h - 2, h - 1]) {
    const i = (y * w + x) * 4;
    total++;
    if (Math.max(d[i], d[i + 1], d[i + 2]) < 28) dark++;
  }
  for (let y = 0; y < h; y++) for (const x of [0, 1, w - 2, w - 1]) {
    const i = (y * w + x) * 4;
    total++;
    if (Math.max(d[i], d[i + 1], d[i + 2]) < 28) dark++;
  }
  return dark / total > 0.9;
}

// Máscara de primeiro plano (0..1) no tamanho da imagem, via modelo U²-Net (u2netp).
async function foregroundMask(img: HTMLImageElement): Promise<Float32Array> {
  const session = await getSession();
  const ort = (window as unknown as { ort: Ort }).ort;
  const c = canvas(MODEL_SIZE, MODEL_SIZE);
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0, MODEL_SIZE, MODEL_SIZE);
  const px = ctx.getImageData(0, 0, MODEL_SIZE, MODEL_SIZE).data;
  const n = MODEL_SIZE * MODEL_SIZE;
  let max = 0;
  for (let i = 0; i < n * 4; i += 4) max = Math.max(max, px[i], px[i + 1], px[i + 2]);
  max = max || 255;
  const mean = [0.485, 0.456, 0.406];
  const std = [0.229, 0.224, 0.225];
  const input = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) {
    for (let ch = 0; ch < 3; ch++) input[ch * n + i] = (px[i * 4 + ch] / max - mean[ch]) / std[ch];
  }
  const feeds = { [session.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, MODEL_SIZE, MODEL_SIZE]) };
  const out = await session.run(feeds);
  const pred = out[session.outputNames[0]].data;
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < n; i++) {
    lo = Math.min(lo, pred[i]);
    hi = Math.max(hi, pred[i]);
  }
  const range = hi - lo || 1;
  // Redimensiona a máscara para o tamanho original
  const m = canvas(MODEL_SIZE, MODEL_SIZE);
  const mctx = m.getContext('2d')!;
  const mdata = mctx.createImageData(MODEL_SIZE, MODEL_SIZE);
  for (let i = 0; i < n; i++) {
    const v = Math.round(((pred[i] - lo) / range) * 255);
    mdata.data[i * 4] = mdata.data[i * 4 + 1] = mdata.data[i * 4 + 2] = v;
    mdata.data[i * 4 + 3] = 255;
  }
  mctx.putImageData(mdata, 0, 0);
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const big = canvas(W, H);
  const bctx = big.getContext('2d')!;
  bctx.imageSmoothingQuality = 'high';
  bctx.drawImage(m, 0, 0, W, H);
  const bd = bctx.getImageData(0, 0, W, H).data;
  const mask = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) mask[i] = bd[i * 4] / 255;
  return mask;
}

function bboxFromAlpha(alpha: (i: number) => number, W: number, H: number, thr: number) {
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (alpha(y * W + x) > thr) {
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return { x: 0, y: 0, w: W, h: H };
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

export type Processed = { blob: Blob; url: string; method: 'recorte' | 'fundo-escuro' };

export async function processPhoto(file: Blob): Promise<Processed> {
  const srcUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(srcUrl);
    const W = img.naturalWidth;
    const H = img.naturalHeight;
    const src = canvas(W, H);
    const sctx = src.getContext('2d')!;
    sctx.drawImage(img, 0, 0);
    const sd = sctx.getImageData(0, 0, W, H);
    let method: Processed['method'];
    let alphaAt: (i: number) => number;

    if (borderIsDark(img)) {
      method = 'fundo-escuro';
      alphaAt = (i) => (Math.max(sd.data[i * 4], sd.data[i * 4 + 1], sd.data[i * 4 + 2]) > 30 ? 1 : 0);
    } else {
      method = 'recorte';
      const mask = await foregroundMask(img);
      for (let i = 0; i < W * H; i++) sd.data[i * 4 + 3] = Math.round(mask[i] * 255);
      sctx.putImageData(sd, 0, 0);
      alphaAt = (i) => mask[i];
    }

    const box = bboxFromAlpha(alphaAt, W, H, 0.35);
    const scale = Math.min((OUT_W * 0.86) / box.w, (OUT_H * 0.9) / box.h);
    const dw = Math.round(box.w * scale);
    const dh = Math.round(box.h * scale);
    const out = canvas(OUT_W, OUT_H);
    const octx = out.getContext('2d')!;
    octx.fillStyle = '#000';
    octx.fillRect(0, 0, OUT_W, OUT_H);
    octx.imageSmoothingQuality = 'high';
    octx.drawImage(src, box.x, box.y, box.w, box.h, Math.round((OUT_W - dw) / 2), Math.round((OUT_H - dh) / 2), dw, dh);
    const blob: Blob = await new Promise((resolve, reject) =>
      out.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao gerar a imagem.'))), 'image/webp', 0.86)
    );
    return { blob, url: URL.createObjectURL(blob), method };
  } finally {
    URL.revokeObjectURL(srcUrl);
  }
}

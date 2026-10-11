/**
 * Decode JPEG bytes to RGB888 for Tight JPEG rectangles.
 * Browser: createImageBitmap / Image; Node: jpeg-js when available.
 */

function isNodeRuntime(): boolean {
  return typeof process !== 'undefined' && !!(process as { versions?: { node?: string } }).versions?.node;
}

async function decodeWithJpegJs(
  jpeg: Uint8Array,
): Promise<{ width: number; height: number; rgb: Uint8Array }> {
  const jpegJs = await import('jpeg-js');
  const decoded = jpegJs.decode(jpeg.slice(), { useTArray: true });
  const rgb = new Uint8Array(decoded.width * decoded.height * 3);
  const src = decoded.data;
  for (let i = 0, j = 0; i < src.length; i += 4, j += 3) {
    rgb[j] = src[i]!;
    rgb[j + 1] = src[i + 1]!;
    rgb[j + 2] = src[i + 2]!;
  }
  return { width: decoded.width, height: decoded.height, rgb };
}

export async function decodeJpegToRgb(
  jpeg: Uint8Array,
  expectW: number,
  expectH: number,
): Promise<{ width: number; height: number; rgb: Uint8Array }> {
  void expectW;
  void expectH;

  if (isNodeRuntime()) {
    try {
      return await decodeWithJpegJs(jpeg);
    } catch {
      /* fall through to browser APIs (e.g. happy-dom) */
    }
  }

  if (typeof createImageBitmap === 'function' && typeof OffscreenCanvas !== 'undefined') {
    try {
      const copy = jpeg.slice();
      const blob = new Blob([copy], { type: 'image/jpeg' });
      const bmp = await createImageBitmap(blob);
      try {
        const w = bmp.width;
        const h = bmp.height;
        const canvas = new OffscreenCanvas(w, h);
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('OffscreenCanvas 2d unavailable');
        ctx.drawImage(bmp, 0, 0);
        const img = ctx.getImageData(0, 0, w, h);
        const rgb = new Uint8Array(w * h * 3);
        for (let i = 0, j = 0; i < img.data.length; i += 4, j += 3) {
          rgb[j] = img.data[i]!;
          rgb[j + 1] = img.data[i + 1]!;
          rgb[j + 2] = img.data[i + 2]!;
        }
        return { width: w, height: h, rgb };
      } finally {
        bmp.close();
      }
    } catch {
      /* fall through */
    }
  }

  if (typeof document !== 'undefined' && typeof Image !== 'undefined') {
    const copy = jpeg.slice();
    const url = URL.createObjectURL(new Blob([copy], { type: 'image/jpeg' }));
    try {
      const imgEl = await loadHtmlImage(url);
      const canvas = document.createElement('canvas');
      canvas.width = imgEl.naturalWidth;
      canvas.height = imgEl.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas 2d unavailable');
      ctx.drawImage(imgEl, 0, 0);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const rgb = new Uint8Array(canvas.width * canvas.height * 3);
      for (let i = 0, j = 0; i < data.data.length; i += 4, j += 3) {
        rgb[j] = data.data[i]!;
        rgb[j + 1] = data.data[i + 1]!;
        rgb[j + 2] = data.data[i + 2]!;
      }
      return { width: canvas.width, height: canvas.height, rgb };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  // Last resort (tests without jpeg-js already handled above)
  try {
    return await decodeWithJpegJs(jpeg);
  } catch {
    throw new Error('No JPEG decoder available in this environment');
  }
}

function loadHtmlImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('JPEG Image decode failed'));
    img.src = url;
  });
}

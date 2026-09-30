// 업로드 이미지를 캔버스로 축소·압축해 base64(JPEG) 반환.
// Vercel 요청 본문 4.5MB 제한을 넘지 않도록 작지에 저장되는 이미지 용량을 줄인다.
export async function compressImageFile(
  file: File,
  maxDim = 1400,
  quality = 0.82,
): Promise<string> {
  const readAsDataURL = (f: File) =>
    new Promise<string>((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result as string);
      fr.onerror = rej;
      fr.readAsDataURL(f);
    });

  const original = await readAsDataURL(file);
  // 이미지가 아니거나 SVG면 압축하지 않고 그대로
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") return original;

  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = rej;
      im.src = original;
    });
    let w = img.naturalWidth || img.width;
    let h = img.naturalHeight || img.height;
    if (!w || !h) return original;
    if (w > maxDim || h > maxDim) {
      const s = maxDim / Math.max(w, h);
      w = Math.round(w * s);
      h = Math.round(h * s);
    }
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return original;
    ctx.fillStyle = "#ffffff"; // 투명 PNG → JPEG 변환 시 흰 배경
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const out = canvas.toDataURL("image/jpeg", quality);
    // 압축 결과가 더 작을 때만 사용
    return out.length < original.length ? out : original;
  } catch {
    return original;
  }
}

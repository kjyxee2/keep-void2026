// 업로드 이미지 검사. 확장자나 Content-Type이 아니라 파일 앞부분 바이트(magic bytes)로 판단한다.

// Claude API 이미지 한도는 base64 기준 10MB. 원본 7.5MiB → base64 정확히 10MiB
export const MAX_IMAGE_BYTES = 7.5 * 1024 * 1024;

export type ImageMime = 'image/jpeg' | 'image/png' | 'image/webp';

const HEIC_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1']);
const str = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...b.subarray(from, to));

export function sniffImage(b: Uint8Array): ImageMime | 'image/heic' | null {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if ([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((x, i) => b[i] === x)) return 'image/png';
  if (str(b, 0, 4) === 'RIFF' && str(b, 8, 12) === 'WEBP') return 'image/webp';
  if (str(b, 4, 8) === 'ftyp' && HEIC_BRANDS.has(str(b, 8, 12))) return 'image/heic';
  return null;
}

export type ImageCheck = { ok: true; mime: ImageMime } | { ok: false; status: number; error: string };

export function checkImage(b: Uint8Array): ImageCheck {
  if (b.length === 0) return { ok: false, status: 400, error: '사진 파일이 비어 있어요. 다시 찍어 주세요.' };
  if (b.length > MAX_IMAGE_BYTES) return { ok: false, status: 413, error: '사진이 너무 커요(7.5MB까지). 다시 찍거나 작게 줄여 주세요.' };
  const mime = sniffImage(b);
  if (mime === 'image/heic') return { ok: false, status: 415,
    error: 'HEIC(아이폰 기본 형식) 사진은 읽을 수 없어요. 카메라로 바로 찍거나 JPG, PNG로 바꿔 올려 주세요.' };
  if (!mime) return { ok: false, status: 415, error: 'JPG, PNG, WEBP 사진만 올릴 수 있어요.' };
  return { ok: true, mime };
}

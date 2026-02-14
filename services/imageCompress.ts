/**
 * localStorage 용량 제한(약 5MB)으로 인한 setItem 오류 방지를 위해
 * 증빙 이미지(통장사본, 신분증 등)를 압축합니다.
 * 최대 800px, JPEG 품질 0.6으로 압축하여 typically 100~300KB 수준으로 축소합니다.
 */
export function compressImageForStorage(dataUrl: string, maxWidth = 800, quality = 0.6): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error('이미지 로드 실패'));
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', quality);
        resolve(compressed);
      } catch {
        resolve(dataUrl);
      }
    };
    img.src = dataUrl;
  });
}

// 폰 카메라 사진(보통 3~8MB)을 그대로 base64로 서버에 보내면 Vercel 서버리스 함수의
// 요청 본문 크기 제한(약 4.5MB)에 걸리거나, 느린 네트워크에서 체감 속도가 매우 나빠진다.
// AI 물체 인식에는 고해상도가 필요 없으므로 업로드 전에 브라우저에서 축소+재압축한다.
// 부수 효과: 입력 포맷(HEIC 등)과 무관하게 항상 image/jpeg 로 정규화된다.

export interface ResizedImage {
  dataUrl: string;
  mediaType: "image/jpeg";
}

export async function resizeImageForUpload(
  file: File,
  maxDimension = 1024,
  quality = 0.8
): Promise<ResizedImage> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("이미지를 열 수 없어요."));
      image.src = objectUrl;
    });

    let { width, height } = img;
    if (width > maxDimension || height > maxDimension) {
      if (width > height) {
        height = Math.round((height * maxDimension) / width);
        width = maxDimension;
      } else {
        width = Math.round((width * maxDimension) / height);
        height = maxDimension;
      }
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("이미지를 처리할 수 없어요.");
    ctx.drawImage(img, 0, 0, width, height);

    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    return { dataUrl, mediaType: "image/jpeg" };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

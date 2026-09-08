const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "";
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || "";

export async function uploadProfileimage(file: File): Promise<string> {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error("Thiếu cấu hình Cloudinary (VITE_CLOUDINARY_CLOUD_NAME, VITE_CLOUDINARY_UPLOAD_PRESET)");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);
  formData.append("folder", "cafe-management/profile-images");

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
    method: "POST",
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) {
    const msg = (data && (data.error?.message || data.message)) || "Upload ảnh profile thất bại";
    throw new Error(String(msg));
  }

  if (!data.secure_url) {
    throw new Error("Không nhận được URL ảnh profile từ Cloudinary");
  }

  return data.secure_url as string;
}


export async function uploadImagesToCloudinary(files: File[]): Promise<string[]> {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    throw new Error("Thiếu cấu hình Cloudinary");
  }

  const limitedFiles = files.slice(0, 5);

  const uploads = limitedFiles.map(async (file) => {
    const form = new FormData();
    form.append("file", file);
    form.append("upload_preset", uploadPreset);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: "POST",
      body: form,
    });

    if (!res.ok) {
      throw new Error("Upload ảnh thất bại");
    }

    const data = await res.json();
    if (!data.secure_url) {
      throw new Error("Không lấy được URL ảnh");
    }

    return String(data.secure_url);
  });

  return Promise.all(uploads);
}

export async function uploadFileToCloudinary(file: File, folder = "cafe-management/user-documents"): Promise<string> {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    throw new Error("Thiếu cấu hình Cloudinary");
  }

  const form = new FormData();
  form.append("file", file);
  form.append("upload_preset", uploadPreset);
  form.append("folder", folder);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
    method: "POST",
    body: form,
  });

  const data = await res.json();
  if (!res.ok) {
    const msg = (data && (data.error?.message || data.message)) || "Upload file thất bại";
    throw new Error(String(msg));
  }

  if (!data.secure_url) {
    throw new Error("Không lấy được URL file từ Cloudinary");
  }

  return String(data.secure_url);
}

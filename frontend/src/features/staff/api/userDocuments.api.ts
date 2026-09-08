import api from "../../../lib/http/axios";
import { uploadFileToCloudinary } from "../../shared/utils/cloudinaryUpload";

export type UserDocument = {
  id: number;
  userId: number;
  documentType: string;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  uploadedAt: string;
};

export const userDocumentsApi = {
  listMine: () =>
    api
      .get<{ documents: UserDocument[] }>("/user-documents/me/documents")
      .then((r) => r.data),

  list: (userId: number) =>
    api
      .get<{ documents: UserDocument[] }>(`/user-documents/${userId}/documents`)
      .then((r) => r.data),

  uploadMine: (documentType: string, file: File) => {
    return uploadFileToCloudinary(file).then((fileUrl) =>
      api
        .post<UserDocument>("/user-documents/me/documents", {
          documentType,
          fileName: file.name,
          fileUrl,
          mimeType: file.type || "application/octet-stream",
        })
        .then((r) => r.data)
    );
  },

  upload: (userId: number, documentType: string, file: File) => {
    return uploadFileToCloudinary(file).then((fileUrl) =>
      api
        .post<UserDocument>(`/user-documents/${userId}/documents`, {
          documentType,
          fileName: file.name,
          fileUrl,
          mimeType: file.type || "application/octet-stream",
        })
        .then((r) => r.data)
    );
  },
};


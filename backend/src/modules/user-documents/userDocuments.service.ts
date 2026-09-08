import { ApiError } from "../../utils/apiError";
import { env } from "../../config/env";
import { pool } from "../../config/db";
import { v2 as cloudinary } from "cloudinary";
import { insertUserDocument, listUserDocuments } from "./userDocuments.repo";
import type { UserDocumentType } from "./userDocuments.schema";

function toFullFileUrl(pathVal: string | null | undefined): string | null {
  if (!pathVal || typeof pathVal !== "string") return null;
  if (pathVal.startsWith("http://") || pathVal.startsWith("https://")) return pathVal;
  const base = (env.API_PUBLIC_URL || "").replace(/\/$/, "");
  return base ? `${base}${pathVal.startsWith("/") ? pathVal : "/" + pathVal}` : pathVal;
}

type ReqUser = {
  sub?: number | string;
  id?: number | string;
  roles?: string[];
  storeId?: number | string;
  storeIds?: Array<number | string>;
};

function getActorUserId(reqUser: ReqUser | undefined): number {
  const raw = reqUser?.sub ?? reqUser?.id;
  const userId = Number(raw);
  if (!Number.isFinite(userId) || userId <= 0) {
    throw new ApiError(401, "Unauthorized");
  }
  return userId;
}

function getActorRoleSet(reqUser: ReqUser | undefined): Set<string> {
  return new Set((Array.isArray(reqUser?.roles) ? reqUser.roles : []).map((role) => String(role).trim().toLowerCase()));
}

function getActorStoreIds(reqUser: ReqUser | undefined): number[] {
  const ids = Array.isArray(reqUser?.storeIds)
    ? reqUser.storeIds.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0)
    : [];
  const single = Number(reqUser?.storeId);
  if (Number.isFinite(single) && single > 0) ids.push(single);
  return [...new Set(ids)];
}

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || "";
const API_KEY = process.env.CLOUDINARY_API_KEY || "";
const API_SECRET = process.env.CLOUDINARY_API_SECRET || "";
const CLOUD_FOLDER = process.env.CLOUDINARY_FOLDER || "cafe-management/user-documents";
let cloudinaryConfigured = false;

function ensureCloudinaryConfigured() {
  if (cloudinaryConfigured) return;
  if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
    throw new ApiError(
      500,
      "Thi?u c?u hình Cloudinary (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET)"
    );
  }
  cloudinary.config({
    cloud_name: CLOUD_NAME,
    api_key: API_KEY,
    api_secret: API_SECRET,
    secure: true,
  });
  cloudinaryConfigured = true;
}

async function uploadDocumentToCloudinary(params: { buffer: Buffer; publicId: string }) {
  ensureCloudinaryConfigured();

  return new Promise<{ secureUrl: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: CLOUD_FOLDER,
        public_id: params.publicId,
        resource_type: "auto",
        overwrite: true,
      },
      (error, result) => {
        if (error || !result?.secure_url) {
          return reject(error || new Error("Cloudinary upload failed"));
        }
        resolve({ secureUrl: result.secure_url });
      }
    );
    stream.end(params.buffer);
  });
}

async function assertCanManageUser(reqUser: ReqUser | undefined, userId: number) {
  if (!reqUser) throw new ApiError(401, "Unauthorized");

  const actorUserId = getActorUserId(reqUser);
  const roleSet = getActorRoleSet(reqUser);

  if (actorUserId === userId) return;
  if (roleSet.has("admin") || roleSet.has("district_manager") || roleSet.has("hr_manager")) return;

  if (roleSet.has("store_manager")) {
    const storeIds = getActorStoreIds(reqUser);
    if (storeIds.length === 0) {
      throw new ApiError(403, "Không có quy?n thao tác h? so nhân viên này");
    }

    const check = await pool.query(
      `SELECT 1
       FROM user_stores
       WHERE user_id = $1
         AND store_id = ANY($2::bigint[])
       LIMIT 1`,
      [userId, storeIds]
    );

    if (check.rows.length > 0) return;
    throw new ApiError(403, "Không có quy?n thao tác h? so nhân viên ngoài c?a hàng ph? trách");
  }

  throw new ApiError(403, "Không có quy?n thao tác h? so nhân viên này");
}

function validateMimeType(documentType: UserDocumentType, mimeType: string) {
  const lower = mimeType.toLowerCase();
  if (documentType === "profile_photo") {
    const isImage =
      lower.startsWith("image/") &&
      (lower === "image/jpeg" || lower === "image/png" || lower === "image/jpg" || lower === "image/webp");
    const isPdf = lower === "application/pdf";
    if (!isImage && !isPdf) {
      throw new ApiError(400, "?nh th? ch? ch?p nh?n file ?nh (jpg, jpeg, png, webp) ho?c PDF");
    }
  } else if (lower !== "application/pdf") {
    throw new ApiError(400, "Tài li?u ch? ch?p nh?n d?nh d?ng PDF");
  }
}

export async function handleUploadUserDocument(params: {
  reqUser: ReqUser | undefined;
  userId: number;
  documentType: UserDocumentType;
  originalName: string;
  mimeType: string;
  buffer: Buffer;
}) {
  await assertCanManageUser(params.reqUser, params.userId);
  validateMimeType(params.documentType, params.mimeType);

  const safeName = params.originalName.replace(/[^a-zA-Z0-9_.-]/g, "_");
  const timestamp = Date.now();
  const publicId = `${params.userId}_${params.documentType}_${timestamp}_${safeName}`;
  const uploaded = await uploadDocumentToCloudinary({
    buffer: params.buffer,
    publicId,
  });
  const fileUrl = uploaded.secureUrl;

  const row = await insertUserDocument({
    userId: params.userId,
    documentType: params.documentType,
    fileName: params.originalName,
    fileUrl,
    mimeType: params.mimeType,
  });

  return {
    id: row.id,
    userId: row.user_id,
    documentType: row.document_type,
    fileName: row.file_name,
    fileUrl: toFullFileUrl(row.file_url) ?? row.file_url,
    mimeType: row.mime_type,
    uploadedAt: row.uploaded_at,
  };
}

export async function handleSaveUserDocument(params: {
  reqUser: ReqUser | undefined;
  userId: number;
  documentType: UserDocumentType;
  fileName: string;
  fileUrl: string;
  mimeType: string;
}) {
  await assertCanManageUser(params.reqUser, params.userId);
  validateMimeType(params.documentType, params.mimeType);

  const row = await insertUserDocument({
    userId: params.userId,
    documentType: params.documentType,
    fileName: params.fileName,
    fileUrl: params.fileUrl,
    mimeType: params.mimeType,
  });

  return {
    id: row.id,
    userId: row.user_id,
    documentType: row.document_type,
    fileName: row.file_name,
    fileUrl: toFullFileUrl(row.file_url) ?? row.file_url,
    mimeType: row.mime_type,
    uploadedAt: row.uploaded_at,
  };
}

export async function getUserDocuments(params: { reqUser: ReqUser | undefined; userId: number }) {
  await assertCanManageUser(params.reqUser, params.userId);
  const rows = await listUserDocuments(params.userId);
  return {
    documents: rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      documentType: row.document_type,
      fileName: row.file_name,
      fileUrl: toFullFileUrl(row.file_url) ?? row.file_url,
      mimeType: row.mime_type,
      uploadedAt: row.uploaded_at,
    })),
  };
}

export async function getMyUserDocuments(params: { reqUser: ReqUser | undefined }) {
  const userId = getActorUserId(params.reqUser);
  return getUserDocuments({ reqUser: params.reqUser, userId });
}

export async function handleUploadMyUserDocument(params: {
  reqUser: ReqUser | undefined;
  documentType: UserDocumentType;
  originalName: string;
  mimeType: string;
  buffer: Buffer;
}) {
  const userId = getActorUserId(params.reqUser);
  return handleUploadUserDocument({
    reqUser: params.reqUser,
    userId,
    documentType: params.documentType,
    originalName: params.originalName,
    mimeType: params.mimeType,
    buffer: params.buffer,
  });
}

export async function handleSaveMyUserDocument(params: {
  reqUser: ReqUser | undefined;
  documentType: UserDocumentType;
  fileName: string;
  fileUrl: string;
  mimeType: string;
}) {
  const userId = getActorUserId(params.reqUser);
  return handleSaveUserDocument({
    reqUser: params.reqUser,
    userId,
    documentType: params.documentType,
    fileName: params.fileName,
    fileUrl: params.fileUrl,
    mimeType: params.mimeType,
  });
}


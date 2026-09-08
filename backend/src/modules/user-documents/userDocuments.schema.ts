import { z } from "zod";

export const allowedDocumentTypes = ["profile_photo", "degree", "certificate", "health_record"] as const;

export type UserDocumentType = (typeof allowedDocumentTypes)[number];

export const uploadUserDocumentSchema = z.object({
  userId: z.coerce.number().int().positive(),
  documentType: z.enum(allowedDocumentTypes),
});

export const saveUserDocumentMetadataSchema = uploadUserDocumentSchema.extend({
  fileName: z.string().trim().min(1).max(255),
  fileUrl: z.string().trim().url().max(2048),
  mimeType: z.string().trim().min(1).max(120),
});


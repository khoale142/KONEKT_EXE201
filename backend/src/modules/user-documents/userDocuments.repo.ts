import { pool } from "../../config/db";
import type { UserDocumentType } from "./userDocuments.schema";

export type UserDocumentRow = {
  id: number;
  user_id: number;
  document_type: UserDocumentType | string;
  file_name: string;
  file_url: string;
  mime_type: string;
  uploaded_at: string;
};

export async function insertUserDocument(params: {
  userId: number;
  documentType: UserDocumentType;
  fileName: string;
  fileUrl: string;
  mimeType: string;
}) {
  const r = await pool.query(
    `
      INSERT INTO user_documents (user_id, document_type, file_name, file_url, mime_type)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `,
    [params.userId, params.documentType, params.fileName, params.fileUrl, params.mimeType]
  );
  return r.rows[0] as UserDocumentRow;
}

export async function listUserDocuments(userId: number) {
  const r = await pool.query(
    `
      SELECT id, user_id, document_type, file_name, file_url, mime_type, uploaded_at
      FROM user_documents
      WHERE user_id = $1
      ORDER BY uploaded_at DESC, id DESC
    `,
    [userId]
  );
  return r.rows as UserDocumentRow[];
}


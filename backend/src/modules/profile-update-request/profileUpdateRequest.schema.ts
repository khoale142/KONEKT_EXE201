import { z } from "zod";

/**
 * Các trường được phép trong một phiếu yêu cầu (JSON `requested_data`).
 * Đồng bộ với ALLOWED_KEYS trong profileUpdateRequest.service.ts.
 * Route POST hiện chưa dùng schema này để parse — giữ làm tài liệu / bảo vệ sau này.
 */
const requestedDataShape = z
  .object({
    requestGroup: z.string().trim().max(200).optional().nullable(),
    requestNote: z.string().trim().max(2000).optional().nullable(),
    fullName: z.string().trim().min(1, "Họ tên không được để trống").max(200).optional(),
    phone: z.string().trim().max(20).optional().nullable(),
    email: z.union([z.string().email("Email không hợp lệ").max(200), z.literal("")]).optional().nullable(),
    bankName: z.string().trim().max(200).optional().nullable(),
    bankAccountNumber: z.string().trim().max(100).optional().nullable(),
    bankAccountHolder: z.string().trim().max(200).optional().nullable(),
    bankBranch: z.string().trim().max(200).optional().nullable(),
    gender: z.string().trim().max(50).optional().nullable(),
    birthday: z.string().trim().max(40).optional().nullable(),
    dateOfBirth: z.string().trim().max(40).optional().nullable(),
    permanentAddress: z.string().trim().max(500).optional().nullable(),
    currentAddress: z.string().trim().max(500).optional().nullable(),
    idCardNumber: z.string().trim().max(50).optional().nullable(),
    idCardIssueDate: z.string().trim().max(40).optional().nullable(),
    idCardIssuePlace: z.string().trim().max(200).optional().nullable(),
    documentNote: z.string().trim().max(2000).optional().nullable(),
    emergencyContactName: z.string().trim().max(200).optional().nullable(),
    emergencyContactPhone: z.string().trim().max(20).optional().nullable(),
    emergencyContactRelationship: z.string().trim().max(100).optional().nullable(),
  });

export const createProfileUpdateRequestSchema = z.object({
  requestedData: requestedDataShape,
});

export const rejectProfileUpdateRequestSchema = z.object({
  rejectReason: z.string().trim().max(500).optional(),
});

export const listProfileUpdateRequestsQuerySchema = z.object({
  storeId: z.coerce.number().int().positive(),
  status: z
    .enum([
      "pending",
      "pending_sm",
      "pending_hr",
      "approved",
      "rejected",
      "rejected_by_sm",
      "rejected_by_hr",
    ])
    .optional(),
});

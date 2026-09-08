import { Request, Response } from "express";
import * as svc from "./audit.service";

/* 1. Store data */
export async function getStoreData(req: Request, res: Response) {
  const storeId   = req.query.store_id   ? Number(req.query.store_id)          : undefined;
  const startDate = req.query.startDate  ? String(req.query.startDate)          : undefined;
  const endDate   = req.query.endDate    ? String(req.query.endDate)            : undefined;
  const data = await svc.getStoreAuditData(storeId, startDate, endDate);
  res.json({ data });
}

/* 2. Audit flags */
export async function getFlags(req: Request, res: Response) {
  const storeId = req.query.store_id ? Number(req.query.store_id) : undefined;
  const data = await svc.getAuditFlags(storeId);
  res.json({ data });
}

export async function patchResolveFlag(req: Request, res: Response) {
  const { store_id, flag_type, flag_key } = req.body;
  if (!store_id || !flag_type || !flag_key) {
    return res.status(400).json({ message: "Thiếu store_id, flag_type hoặc flag_key" });
  }
  const user = (req as any).user;
  const data = await svc.resolveFlag(Number(store_id), flag_type, flag_key, user?.username || "unknown");
  res.json({ data });
}

/* 3. Audit reports — role-aware data isolation */
export async function getReports(req: Request, res: Response) {
  const user = (req as any).user as { sub: string; roles?: string[]; storeIds?: (number | string)[] };
  const roles = user?.roles || [];
  const queryStoreId = req.query.store_id ? Number(req.query.store_id) : undefined;

  // ───── DEBUG: 2 dòng quan trọng nhất để trace SM flow ─────
  console.log("[AUDIT GET /reports] user.sub=%s portal=%s roles=%j storeIds=%j",
    user?.sub, (user as any)?.portal, roles, user?.storeIds);
  console.log("[AUDIT GET /reports] query.store_id=%s → queryStoreId=%s",
    req.query.store_id, queryStoreId);
  // ──────────────────────────────────────────────────────────

  // Auditor / Admin / DM → thấy toàn bộ (hoặc filter theo query param)
  const isHighRole = roles.some((r) => ["auditor", "district_manager", "admin"].includes(r));
  if (isHighRole) {
    const data = await svc.getAuditReports({ storeId: queryStoreId });
    return res.json({ data });
  }

  // Store Manager → CHỈ thấy reports thuộc storeIds trong JWT
  // Coerce sang number[] phòng trường hợp JWT decode ra string
  const rawIds = user?.storeIds || [];
  const storeIds = rawIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0);
  if (storeIds.length === 0) {
    return res.json({ data: [] });
  }
  const data = await svc.getAuditReports({ storeIds });
  res.json({ data });
}

/* 4. SM xác nhận tiếp nhận báo cáo */
export async function acknowledgeReport(req: Request, res: Response) {
  const user = (req as any).user as { sub: string; roles?: string[]; storeIds?: number[] };
  const roles = user?.roles || [];

  // Chỉ store_manager mới được acknowledge
  if (!roles.includes("store_manager")) {
    return res.status(403).json({ message: "Chỉ Store Manager mới có quyền xác nhận" });
  }

  const reportId = Number(req.params.id);
  const smUserId = Number(user.sub);
  const smStoreIds = user.storeIds || [];

  const data = await svc.acknowledgeReport(reportId, smUserId, smStoreIds);
  res.json({ data });
}

export async function postReport(req: Request, res: Response) {
  const user = (req as any).user;
  const auditor_id = Number(user?.id ?? user?.sub);
  const { store_id, type, checklist_data, discrepancy_note } = req.body;

  // Parse checklist_data — FE gửi qua FormData nên là JSON string
  let parsedChecklist = [];
  try {
    parsedChecklist = typeof checklist_data === "string"
      ? JSON.parse(checklist_data)
      : checklist_data || [];
  } catch {
    return res.status(400).json({ message: "checklist_data không hợp lệ" });
  }

  // Nếu có file upload qua multer → lấy đường dẫn
  const file = (req as any).file as Express.Multer.File | undefined;
  const attachment_url = file ? `/uploads/audit/${file.filename}` : (req.body.attachment_url || null);

  const data = await svc.createAuditReport({
    store_id: Number(store_id),
    auditor_id,
    auditorName: user?.full_name || user?.username || "Auditor",
    type,
    checklist_data: parsedChecklist,
    discrepancy_note,
    attachment_url,
  });
  res.status(201).json({ data });
}

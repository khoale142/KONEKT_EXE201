/**
 * Lớp HR cho kiểm kê — gọi API inventory-audit hiện tại.
 * Backend vẫn dùng endpoint pending-dm / approve-dm (tên lịch sử); quyền đã mở cho hr_manager.
 */
import {
  inventoryAuditApi,
  type InventoryBatch,
  type InventorySheet,
  type InventorySheetItem,
} from "../../../staff/api/inventoryAudit.api";
import { headOfficerApi } from "../../../head-officer/api/head-officer.api";
import type { HrOfficeStore, HrPendingInventoryBatch } from "../types/hr.types";

export type { InventoryBatch, InventorySheet, InventorySheetItem };

export async function listOfficeStoresForHr(): Promise<HrOfficeStore[]> {
  const now = new Date();
  const data = await headOfficerApi.getDashboardInsights({
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  });
  return data.stores.map((s) => ({
    id: s.store_id,
    name: s.store_name,
  }));
}

/**
 * Hàng chờ duyệt cuối (sau khi cửa hàng đã gửi lên văn phòng).
 */
export async function fetchPendingHrInventoryBatches(params: {
  workDate: string;
  storeId?: number | "all";
}): Promise<HrPendingInventoryBatch[]> {
  const stores: HrOfficeStore[] =
    params.storeId && params.storeId !== "all"
      ? [{ id: params.storeId, name: "" }]
      : await listOfficeStoresForHr();

  if (stores.length === 0) return [];

  const results = await Promise.all(
    stores.map(async (s) => {
      try {
        const res = (await inventoryAuditApi.getPendingDmBatches({
          storeId: s.id,
          workDate: params.workDate,
        })) as { items?: InventoryBatch[] };
        const items = Array.isArray(res.items) ? res.items : [];
        return items.map((b) => ({
          ...b,
          store_name:
            b.store_name || s.name || `Cửa hàng #${s.id}`,
        }));
      } catch {
        return [];
      }
    }),
  );

  return results.flat();
}

export async function fetchBatchReportForHr(batchId: number) {
  return inventoryAuditApi.getBatchReport(batchId);
}

/**
 * Duyệt cuối — maps tới POST .../approve-dm (BE giữ tên route).
 */
export async function approveHrInventoryFinal(
  batchId: number,
  note?: string | null,
) {
  return inventoryAuditApi.approveDm(batchId, note);
}

export async function rejectHrInventoryBatch(batchId: number, note: string) {
  return inventoryAuditApi.rejectBatch(batchId, note);
}

export async function searchBatchesForHr(params: {
  storeId: number;
  workDate: string;
}) {
  return inventoryAuditApi.searchBatches(params);
}

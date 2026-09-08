/**
 * Types dùng chung module HR (office).
 * Kiểm kê: vẫn map field backend dm_* — chỉ đổi wording UI.
 */

import type { InventoryBatch } from "../../../staff/api/inventoryAudit.api";

export type HrOfficeStore = {
  id: number;
  name: string;
};

/** Batch trong hàng chờ duyệt cuối (cấp văn phòng / HR) */
export type HrPendingInventoryBatch = InventoryBatch & {
  store_name?: string;
};

export type HrEmployeeRow = {
  userId: number;
  storeId: number;
  storeName: string;
  fullName: string;
  roleName: string;
  employmentType: string;
  hourlyWage: number;
  baseSalary: number;
};

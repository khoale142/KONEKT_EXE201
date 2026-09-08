import { headOfficerApi } from "../../../head-officer/api/head-officer.api";
import type { HrEmployeeRow } from "../types/hr.types";

/**
 * Gom nhân sự theo từng cửa hàng (head-officer API).
 */
export async function fetchAllEmployeesForHr(): Promise<HrEmployeeRow[]> {
  const now = new Date();
  const insights = await headOfficerApi.getDashboardInsights({
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  });

  const rows: HrEmployeeRow[] = [];

  await Promise.all(
    insights.stores.map(async (s) => {
      try {
        const staff = await headOfficerApi.getStoreStaff(s.store_id);
        for (const m of staff) {
          rows.push({
            userId: Number(m.id),
            storeId: Number(s.store_id),
            storeName: String(s.store_name ?? ""),
            fullName: String(m.full_name ?? ""),
            roleName: String(m.role_name ?? ""),
            employmentType: String(m.employment_type ?? ""),
            hourlyWage: Number(m.hourly_wage ?? 0),
            baseSalary: Number(m.monthly_salary ?? 0),
          });
        }
      } catch {
        /* bỏ qua cửa lỗi */
      }
    }),
  );

  return rows.sort((a, b) =>
    a.fullName.localeCompare(b.fullName, "vi"),
  );
}

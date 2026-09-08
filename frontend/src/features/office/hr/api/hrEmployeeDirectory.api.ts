import {
  headOfficerApi,
  type HrEmployeeDirectoryRow,
} from "../../../head-officer/api/head-officer.api";
import { fetchAllEmployeesForHr } from "./hrEmployees.api";
import type { HrEmployeeRow } from "../types/hr.types";

const HR_EMPLOYEE_CACHE_TTL_MS = 30_000;

let employeeCache: HrEmployeeRow[] | null = null;
let employeeCacheAt = 0;
let employeeRequest: Promise<HrEmployeeRow[]> | null = null;

function normalizeEmployeeRow(row: HrEmployeeDirectoryRow): HrEmployeeRow {
  return {
    userId: Number(row.user_id),
    storeId: Number(row.store_id),
    storeName: String(row.store_name ?? ""),
    fullName: String(row.full_name ?? ""),
    roleName: String(row.role_name ?? ""),
    employmentType: String(row.employment_type ?? ""),
    hourlyWage: Number(row.hourly_wage ?? 0),
    baseSalary: Number(row.monthly_salary ?? 0),
  };
}

export async function fetchHrEmployeeDirectory(options?: {
  force?: boolean;
}): Promise<HrEmployeeRow[]> {
  const now = Date.now();
  if (!options?.force && employeeCache && now - employeeCacheAt < HR_EMPLOYEE_CACHE_TTL_MS) {
    return employeeCache;
  }

  if (!options?.force && employeeRequest) {
    return employeeRequest;
  }

  employeeRequest = headOfficerApi
    .getHrEmployees()
    .then((rows) =>
      rows
        .map(normalizeEmployeeRow)
        .sort((a, b) => a.fullName.localeCompare(b.fullName, "vi")),
    )
    .catch(() => fetchAllEmployeesForHr())
    .then((rows) => {
      employeeCache = rows;
      employeeCacheAt = Date.now();
      return rows;
    })
    .finally(() => {
      employeeRequest = null;
    });

  return employeeRequest;
}

export function clearHrEmployeeDirectoryCache() {
  employeeCache = null;
  employeeCacheAt = 0;
  employeeRequest = null;
}

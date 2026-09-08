import {
  getStoreReportOverview as getPosStoreReportOverview,
  getTodayStoreReport as getPosTodayStoreReport,
  type StoreReportResponse,
  type StoreReportSummary,
} from "../../pos/api/storeReports.api";

export type { StoreReportResponse, StoreReportSummary };

export async function getTodayStoreReport() {
  return getPosTodayStoreReport();
}

export async function getStoreReportOverview(params: {
  dateFrom: string;
  dateTo: string;
  topN?: number;
}) {
  return getPosStoreReportOverview(params);
}

import api from "../../../lib/http/axios";

export const payrollApi = {

  getMyPayroll(month: number, year: number) {
    return api.get("/payroll/my", {
      params: { month, year }
    });
  },

  getStorePayrolls(storeId: number, month: number, year: number) {
    return api.get(`/payroll/store/${storeId}`, {
      params: { month, year }
    });
  },

  finalizeStorePayroll(storeId: number, month: number, year: number) {
    return api.post(`/payroll/store/${storeId}/finalize`, { month, year });
  }

};
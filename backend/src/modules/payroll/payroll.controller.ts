import { Request, Response } from "express";
import { toInt } from "./payroll.normalize";
import { payrollService } from "./payroll.service";

function parsePayrollMonthYear(month: unknown, year: unknown): { m: number; y: number } {
  const now = new Date();
  const mRaw = month === undefined || month === "" ? NaN : Number(month);
  const yRaw = year === undefined || year === "" ? NaN : Number(year);
  const m =
    Number.isFinite(mRaw) && mRaw >= 1 && mRaw <= 12 ? Math.trunc(mRaw) : now.getMonth() + 1;
  const y =
    Number.isFinite(yRaw) && yRaw >= 1970 && yRaw <= 2100 ? Math.trunc(yRaw) : now.getFullYear();
  return { m, y };
}

export const payrollController = {
  async getMyPayroll(req: Request, res: Response) {
    const userId = toInt(req.user?.sub, 0);
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { month, year } = req.query;
    const { m, y } = parsePayrollMonthYear(month, year);

    const data = await payrollService.getMyPayroll(userId, m, y);
    return res.json(data);
  },

  async getStorePayrolls(req: Request, res: Response) {
    const { storeId } = req.params;
    const { month, year } = req.query;

    const { m, y } = parsePayrollMonthYear(month, year);
    const sid = toInt(storeId, 0);
    if (!sid) {
      return res.status(400).json({ message: "storeId không hợp lệ" });
    }

    const data = await payrollService.getStorePayrolls(sid, m, y);
    return res.json(data);
  },

  async finalizeStorePayroll(req: Request, res: Response) {
    const { storeId } = req.params;
    const { month, year } = req.body;

    if (!month || !year) {
      return res.status(400).json({ message: "Vui lòng truyền month và year." });
    }

    try {
      const sid = toInt(storeId, 0);
      const mo = toInt(month, NaN);
      const yr = toInt(year, NaN);
      if (!sid || !Number.isFinite(mo) || mo < 1 || mo > 12 || !Number.isFinite(yr)) {
        return res.status(400).json({ message: "storeId, month hoặc year không hợp lệ." });
      }
      const result = await payrollService.finalizeStorePayroll(sid, mo, yr);
      return res.json({ message: "Chốt lương thành công", ...result });
    } catch (error: any) {
      return res.status(500).json({ message: error.message || "Lỗi khi chốt lương" });
    }
  }
};

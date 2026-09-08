import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/apiError";
import { ZodError } from "zod";

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({ message: err.message, details: err.details });
  }

  // Zod validation errors (payload shape / time format) phải trả 400 để FE hiển thị đúng.
  if (err instanceof ZodError || err?.name === "ZodError") {
    const details = err instanceof ZodError ? err.flatten() : err?.issues;
    return res.status(400).json({
      message: "Dữ liệu gửi lên không hợp lệ",
      details,
    });
  }

  // Postgres known errors - map sang 4xx/5xx để tránh 500 mơ hồ
  if (typeof err?.code === "string") {
    if (err.code === "23505") {
      return res.status(409).json({ message: "Trùng dữ liệu (unique constraint)", details: err.detail });
    }
    if (err.code === "22P02") {
      return res.status(400).json({ message: "Dữ liệu ngày/giờ không hợp lệ", details: err.detail });
    }
    if (err.code === "42703") {
      const msg = String(err?.message || "");
      const quotedCol = /column\s+"([^"]+)"/i.exec(msg)?.[1];
      const dottedCol = /column\s+([a-zA-Z0-9_]+\.[a-zA-Z0-9_]+)/i.exec(msg)?.[1];
      const col = quotedCol ?? dottedCol ?? "không xác định";
      const relation = /relation\s+"([^"]+)"/i.exec(msg)?.[1] ?? (dottedCol?.split(".")[0] ?? "không xác định");
      return res.status(500).json({
        message: `Thiếu cột ${col} ở bảng ${relation}. Vui lòng chạy migration.`,
        details: err.message,
      });
    }
    if (err.code === "42P01") {
      return res.status(500).json({ message: "Lỗi cấu hình database: bảng không tồn tại. Vui lòng chạy migration.", details: err.message });
    }
  }

  console.error("[errorHandler] Unhandled error:", err?.message ?? err);
  if (process.env.NODE_ENV !== "production") {
    console.error(err);
  }
  const devMessage = process.env.NODE_ENV !== "production" && err?.message ? ` ${String(err.message)}` : "";
  return res.status(500).json({ message: "Internal Server Error" + devMessage });
}
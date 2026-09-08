import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { headOfficerApi } from "../../../head-officer/api/head-officer.api";
import type { StaffMember } from "../../../head-officer/api/head-officer.api";
import HrPageHeader from "../components/HrPageHeader";
import { employmentTypeLabelVi } from "../../../shared/utils/employmentShiftTypes";

const border = "1px solid #e2e8f0";

export default function HREmployeeDetailPage() {
  const { id } = useParams();
  const [search] = useSearchParams();
  const userId = Number(id);
  const storeId = Number(search.get("storeId"));

  const [member, setMember] = useState<StaffMember | null>(null);
  const [storeName, setStoreName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!Number.isFinite(userId) || userId <= 0 || !Number.isFinite(storeId) || storeId <= 0) {
      setError("Thiếu thông tin nhân viên hoặc cửa hàng (storeId trên URL).");
      setLoading(false);
      return;
    }

    headOfficerApi
      .getStoreStaff(storeId)
      .then((list) => {
        const m = list.find((x) => Number(x.id) === userId) || null;
        setMember(m);
        if (!m) setError("Không tìm thấy nhân viên trong cửa hàng đã chọn.");
      })
      .catch((e: unknown) => {
        const msg = (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message;
        setError(msg || "Không tải được dữ liệu");
      })
      .finally(() => setLoading(false));

    headOfficerApi
      .getStoreDetail(storeId)
      .then((d) => setStoreName(d.store?.name || ""))
      .catch(() => {});
  }, [userId, storeId]);

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Link to="/office/hr/employees" style={{ color: "#3182ce", fontWeight: 600 }}>
          ← Danh sách nhân sự
        </Link>
      </div>

      <HrPageHeader
        title="Hồ sơ nhân viên (xem)"
        description="Chỉ đọc thông tin cơ bản từ API head officer. Không chỉnh sửa trực tiếp tại đây."
      />

      {loading ? <p>Đang tải…</p> : null}
      {error ? <p style={{ color: "#c53030" }}>{error}</p> : null}

      {member ? (
        <div
          style={{
            background: "#fff",
            border: border,
            borderRadius: 10,
            padding: 20,
            maxWidth: 560,
          }}
        >
          <div style={{ marginBottom: 8 }}>
            <strong>Họ tên:</strong> {member.full_name}
          </div>
          <div style={{ marginBottom: 8 }}>
            <strong>Cửa hàng:</strong> {storeName || `#${storeId}`}
          </div>
          <div style={{ marginBottom: 8 }}>
            <strong>Vai trò:</strong> {member.role_name}
          </div>
          <div style={{ marginBottom: 8 }}>
            <strong>Loại làm việc:</strong> {employmentTypeLabelVi(member.employment_type)}
          </div>
          <div>
            <strong>Lương theo giờ:</strong>{" "}
            {formatCurrencyVnd(member.hourly_wage)}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatCurrencyVnd(value: number | null | undefined): string {
  const safeValue = Number.isFinite(Number(value)) ? Number(value) : 0;
  return `${safeValue.toLocaleString("vi-VN")} \u0111`;
}

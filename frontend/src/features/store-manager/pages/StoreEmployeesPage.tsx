import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuthStore } from "../../../app/store/auth.store";
import { storeStaffApi, type StoreListItem } from "../../staff/api/storeStaff.api";
import { storeManagerStaffApi, type StoreManagerStaff } from "../api/storeManagerStaff.api";
import { employmentTypeLabelVi, normalizeEmploymentType, type EmploymentType } from "../../shared/utils/employmentShiftTypes";
import { PageHeader } from "../../shared/components/PageHeader";
import { uploadProfileimage } from "../../stores/utils/uploadProfileimage";

const cardStyle: React.CSSProperties = {
  background: "#fff",
  borderRadius: 16,
  padding: 20,
  boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
};

export default function StoreEmployeesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const storeIdParam = searchParams.get("storeId");
  const storeId = storeIdParam ? Number(storeIdParam) : 0;

  const [storeList, setStoreList] = useState<StoreListItem[]>([]);
  const [staffList, setStaffList] = useState<StoreManagerStaff[]>([]);
  const [loadingStores, setLoadingStores] = useState(false);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const userRoles = useAuthStore((s) => s.user?.roles || []);
  const isStoreManager = userRoles.includes("store_manager");

  // Filters (FE-side)
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("active");
  const [employmentFilter, setEmploymentFilter] = useState<"all" | EmploymentType>("all");

  const [showAddModal, setShowAddModal] = useState(false);
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addFieldErrors, setAddFieldErrors] = useState<Record<string, string>>({});
  const [addForm, setAddForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    role: "staff" as const,
    employmentType: "part_time" as "full_time" | "part_time",
    dateOfBirth: "",
    address: "",
    idCardNumber: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
  });

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);

  const [showTerminateModal, setShowTerminateModal] = useState(false);
  const [showTerminateConfirmDialog, setShowTerminateConfirmDialog] = useState(false);
  const [terminateTarget, setTerminateTarget] = useState<StoreManagerStaff | null>(null);
  const [terminateReason, setTerminateReason] = useState("");
  const [terminateSubmitting, setTerminateSubmitting] = useState(false);
  const [terminateError, setTerminateError] = useState<string | null>(null);

  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateTarget, setUpdateTarget] = useState<StoreManagerStaff | null>(null);
  const [updateTargetRole, setUpdateTargetRole] = useState<"" | "shift_leader">("");
  const [updateTargetEmploymentType, setUpdateTargetEmploymentType] = useState<"" | "full_time">("");
  const [updateReason, setUpdateReason] = useState("");
  const [updateExperienceNote, setUpdateExperienceNote] = useState("");
  const [updateSubmitting, setUpdateSubmitting] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  async function refreshStaff(nextStoreId: number) {
    setLoadingStaff(true);
    setError("");
    try {
      const res = await storeManagerStaffApi.list({ storeId: nextStoreId });
      setStaffList(Array.isArray(res.users) ? res.users : []);
    } catch (e: any) {
      const msg = e?.response?.data?.message || "Không tải được danh sách nhân viên.";
      setError(msg);
    } finally {
      setLoadingStaff(false);
    }
  }

  const filteredStaff = useMemo(() => {
    const term = q.trim().toLowerCase();
    return staffList.filter((s) => {
      if (employmentFilter !== "all" && normalizeEmploymentType(s.employment_type) !== employmentFilter) return false;
      if (statusFilter !== "all") {
        const wantActive = statusFilter === "active";
        if (s.is_active !== wantActive) return false;
      }
      if (!term) return true;

      const full = String(s.full_name ?? "").toLowerCase();
      const email = String(s.email ?? "").toLowerCase();
      const phone = String(s.phone ?? "").toLowerCase();
      return full.includes(term) || email.includes(term) || phone.includes(term);
    });
  }, [employmentFilter, q, statusFilter, staffList]);

  const employmentCounts = useMemo(() => {
    const fullTime = filteredStaff.filter((s) => normalizeEmploymentType(s.employment_type) === "full_time").length;
    const partTime = filteredStaff.filter((s) => normalizeEmploymentType(s.employment_type) === "part_time").length;
    const unknown = filteredStaff.length - fullTime - partTime;
    return { fullTime, partTime, unknown };
  }, [filteredStaff]);

  const todayYMD = useMemo(
    () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }),
    []
  );
  const adultBirthDateMax = useMemo(() => {
    const today = new Date(`${todayYMD}T00:00:00`);
    today.setFullYear(today.getFullYear() - 18);
    return today.toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
  }, [todayYMD]);

  const emailOk = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  const phoneOk = (value: string) => /^\d{10}$/.test(value.trim());
  const digitsOnlyOk = (value: string) => /^\d+$/.test(value.trim());
  const normalizedName = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase("vi");
  const canRequestRolePromotion = (staff: StoreManagerStaff | null) =>
    !!staff && staff.is_active && String(staff.role_name ?? "").toLowerCase() === "staff";
  const canRequestFullTimeConversion = (staff: StoreManagerStaff | null) =>
    !!staff && staff.is_active && normalizeEmploymentType(staff.employment_type) === "part_time";
  const hasStaffUpdateRequestOption = (staff: StoreManagerStaff | null) =>
    canRequestRolePromotion(staff) || canRequestFullTimeConversion(staff);
  const existingStaffPhones = useMemo(
    () =>
      new Set(
        staffList
          .map((staff) => String(staff.phone ?? "").trim())
          .filter((phone) => phone.length > 0)
      ),
    [staffList]
  );
  const phoneUsedByStaff = (value: string) => existingStaffPhones.has(value.trim());

  function formatStaffTenureLabel(hireDate: string | null | undefined): string {
    if (!hireDate) return "Chưa có dữ liệu ngày vào làm";
    const start = new Date(`${hireDate}T00:00:00+07:00`);
    const today = new Date(`${todayYMD}T00:00:00+07:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(today.getTime())) return "Chưa có dữ liệu ngày vào làm";

    const tenureDays = Math.max(0, Math.floor((today.getTime() - start.getTime()) / 86_400_000));
    if (tenureDays === 0) return "Mới vào làm hôm nay";

    const years = Math.floor(tenureDays / 365);
    const months = Math.floor((tenureDays % 365) / 30);
    const days = tenureDays - years * 365 - months * 30;
    const parts: string[] = [];
    if (years > 0) parts.push(`${years} năm`);
    if (months > 0) parts.push(`${months} tháng`);
    if (days > 0 && years === 0) parts.push(`${days} ngày`);
    return parts.length > 0 ? parts.join(" ") : `${tenureDays} ngày`;
  }

  const canSubmitAddStaffRequest = useMemo(() => {
    if (!isStoreManager) return false;
    if (!storeId || !Number.isFinite(storeId)) return false;

    const fullNameOk = addForm.fullName.trim().length >= 2;
    const emailValid = emailOk(addForm.email);
    const phoneValid = phoneOk(addForm.phone) && !phoneUsedByStaff(addForm.phone);
    const employmentTypeValid = !!addForm.employmentType;
    const birthDateValid =
      !!addForm.dateOfBirth && addForm.dateOfBirth <= todayYMD && addForm.dateOfBirth <= adultBirthDateMax;
    const addressValid = addForm.address.trim().length >= 3;
    const idCardValid = addForm.idCardNumber.trim().length > 0 && digitsOnlyOk(addForm.idCardNumber);
    const emergencyNameValid =
      addForm.emergencyContactName.trim().length > 0 &&
      normalizedName(addForm.emergencyContactName) !== normalizedName(addForm.fullName);
    const emergencyPhoneValid =
      phoneOk(addForm.emergencyContactPhone) &&
      addForm.emergencyContactPhone.trim() !== addForm.phone.trim() &&
      !phoneUsedByStaff(addForm.emergencyContactPhone);

    return (
      fullNameOk &&
      emailValid &&
      phoneValid &&
      employmentTypeValid &&
      birthDateValid &&
      addressValid &&
      idCardValid &&
      emergencyNameValid &&
      emergencyPhoneValid
    );
  }, [
    isStoreManager,
    storeId,
    addForm.fullName,
    addForm.email,
    addForm.phone,
    addForm.employmentType,
    addForm.dateOfBirth,
    addForm.address,
    addForm.idCardNumber,
    addForm.emergencyContactName,
    addForm.emergencyContactPhone,
    existingStaffPhones,
    todayYMD,
    adultBirthDateMax,
  ]);

  function validateAddStaffField(key: string): string | null {
    switch (key) {
      case "fullName": {
        const v = addForm.fullName;
        if (!v || v.trim().length === 0) return "Vui lòng nhập họ và tên.";
        if (v.trim().length < 2) return "Họ và tên quá ngắn.";
        return null;
      }
      case "email": {
        if (!addForm.email.trim()) return "Vui lòng nhập email.";
        if (!emailOk(addForm.email)) return "Email không đúng định dạng.";
        return null;
      }
      case "phone": {
        if (!addForm.phone.trim()) return "Vui lòng nhập số điện thoại.";
        if (!phoneOk(addForm.phone)) return "Số điện thoại phải gồm đúng 10 chữ số.";
        if (phoneUsedByStaff(addForm.phone)) return "Số điện thoại này đã được sử dụng bởi nhân viên trong cửa hàng.";
        return null;
      }
      case "employmentType": {
        if (!addForm.employmentType) return "Vui lòng chọn hình thức làm việc.";
        return null;
      }
      case "dateOfBirth": {
        if (!addForm.dateOfBirth) return "Vui lòng chọn ngày sinh.";
        if (addForm.dateOfBirth > todayYMD) return "Ngày sinh không được ở tương lai.";
        if (addForm.dateOfBirth > adultBirthDateMax) return "Nhân viên phải từ đủ 18 tuổi trở lên.";
        return null;
      }
      case "address": {
        if (!addForm.address.trim()) return "Vui lòng nhập địa chỉ.";
        if (addForm.address.trim().length < 3) return "Địa chỉ quá ngắn.";
        return null;
      }
      case "idCardNumber": {
        if (!addForm.idCardNumber.trim()) return "Vui lòng nhập CCCD / CMND.";
        if (!digitsOnlyOk(addForm.idCardNumber)) return "CCCD / CMND phải là chuỗi số.";
        return null;
      }
      case "emergencyContactName": {
        if (!addForm.emergencyContactName.trim()) return "Vui lòng nhập người liên hệ khẩn cấp.";
        if (normalizedName(addForm.emergencyContactName) === normalizedName(addForm.fullName)) {
          return "Người liên hệ khẩn cấp không được trùng họ tên nhân viên.";
        }
        return null;
      }
      case "emergencyContactPhone": {
        if (!addForm.emergencyContactPhone.trim()) return "Vui lòng nhập SĐT khẩn cấp.";
        if (!phoneOk(addForm.emergencyContactPhone)) return "SĐT khẩn cấp phải gồm đúng 10 chữ số.";
        if (addForm.emergencyContactPhone.trim() === addForm.phone.trim()) {
          return "SĐT khẩn cấp không được trùng SĐT nhân viên.";
        }
        if (phoneUsedByStaff(addForm.emergencyContactPhone)) {
          return "SĐT khẩn cấp không được trùng với SĐT của nhân viên đang có trong cửa hàng.";
        }
        return null;
      }
      case "avatar": {
        return null;
      }
      case "store": {
        if (!storeId || !Number.isFinite(storeId) || storeId <= 0) return "Vui lòng chọn cửa hàng / chi nhánh.";
        return null;
      }
      default:
        return null;
    }
  }

  function validateAddStaffRequestAll(): Record<string, string> {
    const requiredKeys = [
      "store",
      "fullName",
      "email",
      "phone",
      "employmentType",
      "dateOfBirth",
      "address",
      "idCardNumber",
      "emergencyContactName",
      "emergencyContactPhone",
    ];
    const errs: Record<string, string> = {};
    for (const k of requiredKeys) {
      const msg = validateAddStaffField(k);
      if (msg) errs[k] = msg;
    }
    return errs;
  }

  function scrollToFirstAddStaffRequestError(errs: Record<string, string>) {
    const order = [
      "store",
      "fullName",
      "email",
      "phone",
      "employmentType",
      "dateOfBirth",
      "address",
      "idCardNumber",
      "emergencyContactName",
      "emergencyContactPhone",
    ];
    const first = order.find((k) => errs[k]);
    if (!first) return;

    const idMap: Record<string, string> = {
      store: "add_store",
      fullName: "add_fullName",
      email: "add_email",
      phone: "add_phone",
      employmentType: "add_employmentType",
      dateOfBirth: "add_birth_date",
      address: "add_address",
      idCardNumber: "add_id_card",
      emergencyContactName: "add_emergency_contact_name",
      emergencyContactPhone: "add_emergency_contact_phone",
    };
    const el = document.getElementById(idMap[first]);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    if (typeof (el as any).focus === "function") (el as any).focus();
  }

  function updateAddFieldErrorNow(key: string) {
    const msg = validateAddStaffField(key);
    setAddFieldErrors((prev) => {
      const next = { ...prev };
      if (msg) next[key] = msg;
      else delete next[key];
      return next;
    });
  }

  function getAddInputStyle(key: string): React.CSSProperties {
    const hasError = !!addFieldErrors[key];
    return {
      width: "100%",
      borderRadius: 12,
      padding: "10px 12px",
      border: hasError ? "1px solid #c53030" : "1px solid #e2e8f0",
      background: "#fff",
      outline: "none",
    };
  }

  const canSubmitStaffUpdateRequest =
    !!updateTarget &&
    !updateSubmitting &&
    ((updateTargetRole === "shift_leader" && canRequestRolePromotion(updateTarget)) ||
      (updateTargetEmploymentType === "full_time" && canRequestFullTimeConversion(updateTarget)));

  function openStaffUpdateModal(staff: StoreManagerStaff) {
    setUpdateTarget(staff);
    setUpdateTargetRole("");
    setUpdateTargetEmploymentType("");
    setUpdateReason("");
    setUpdateExperienceNote("");
    setUpdateError(null);
    setShowUpdateModal(true);
  }

  function closeStaffUpdateModal(force = false) {
    if (updateSubmitting && !force) return;
    setShowUpdateModal(false);
    setUpdateTarget(null);
    setUpdateTargetRole("");
    setUpdateTargetEmploymentType("");
    setUpdateReason("");
    setUpdateExperienceNote("");
    setUpdateError(null);
  }

  useEffect(() => {
    storeStaffApi
      .getMyStores()
      .then((res) => {
        const stores = res.stores ?? [];
        setStoreList(stores);
        if (stores.length > 0 && !storeIdParam) {
          setSearchParams({ storeId: String(stores[0].id) });
        }
      })
      .catch(() => setError("Không tải được danh sách cửa hàng."))
      .finally(() => setLoadingStores(false));
    setLoadingStores(true);
  }, []);

  useEffect(() => {
    if (!storeId || !Number.isFinite(storeId)) {
      setStaffList([]);
      return;
    }
    void refreshStaff(storeId);
  }, [storeId]);

  const selectedStore = storeList.find((s) => s.id === storeId);

  const avatarStyle: React.CSSProperties = {
    width: 40,
    height: 40,
    borderRadius: "50%",
    background: "#f2f2f2",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    color: "#555",
    flexShrink: 0,
    overflow: "hidden",
  };

  const statusLabel = (s: StoreManagerStaff) => (s.is_active ? "Đang hoạt động" : "Đã nghỉ");

  return (
    <div style={{ padding: 24, maxWidth: 800 }}>
      <PageHeader
        backTo="/store/manager"
        backLabel="Trang quản lý"
        title="Danh sách nhân viên"
        subtitle="Xem nhân sự trong cửa hàng, lọc nhanh theo loại nhân sự và gửi yêu cầu thêm/nghỉ việc."
        actions={
          isStoreManager ? (
            <button
              className="cafe-btn-primary"
              type="button"
              onClick={() => {
                setAddError(null);
                setMessage(null);
                setAddFieldErrors({});
                setAvatarFile(null);
                if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
                setAvatarPreviewUrl(null);
                setAddForm((p) => ({
                  ...p,
                  fullName: "",
                  email: "",
                  phone: "",
                  role: "staff",
                  employmentType: "part_time",
                  dateOfBirth: "",
                  address: "",
                  idCardNumber: "",
                  emergencyContactName: "",
                  emergencyContactPhone: "",
                }));
                setShowAddModal(true);
              }}
            >
              Tạo yêu cầu thêm nhân sự
            </button>
          ) : null
        }
      />

      <div style={cardStyle}>
        {message && (
          <div style={{ padding: 12, marginTop: 14, marginBottom: 16, background: "#f0fff4", color: "#2f5d3a", borderRadius: 10 }}>
            {message}
          </div>
        )}

        <div style={{ marginBottom: 20 }}>
          <label className="cafe-label" htmlFor="employees-filter-store">
            Cửa hàng
          </label>
          <select
            id="employees-filter-store"
            className="cafe-input"
            value={storeId || ""}
            onChange={(e) => setSearchParams({ storeId: e.target.value })}
            disabled={loadingStores}
            style={{ maxWidth: 300 }}
          >
            <option value="">-- Chọn cửa hàng --</option>
            {storeList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div style={{ padding: 12, marginBottom: 16, background: "#fff1f0", color: "#c53030", borderRadius: 10 }}>
            {error}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 200px 200px", gap: 12, marginBottom: 18 }}>
          <div>
            <label className="cafe-label" htmlFor="employees-filter-search">
              Tìm kiếm
            </label>
            <input
              id="employees-filter-search"
              className="cafe-input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tên / Email / SĐT"
              disabled={loadingStaff}
              style={{ width: "100%" }}
            />
          </div>
          <div>
            <label className="cafe-label" htmlFor="employees-filter-employment">
              Loại nhân sự
            </label>
            <select
              id="employees-filter-employment"
              className="cafe-input"
              value={employmentFilter}
              onChange={(e) => setEmploymentFilter(e.target.value as "all" | EmploymentType)}
              disabled={loadingStaff}
              style={{ width: "100%" }}
            >
              <option value="all">Tất cả</option>
              <option value="full_time">Toàn thời gian</option>
              <option value="part_time">Bán thời gian</option>
            </select>
          </div>
          <div>
            <label className="cafe-label" htmlFor="employees-filter-status">
              Lọc theo trạng thái
            </label>
            <select
              id="employees-filter-status"
              className="cafe-input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "inactive")}
              disabled={loadingStaff}
              style={{ width: "100%" }}
            >
              <option value="all">Tất cả</option>
              <option value="active">Đang hoạt động</option>
              <option value="inactive">Đã nghỉ</option>
            </select>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          <span style={miniBadge("#2f855a")}>Toàn thời gian: {employmentCounts.fullTime}</span>
          <span style={miniBadge("#3182ce")}>Bán thời gian: {employmentCounts.partTime}</span>
          {employmentCounts.unknown > 0 && (
            <span style={miniBadge("#718096")}>Chưa phân loại: {employmentCounts.unknown}</span>
          )}
        </div>

        {loadingStaff ? (
          <p>Đang tải nhân viên...</p>
        ) : !storeId ? (
          <p style={{ color: "#666" }}>Chọn cửa hàng để xem danh sách nhân viên.</p>
        ) : filteredStaff.length === 0 ? (
          <p style={{ color: "#666" }}>
            Không có nhân sự phù hợp tiêu chí trong cửa hàng {selectedStore?.name}.
          </p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {filteredStaff.map((s) => (
              <li
                key={s.id}
                style={{
                  padding: "12px 0",
                  borderBottom: "1px solid #eee",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
                  <div style={avatarStyle}>
                    {s.avatar_url ? (
                      <img
                        src={s.avatar_url}
                        alt={s.full_name ?? ""}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <span>{(s.full_name ?? "").trim().slice(0, 1).toUpperCase() || "—"}</span>
                    )}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <strong>{s.full_name ?? "—"}</strong>
                    <div style={{ color: "#666", fontSize: "0.9rem", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {s.role_name ?? ""} • {employmentTypeLabelVi(s.employment_type)}
                      {" • "}
                      {s.hire_date ?? "—"}
                      {" • "}
                      {statusLabel(s)}
                    </div>
                    <div style={{ marginTop: 6 }}>
                      <span
                        style={{
                          ...miniBadge(
                            normalizeEmploymentType(s.employment_type) === "full_time" ? "#2f855a" : "#3182ce"
                          ),
                          fontSize: 11,
                        }}
                      >
                        {employmentTypeLabelVi(s.employment_type)}
                      </span>
                    </div>
                    <div style={{ color: "#888", fontSize: "0.85rem", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {s.email ? `Email: ${s.email}` : ""}
                      {s.phone ? `${s.email ? " • " : ""}SĐT: ${s.phone}` : ""}
                      {s.username ? `${(s.email || s.phone) ? " • " : ""}Username: ${s.username}` : ""}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  {isStoreManager && hasStaffUpdateRequestOption(s) && (
                    <button
                      type="button"
                      className="cafe-btn-secondary"
                      disabled={updateSubmitting}
                      onClick={() => openStaffUpdateModal(s)}
                    >
                      Gửi yêu cầu cập nhật
                    </button>
                  )}
                  {isStoreManager && s.is_active && (
                    <button
                      type="button"
                      className="cafe-btn-secondary"
                      style={{ borderColor: "#c53030", color: "#c53030" }}
                      disabled={terminateSubmitting}
                      onClick={() => {
                        setTerminateTarget(s);
                        setTerminateReason("");
                        setTerminateError(null);
                        setShowTerminateConfirmDialog(false);
                        setShowTerminateModal(true);
                      }}
                    >
                      Tạo yêu cầu nghỉ việc
                    </button>
                  )}
                  <Link
                    to={`/store/manager/employees/${s.id}?storeId=${storeId}`}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 10,
                      background: "#2f5d3a",
                      color: "#fff",
                      textDecoration: "none",
                      fontSize: "0.9rem",
                      fontWeight: 700,
                    }}
                  >
                    Xem hồ sơ
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Add staff modal */}
      {showAddModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "#fff",
              width: "100%",
              maxWidth: 560,
              borderRadius: 14,
              padding: 20,
              boxShadow: "0 18px 60px rgba(0,0,0,0.22)",
              maxHeight: "85vh",
              overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <h3 style={{ margin: 0 }}>Tạo yêu cầu thêm nhân sự</h3>
              <button
                type="button"
                className="cafe-btn-secondary"
                onClick={() => {
                  if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
                  setAvatarFile(null);
                  setAvatarPreviewUrl(null);
                  setAddError(null);
                  setAddFieldErrors({});
                  setShowAddModal(false);
                }}
                disabled={addSubmitting}
              >
                Đóng
              </button>
            </div>

            <p style={{ margin: "8px 0 14px", color: "#666" }}>
              Điền thông tin yêu cầu thêm nhân sự. Yêu cầu sẽ được gửi lên office/DM để xử lý. DM sẽ tạo tài khoản khi duyệt.
            </p>

            <div>
              <label className="cafe-label" htmlFor="add_store">Cửa hàng / chi nhánh *</label>
              <input id="add_store" className="cafe-input" value={selectedStore?.name ?? ""} disabled={true} style={{ width: "100%" }} />
              {addFieldErrors.store && (
                <div style={{ color: "#c53030", fontSize: 12, marginTop: 6 }}>{addFieldErrors.store}</div>
              )}
            </div>

            {addError && (
              <div style={{ padding: 12, marginBottom: 14, background: "#fff1f0", color: "#c53030", borderRadius: 10 }}>{addError}</div>
            )}

            <div style={{ display: "grid", gap: 14 }}>
              <div>
                <label className="cafe-label" htmlFor="add_fullName">Họ và tên *</label>
                <input
                  id="add_fullName"
                  className="cafe-input"
                  value={addForm.fullName}
                  onChange={(e) => setAddForm((p) => ({ ...p, fullName: e.target.value }))}
                  onBlur={() => updateAddFieldErrorNow("fullName")}
                  disabled={addSubmitting}
                  style={getAddInputStyle("fullName")}
                />
                {addFieldErrors.fullName && (
                  <div style={{ color: "#c53030", fontSize: 12, marginTop: 6 }}>{addFieldErrors.fullName}</div>
                )}
              </div>
              <div>
                <label className="cafe-label" htmlFor="add_email">Email *</label>
                <input
                  id="add_email"
                  className="cafe-input"
                  value={addForm.email}
                  onChange={(e) => setAddForm((p) => ({ ...p, email: e.target.value }))}
                  onBlur={() => updateAddFieldErrorNow("email")}
                  disabled={addSubmitting}
                  style={getAddInputStyle("email")}
                />
                {addFieldErrors.email && (
                  <div style={{ color: "#c53030", fontSize: 12, marginTop: 6 }}>{addFieldErrors.email}</div>
                )}
              </div>
              <div>
                <label className="cafe-label" htmlFor="add_phone">Số điện thoại *</label>
                <input
                  id="add_phone"
                  className="cafe-input"
                  value={addForm.phone}
                  onChange={(e) => setAddForm((p) => ({ ...p, phone: e.target.value }))}
                  onBlur={() => updateAddFieldErrorNow("phone")}
                  disabled={addSubmitting}
                  style={getAddInputStyle("phone")}
                  placeholder="vd: 0901234567"
                />
                {addFieldErrors.phone && (
                  <div style={{ color: "#c53030", fontSize: 12, marginTop: 6 }}>{addFieldErrors.phone}</div>
                )}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label className="cafe-label" htmlFor="add_employmentType">Hình thức làm việc *</label>
                  <select
                    id="add_employmentType"
                    className="cafe-input"
                    value={addForm.employmentType}
                    onChange={(e) =>
                      setAddForm((p) => ({
                        ...p,
                        employmentType: e.target.value as "full_time" | "part_time",
                      }))
                    }
                    onBlur={() => updateAddFieldErrorNow("employmentType")}
                    disabled={addSubmitting}
                    style={getAddInputStyle("employmentType")}
                  >
                    <option value="full_time">Toàn thời gian</option>
                    <option value="part_time">Bán thời gian</option>
                  </select>
                  <div style={{ color: "#718096", fontSize: 12, marginTop: 6 }}>
                    Nhân sự mới chỉ vào vai trò staff, nhưng có thể chọn toàn thời gian hoặc bán thời gian.
                  </div>
                  {addFieldErrors.employmentType && (
                    <div style={{ color: "#c53030", fontSize: 12, marginTop: 6 }}>{addFieldErrors.employmentType}</div>
                  )}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label className="cafe-label" htmlFor="add_birth_date">Ngày sinh *</label>
                  <input
                    id="add_birth_date"
                    className="cafe-input"
                    type="date"
                    max={todayYMD}
                    value={addForm.dateOfBirth}
                    onChange={(e) => setAddForm((p) => ({ ...p, dateOfBirth: e.target.value }))}
                    onBlur={() => updateAddFieldErrorNow("dateOfBirth")}
                    disabled={addSubmitting}
                    style={getAddInputStyle("dateOfBirth")}
                  />
                  {addFieldErrors.dateOfBirth && (
                    <div style={{ color: "#c53030", fontSize: 12, marginTop: 6 }}>{addFieldErrors.dateOfBirth}</div>
                  )}
                </div>
              </div>

              <div>
                <label className="cafe-label" htmlFor="add_address">Địa chỉ *</label>
                <textarea
                  id="add_address"
                  className="cafe-input"
                  value={addForm.address}
                  onChange={(e) => setAddForm((p) => ({ ...p, address: e.target.value }))}
                  onBlur={() => updateAddFieldErrorNow("address")}
                  disabled={addSubmitting}
                  style={{ ...getAddInputStyle("address"), minHeight: 70, resize: "vertical" }}
                  placeholder="Nhập địa chỉ thường trú / hiện tại"
                />
                {addFieldErrors.address && (
                  <div style={{ color: "#c53030", fontSize: 12, marginTop: 6 }}>{addFieldErrors.address}</div>
                )}
              </div>

              <div>
                <label className="cafe-label" htmlFor="add_id_card">CCCD / CMND *</label>
                <input
                  id="add_id_card"
                  className="cafe-input"
                  value={addForm.idCardNumber}
                  onChange={(e) => {
                    const v = e.target.value;
                    setAddForm((p) => ({ ...p, idCardNumber: v.replace(/[^0-9]/g, "") }));
                  }}
                  onBlur={() => updateAddFieldErrorNow("idCardNumber")}
                  disabled={addSubmitting}
                  style={getAddInputStyle("idCardNumber")}
                  placeholder="Nhập số CCCD / CMND"
                />
                {addFieldErrors.idCardNumber && (
                  <div style={{ color: "#c53030", fontSize: 12, marginTop: 6 }}>{addFieldErrors.idCardNumber}</div>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label className="cafe-label" htmlFor="add_emergency_contact_name">Người liên hệ khẩn cấp *</label>
                  <input
                    id="add_emergency_contact_name"
                    className="cafe-input"
                    value={addForm.emergencyContactName}
                    onChange={(e) => setAddForm((p) => ({ ...p, emergencyContactName: e.target.value }))}
                    onBlur={() => updateAddFieldErrorNow("emergencyContactName")}
                    disabled={addSubmitting}
                    style={getAddInputStyle("emergencyContactName")}
                    placeholder="Họ tên"
                  />
                  {addFieldErrors.emergencyContactName && (
                    <div style={{ color: "#c53030", fontSize: 12, marginTop: 6 }}>{addFieldErrors.emergencyContactName}</div>
                  )}
                </div>
                <div>
                  <label className="cafe-label" htmlFor="add_emergency_contact_phone">SĐT khẩn cấp *</label>
                  <input
                    id="add_emergency_contact_phone"
                    className="cafe-input"
                    value={addForm.emergencyContactPhone}
                    onChange={(e) => {
                      const v = e.target.value;
                      setAddForm((p) => ({ ...p, emergencyContactPhone: v.replace(/[^0-9]/g, "") }));
                    }}
                    onBlur={() => updateAddFieldErrorNow("emergencyContactPhone")}
                    disabled={addSubmitting}
                    style={getAddInputStyle("emergencyContactPhone")}
                    placeholder="Số điện thoại"
                  />
                  {addFieldErrors.emergencyContactPhone && (
                    <div style={{ color: "#c53030", fontSize: 12, marginTop: 6 }}>{addFieldErrors.emergencyContactPhone}</div>
                  )}
                </div>
              </div>

              <div>
                <label className="cafe-label" htmlFor="add_avatar">Ảnh đại diện (tùy chọn)</label>
                <div style={{ display: "grid", gap: 8 }}>
                  <input
                    id="add_avatar"
                    className="cafe-input"
                    type="file"
                    accept="image/*"
                    disabled={addSubmitting}
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      if (!file) {
                        if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
                        setAvatarFile(null);
                        setAvatarPreviewUrl(null);
                        setAddFieldErrors((prev) => {
                          const next = { ...prev };
                          delete next.avatar;
                          return next;
                        });
                        return;
                      }
                      if (!file.type.startsWith("image/")) {
                        if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
                        setAvatarFile(null);
                        setAvatarPreviewUrl(null);
                        setAddError(null);
                        setAddFieldErrors((prev) => ({ ...prev, avatar: "Chỉ chấp nhận file ảnh." }));
                        return;
                      }

                      if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
                      setAvatarFile(file);
                      setAvatarPreviewUrl(URL.createObjectURL(file));
                      setAddError(null);
                      setAddFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.avatar;
                        return next;
                      });
                    }}
                    style={{ width: "100%" }}
                  />

                  {avatarPreviewUrl && (
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <img
                        src={avatarPreviewUrl}
                        alt="Avatar preview"
                        style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover" }}
                      />
                      <button
                        type="button"
                        className="cafe-btn-secondary"
                        style={{ borderColor: "#c53030", color: "#c53030" }}
                        disabled={addSubmitting}
                        onClick={() => {
                          if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
                          setAvatarFile(null);
                          setAvatarPreviewUrl(null);
                          setAddFieldErrors((prev) => {
                            const next = { ...prev };
                            delete next.avatar;
                            return next;
                          });
                        }}
                      >
                        Xóa / chọn lại
                      </button>
                    </div>
                  )}
                </div>
                {addFieldErrors.avatar && (
                  <div style={{ color: "#c53030", fontSize: 12, marginTop: 6 }}>{addFieldErrors.avatar}</div>
                )}
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 12,
                  justifyContent: "flex-end",
                  marginTop: 6,
                  position: "sticky",
                  bottom: 0,
                  background: "#fff",
                  paddingTop: 12,
                  paddingBottom: 6,
                  zIndex: 2,
                }}
              >
                <button
                  type="button"
                  className="cafe-btn-secondary"
                  onClick={() => {
                    if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
                    setAvatarFile(null);
                    setAvatarPreviewUrl(null);
                    setAddError(null);
                    setAddFieldErrors({});
                    setShowAddModal(false);
                  }}
                  disabled={addSubmitting}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  className="cafe-btn-primary"
                  disabled={addSubmitting || !canSubmitAddStaffRequest}
                  onClick={async () => {
                    setAddError(null);
                    const errs = validateAddStaffRequestAll();
                    const hasErrors = Object.keys(errs).length > 0;
                    if (hasErrors) {
                      setAddFieldErrors(errs);
                      scrollToFirstAddStaffRequestError(errs);
                      return;
                    }
                    setAddFieldErrors({});
                    setAddSubmitting(true);
                    try {
                      let avatarUrl: string | null = null;
                      if (avatarFile) {
                        avatarUrl = await uploadProfileimage(avatarFile);
                      }
                      console.log("[store-manager][hire request] payload", {
                        storeId,
                        payload: { ...addForm, employmentType: addForm.employmentType, avatarUrl },
                      });
                      await storeManagerStaffApi.submitHireRequest({
                        storeId,
                        payload: {
                          fullName: addForm.fullName,
                          email: addForm.email,
                          phone: addForm.phone,
                          role: "staff",
                          employmentType: addForm.employmentType,
                          dateOfBirth: addForm.dateOfBirth,
                          address: addForm.address,
                          idCardNumber: addForm.idCardNumber,
                          emergencyContactName: addForm.emergencyContactName,
                          emergencyContactPhone: addForm.emergencyContactPhone,
                          avatarUrl,
                        },
                      });
                      setMessage(
                        "Yêu cầu thêm nhân sự đã được gửi lên office. Chờ HR/DM xử lý."
                      );
                      setShowAddModal(false);
                      setAddForm({
                        fullName: "",
                        email: "",
                        phone: "",
                        role: "staff",
                        employmentType: "part_time",
                        dateOfBirth: "",
                        address: "",
                        idCardNumber: "",
                        emergencyContactName: "",
                        emergencyContactPhone: "",
                      });
                      setAddFieldErrors({});
                      if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
                      setAvatarFile(null);
                      setAvatarPreviewUrl(null);
                      console.log("[store-manager][hire request] submitted ok");
                    } catch (e: any) {
                      const statusCode = Number(e?.response?.status ?? 0);
                      const msg = e?.response?.data?.message || "Lỗi gửi yêu cầu tuyển dụng";
                      if (statusCode === 409 && String(msg).toLowerCase().includes("khẩn cấp")) {
                        setAddFieldErrors((prev) => ({ ...prev, emergencyContactPhone: msg }));
                      } else if (statusCode === 409 && String(msg).toLowerCase().includes("số điện thoại")) {
                        setAddFieldErrors((prev) => ({ ...prev, phone: msg }));
                      }
                      setAddError(msg);
                      console.error("[store-manager][hire request] failed", e);
                    } finally {
                      setAddSubmitting(false);
                    }
                  }}
                >
                  {addSubmitting ? "Đang gửi..." : "Gửi yêu cầu"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Staff update request modal */}
      {showUpdateModal && updateTarget && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "#fff",
              width: "100%",
              maxWidth: 540,
              borderRadius: 14,
              padding: 20,
              boxShadow: "0 18px 60px rgba(0,0,0,0.22)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <h3 style={{ margin: 0 }}>Tạo yêu cầu cập nhật nhân sự</h3>
              <button
                type="button"
                className="cafe-btn-secondary"
                onClick={() => closeStaffUpdateModal()}
                disabled={updateSubmitting}
              >
                Đóng
              </button>
            </div>

            <p style={{ margin: "8px 0 14px", color: "#666" }}>
              Chọn thay đổi cần gửi HR duyệt cho {updateTarget.full_name ?? "nhân sự này"}.
            </p>

            {updateError && (
              <div style={{ padding: 12, marginBottom: 14, background: "#fff1f0", color: "#c53030", borderRadius: 10 }}>
                {updateError}
              </div>
            )}

            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ padding: 12, border: "1px solid #e2e8f0", borderRadius: 12, background: "#f8faf8" }}>
                <div style={{ fontWeight: 800, color: "#2d3748" }}>{updateTarget.full_name ?? "—"}</div>
                <div style={{ color: "#718096", fontSize: 13, marginTop: 4 }}>
                  Vai trò hiện tại: {updateTarget.role_name ?? "—"} • Hình thức hiện tại:{" "}
                  {employmentTypeLabelVi(updateTarget.employment_type)}
                </div>
                <div style={{ color: "#2f5d3a", fontSize: 13, marginTop: 8, fontWeight: 700 }}>
                  Thâm niên hệ thống: {formatStaffTenureLabel(updateTarget.hire_date)}
                </div>
              </div>

              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, color: "#2d3748" }}>
                <input
                  type="checkbox"
                  checked={updateTargetRole === "shift_leader"}
                  disabled={updateSubmitting || !canRequestRolePromotion(updateTarget)}
                  onChange={(e) => setUpdateTargetRole(e.target.checked ? "shift_leader" : "")}
                  style={{ marginTop: 4 }}
                />
                <span>
                  <strong>Đề xuất lên Shift Leader</strong>
                  <div style={{ color: "#718096", fontSize: 12, marginTop: 2 }}>
                    Chỉ áp dụng cho nhân sự đang ở role staff.
                  </div>
                </span>
              </label>

              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, color: "#2d3748" }}>
                <input
                  type="checkbox"
                  checked={updateTargetEmploymentType === "full_time"}
                  disabled={updateSubmitting || !canRequestFullTimeConversion(updateTarget)}
                  onChange={(e) => setUpdateTargetEmploymentType(e.target.checked ? "full_time" : "")}
                  style={{ marginTop: 4 }}
                />
                <span>
                  <strong>Đề xuất chuyển sang toàn thời gian</strong>
                  <div style={{ color: "#718096", fontSize: 12, marginTop: 2 }}>
                    Chỉ áp dụng cho nhân sự đang làm bán thời gian.
                  </div>
                </span>
              </label>

              <div>
                <label className="cafe-label" htmlFor="update_staff_reason">Lý do đề xuất</label>
                <textarea
                  id="update_staff_reason"
                  className="cafe-input"
                  value={updateReason}
                  onChange={(e) => setUpdateReason(e.target.value)}
                  disabled={updateSubmitting}
                  style={{ width: "100%", minHeight: 90, resize: "vertical", marginBottom: 10 }}
                  placeholder="vd: cần bổ sung trưởng ca cho khung giờ tối, đề xuất nhân sự này đảm nhiệm..."
                />

                <label className="cafe-label" htmlFor="update_staff_experience_note">
                  Nhận xét kinh nghiệm / năng lực từ SM (tùy chọn)
                </label>
                <textarea
                  id="update_staff_experience_note"
                  className="cafe-input"
                  value={updateExperienceNote}
                  onChange={(e) => setUpdateExperienceNote(e.target.value)}
                  disabled={updateSubmitting}
                  style={{ width: "100%", minHeight: 100, resize: "vertical" }}
                  placeholder="vd: đã đứng ca tối 6 tháng, nắm quy trình mở/đóng ca, hỗ trợ training nhân viên mới, xử lý tình huống khách hàng tốt..."
                />
              </div>

              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 6 }}>
                <button
                  type="button"
                  className="cafe-btn-secondary"
                  onClick={() => closeStaffUpdateModal()}
                  disabled={updateSubmitting}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  className="cafe-btn-primary"
                  disabled={!canSubmitStaffUpdateRequest}
                  onClick={async () => {
                    if (!updateTarget) return;
                    setUpdateError(null);
                    setUpdateSubmitting(true);
                    try {
                      await storeManagerStaffApi.submitStaffUpdateRequest({
                        storeId,
                        staffId: updateTarget.id,
                        payload: {
                          reason: updateReason.trim() || undefined,
                          managerExperienceNote: updateExperienceNote.trim() || undefined,
                          targetRole: updateTargetRole || undefined,
                          targetEmploymentType: updateTargetEmploymentType || undefined,
                        },
                      });
                      setMessage("Yêu cầu cập nhật vai trò đã được gửi lên HR. Chờ HR xử lý.");
                      closeStaffUpdateModal(true);
                    } catch (e: any) {
                      setUpdateError(e?.response?.data?.message || "Lỗi gửi yêu cầu cập nhật nhân sự");
                    } finally {
                      setUpdateSubmitting(false);
                    }
                  }}
                >
                  {updateSubmitting ? "Đang gửi..." : "Gửi yêu cầu"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Terminate staff modal */}
      {showTerminateModal && terminateTarget && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "#fff",
              width: "100%",
              maxWidth: 520,
              borderRadius: 14,
              padding: 20,
              boxShadow: "0 18px 60px rgba(0,0,0,0.22)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <h3 style={{ margin: 0 }}>Tạo yêu cầu nghỉ việc</h3>
              <button
                type="button"
                className="cafe-btn-secondary"
                onClick={() => {
                  setShowTerminateConfirmDialog(false);
                  setShowTerminateModal(false);
                  setTerminateTarget(null);
                }}
                disabled={terminateSubmitting}
              >
                Đóng
              </button>
            </div>

            <p style={{ margin: "8px 0 14px", color: "#666" }}>
              Yêu cầu nghỉ việc sẽ được gửi lên office/DM để xử lý. DM sẽ thực hiện cho nghỉ việc khi duyệt.
            </p>

            {terminateError && (
              <div style={{ padding: 12, marginBottom: 14, background: "#fff1f0", color: "#c53030", borderRadius: 10 }}>{terminateError}</div>
            )}

            <div style={{ display: "grid", gap: 12 }}>
              <div>
                <div style={{ color: "#333", fontWeight: 800 }}>{terminateTarget.full_name ?? "—"}</div>
                <div style={{ color: "#666", fontSize: "0.9rem", marginTop: 2 }}>
                  Role: {terminateTarget.role_name ?? ""} • Hire date: {terminateTarget.hire_date ?? "—"}
                </div>
              </div>
              <div>
                <label className="cafe-label" htmlFor="terminate_reason">Lý do nghỉ việc (tuỳ chọn)</label>
                <textarea
                  id="terminate_reason"
                  className="cafe-input"
                  value={terminateReason}
                  onChange={(e) => setTerminateReason(e.target.value)}
                  disabled={terminateSubmitting}
                  style={{ width: "100%", minHeight: 90, resize: "vertical" }}
                  placeholder="vd: xin nghỉ việc theo nguyện vọng..."
                />
              </div>

              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 6 }}>
                <button
                  type="button"
                  className="cafe-btn-secondary"
                  onClick={() => {
                    setShowTerminateConfirmDialog(false);
                    setShowTerminateModal(false);
                    setTerminateTarget(null);
                  }}
                  disabled={terminateSubmitting}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  className="cafe-btn-primary"
                  disabled={terminateSubmitting || !storeId}
                  onClick={() => {
                    if (!terminateTarget) return;
                    setShowTerminateConfirmDialog(true);
                  }}
                >
                  {terminateSubmitting ? "Đang gửi..." : "Gửi yêu cầu nghỉ việc"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom confirm dialog - xác nhận gửi yêu cầu nghỉ việc */}
      {showTerminateConfirmDialog && terminateTarget && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1100,
          }}
          onClick={() => !terminateSubmitting && setShowTerminateConfirmDialog(false)}
        >
          <div
            style={{
              background: "#fff",
              width: "100%",
              maxWidth: 400,
              borderRadius: 14,
              padding: 20,
              boxShadow: "0 18px 60px rgba(0,0,0,0.25)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 12px" }}>Xác nhận gửi yêu cầu nghỉ việc</h3>
            <p style={{ margin: "0 0 20px", color: "#555" }}>
              Bạn có chắc muốn gửi yêu cầu nghỉ việc cho nhân sự này lên office/DM không?
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                type="button"
                className="cafe-btn-secondary"
                onClick={() => setShowTerminateConfirmDialog(false)}
                disabled={terminateSubmitting}
              >
                Hủy
              </button>
              <button
                type="button"
                className="cafe-btn-primary"
                disabled={terminateSubmitting || !storeId}
                onClick={async () => {
                  if (!terminateTarget) return;
                  setTerminateError(null);
                  setTerminateSubmitting(true);
                  try {
                    const targetHireDate = terminateTarget.hire_date ?? null;
                    console.log("[store-manager][fire request] payload", {
                      storeId,
                      staffId: terminateTarget.id,
                      reason: terminateReason,
                      position: terminateTarget.full_name ?? "",
                      targetHireDate,
                    });
                    await storeManagerStaffApi.submitFireRequest({
                      storeId,
                      staffId: terminateTarget.id,
                      payload: {
                        reason: terminateReason ?? "",
                        position: terminateTarget.full_name ?? "",
                        targetRole: terminateTarget.role_name ?? "",
                        targetHireDate: targetHireDate,
                      },
                    });
                    setMessage("Yêu cầu nghỉ việc đã được gửi lên office. Chờ HR/DM xử lý.");
                    setShowTerminateConfirmDialog(false);
                    setShowTerminateModal(false);
                    setTerminateTarget(null);
                    setTerminateReason("");
                    console.log("[store-manager][fire request] submitted ok");
                  } catch (e: any) {
                    const msg = e?.response?.data?.message || "Lỗi gửi yêu cầu nghỉ việc";
                    setTerminateError(msg);
                    console.error("[store-manager][fire request] failed", e);
                  } finally {
                    setTerminateSubmitting(false);
                  }
                }}
              >
                {terminateSubmitting ? "Đang gửi..." : "Xác nhận gửi"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function miniBadge(color: string): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 10px",
    borderRadius: 999,
    fontWeight: 700,
    fontSize: 12,
    color,
    background: `${color}1A`,
    border: `1px solid ${color}33`,
  };
}



import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import CafeHeader from "../../../shared/components/CafeHeader";
import { memberApi } from "../api/member.api";
import { formatDateOnly, toDateInputValue } from "../../../utils/date";
import { CITY_OPTIONS } from "../../../constants/locations";

type Customer = {
  id: number;
  fullName: string;
  email: string;
  phone: string;
  gender: string;
  birthday: string;
  address?: string;
  city: string;
  district?: string;
  points: number;
  level: string;
  createdAt: string | null;
  totalOrders: number;
  lastOrderDate: string | null;
};

export default function MemberProfilePage() {
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState("");
  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    gender: "other" as "male" | "female" | "other",
    birthday: "",
    city: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const res = await memberApi.getProfile();
        if (cancelled) return;
        const c = res.customer;
        setCustomer(c);
        setFormData({
          fullName: c.fullName ?? "",
          phone: (c.phone ?? "").replace(/\D/g, "").slice(0, 10),
          gender: (c.gender as "male" | "female" | "other") ?? "other",
          birthday: toDateInputValue(c.birthday),
          city: c.city ?? "",
        });
      } catch (e: any) {
        if (cancelled) return;
        setErr(e?.response?.data?.message || "Lỗi tải thông tin");
        if (e?.response?.status === 401) navigate("/login/customer", { replace: true });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const { fullName, phone, gender, birthday, city } = formData;
    const fn = fullName.trim();
    const ph = phone.trim();
    const bd = birthday.trim();
    const ct = city.trim();

    if (!fn) {
      setErr("Họ và tên không được để trống");
      setSuccess("");
      return;
    }
    if (!ph) {
      setErr("Số điện thoại không được để trống");
      setSuccess("");
      return;
    }
    if (!/^[0-9]{10}$/.test(ph)) {
      setErr("Số điện thoại phải gồm đúng 10 chữ số");
      setSuccess("");
      return;
    }
    if (!bd) {
      setErr("Ngày sinh không được để trống");
      setSuccess("");
      return;
    }
    if (!ct) {
      setErr("Thành phố không được để trống");
      setSuccess("");
      return;
    }

    setErr("");
    setSuccess("");
    setSaving(true);
    try {
      const res = await memberApi.updateProfile({
        fullName: fn,
        phone: ph,
        gender,
        birthday: bd,
        city: ct,
      });
      setCustomer(res.customer);
      const c = res.customer;
      setFormData({
        fullName: c.fullName ?? "",
        phone: (c.phone ?? "").replace(/\D/g, "").slice(0, 10),
        gender: (c.gender as "male" | "female" | "other") ?? "other",
        birthday: toDateInputValue(c.birthday),
        city: c.city ?? "",
      });
      setSuccess(res.message || "Cập nhật thông tin thành công");
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Cập nhật thất bại");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (customer) {
      setFormData({
        fullName: customer.fullName ?? "",
        phone: (customer.phone ?? "").replace(/\D/g, "").slice(0, 10),
        gender: (customer.gender as "male" | "female" | "other") ?? "other",
        birthday: toDateInputValue(customer.birthday),
        city: customer.city ?? "",
      });
    }
    setErr("");
    setSuccess("");
  };

  if (loading) {
    return (
      <div className="cafe-theme" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <CafeHeader />
        <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ color: "var(--cafe-text-muted)" }}>Đang tải thông tin...</p>
        </main>
      </div>
    );
  }

  if (err && !customer) {
    return (
      <div className="cafe-theme" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <CafeHeader />
        <main
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <p className="cafe-error">{err}</p>
          <Link to="/login/customer" className="cafe-link">
            Quay lại đăng nhập
          </Link>
        </main>
      </div>
    );
  }

  if (!customer) return null;

  return (
    <div className="cafe-theme" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <CafeHeader />

      <main style={{ flex: 1, padding: 32, maxWidth: 640, margin: "0 auto", width: "100%" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 20,
          }}
        >
          <button
            type="button"
            className="cafe-btn-secondary"
            onClick={() => navigate("/customer")}
          >
            ← Quay lại trang chủ khách hàng
          </button>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link to="/customer/promotions" state={{ returnTo: "/customer/profile" }} className="cafe-link">
              Xem khuyến mãi
            </Link>
            <Link to="/customer/vouchers" state={{ returnTo: "/customer/profile" }} className="cafe-link">
              Voucher của tôi
            </Link>
          </div>
        </div>

        <div className="cafe-card" style={{ padding: 32 }}>
          <h1 className="cafe-title">Thông tin tài khoản</h1>

          <form onSubmit={handleSave} className="cafe-form">
            <div className="cafe-section">
              <h2 className="cafe-section-title">Thông tin cá nhân</h2>
              <div className="cafe-form">
                <div>
                  <label className="cafe-label">
                    Họ và tên <span className="required">*</span>
                  </label>
                  <input
                    className="cafe-input"
                    value={formData.fullName}
                    onChange={(e) => setFormData((p) => ({ ...p, fullName: e.target.value }))}
                    placeholder="Họ và tên"
                    style={{ width: "100%", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label className="cafe-label">Email</label>
                  <input
                    className="cafe-input"
                    value={customer.email}
                    disabled
                    readOnly
                    style={{ width: "100%", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label className="cafe-label">
                    Số điện thoại <span className="required">*</span>
                  </label>
                  <input
                    className="cafe-input"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        phone: e.target.value.replace(/\D/g, "").slice(0, 10),
                      }))
                    }
                    placeholder="0901234567"
                    maxLength={10}
                    style={{ width: "100%", boxSizing: "border-box" }}
                  />
                </div>
                <div className="form-row">
                  <div>
                    <label className="cafe-label">
                      Giới tính <span className="required">*</span>
                    </label>
                    <select
                      className="cafe-select"
                      value={formData.gender}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          gender: e.target.value as "male" | "female" | "other",
                        }))
                      }
                      style={{ width: "100%", boxSizing: "border-box" }}
                    >
                      <option value="male">Nam</option>
                      <option value="female">Nữ</option>
                      <option value="other">Khác</option>
                    </select>
                  </div>
                  <div>
                    <label className="cafe-label">
                      Ngày sinh <span className="required">*</span>
                    </label>
                    <input
                      className="cafe-input"
                      type="date"
                      value={formData.birthday}
                      onChange={(e) => setFormData((p) => ({ ...p, birthday: e.target.value }))}
                      style={{ width: "100%", boxSizing: "border-box" }}
                    />
                  </div>
                </div>
                <div>
                  <label className="cafe-label">
                    Thành phố <span className="required">*</span>
                  </label>
                  <select
                    className="cafe-select"
                    value={formData.city}
                    onChange={(e) => setFormData((p) => ({ ...p, city: e.target.value }))}
                    style={{ width: "100%", boxSizing: "border-box" }}
                  >
                    <option value="">— Chọn thành phố —</option>
                    {[...CITY_OPTIONS, ...(formData.city && !CITY_OPTIONS.includes(formData.city) ? [formData.city] : [])].map(
                      (c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      )
                    )}
                  </select>
                </div>
              </div>
            </div>

            <div className="cafe-section">
              <h2 className="cafe-section-title">Thông tin thành viên</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
                <div>
                  <label className="cafe-label">Điểm tích lũy</label>
                  <input
                    className="cafe-input"
                    value={String(customer.points)}
                    disabled
                    readOnly
                    style={{ width: "100%", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label className="cafe-label">Hạng</label>
                  <input
                    className="cafe-input"
                    value={customer.level || "member"}
                    disabled
                    readOnly
                    style={{ width: "100%", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label className="cafe-label">Ngày tạo</label>
                  <input
                    className="cafe-input"
                    value={formatDateOnly(customer.createdAt)}
                    disabled
                    readOnly
                    style={{ width: "100%", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label className="cafe-label">Tổng đơn</label>
                  <input
                    className="cafe-input"
                    value={String(customer.totalOrders ?? 0)}
                    disabled
                    readOnly
                    style={{ width: "100%", boxSizing: "border-box" }}
                  />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label className="cafe-label">Đơn gần nhất</label>
                  <input
                    className="cafe-input"
                    value={formatDateOnly(customer.lastOrderDate)}
                    disabled
                    readOnly
                    style={{ width: "100%", boxSizing: "border-box" }}
                  />
                </div>
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="cafe-btn-primary" disabled={saving}>
                {saving ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
              <button type="button" className="cafe-btn-secondary" onClick={handleCancel} disabled={saving}>
                Hủy
              </button>
            </div>

            {err && <p className="cafe-error">{err}</p>}
            {success && <p className="cafe-success">{success}</p>}
          </form>
        </div>
      </main>
    </div>
  );
}
import { Link } from "react-router-dom";

const BRANCHES = [
  {
    to: "/login/store/manager",
    label: "Quản lý cửa hàng",
    desc: "Dành cho Store Manager theo dõi vận hành, nhân sự và báo cáo tại chi nhánh.",
  },
  {
    to: "/login/store/staff",
    label: "Nhân viên / Trưởng ca",
    desc: "Dành cho staff và shift leader thao tác đơn hàng, ca làm và công việc hằng ngày.",
  },
] as const;

export default function StoreBranchSelectPage() {
  return (
    <div style={{ width: "100%", maxWidth: 920 }}>
      <div className="cafe-card" style={{ padding: 32 }}>
        <h1 className="cafe-title">Đăng nhập nhân sự cửa hàng</h1>
        <p className="cafe-subtitle">
          Chọn đúng nhóm tài khoản trước khi tiếp tục để hệ thống mở đúng màn hình làm việc.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 16,
          }}
        >
          {BRANCHES.map((branch) => (
            <Link key={branch.to} to={branch.to} className="cafe-card cafe-portal-card">
              <h3>{branch.label}</h3>
              <p className="portal-desc">{branch.desc}</p>
              <span className="portal-cta">Tiếp tục</span>
            </Link>
          ))}
        </div>

        <div style={{ marginTop: 24, textAlign: "center" }}>
          <Link to="/" className="cafe-link">
            ← Quay lại chọn cổng đăng nhập
          </Link>
        </div>
      </div>
    </div>
  );
}

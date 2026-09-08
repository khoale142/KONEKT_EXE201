import { Link } from "react-router-dom";

const BRANCHES = [
  {
    to: "/login/office/audit",
    label: "Audit",
    desc: "Kiểm tra tuân thủ, đối soát và kiểm toán nội bộ.",
  },
  {
    to: "/login/office/dm",
    label: "District Manager",
    desc: "Quản lý cụm cửa hàng, theo dõi vận hành và hiệu suất khu vực.",
  },
  {
    to: "/login/office/hr",
    label: "Human Resources",
    desc: "Quản lý nhân sự, tuyển dụng và các chính sách nội bộ.",
  },
  {
    to: "/login/office/marketing",
    label: "Marketing / Sale & CSKH",
    desc: "Promotion, voucher, campaign, loyalty, chăm sóc khách hàng",
  },
] as const;

export default function OfficeBranchSelectPage() {
  return (
    <div style={{ width: "100%", maxWidth: 920 }}>
      <div className="cafe-card" style={{ padding: 32 }}>
        <h1 className="cafe-title">Đăng nhập nhân sự office</h1>
        <p className="cafe-subtitle">
          Chọn đúng bộ phận trước khi đăng nhập để truy cập đúng nghiệp vụ và quyền hạn.
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

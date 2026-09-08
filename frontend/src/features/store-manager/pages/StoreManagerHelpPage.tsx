import { Link } from "react-router-dom";
import { DashboardHero, DashboardSection, DashboardShell, RoleBadge, dash } from "../../shared/dashboard/dashboardUi";

const HELP_GROUPS = [
  {
    title: "Tổng quan & phân tích",
    content:
      "Trang chủ chỉ hiển thị nhanh các số liệu và cảnh báo nổi bật trong hôm nay. Khi cần xem đầy đủ danh sách ca vắng, nhân viên đi trễ hoặc các ngày có nhiều sự cố, hãy mở mục Phân tích chấm công.",
  },
  {
    title: "Lịch làm việc",
    content:
      "Mục Lịch làm việc dùng để xem lịch theo tuần của toàn bộ cửa hàng. Nếu cần chia hoặc chỉnh ca cho nhân viên, dùng trang Phân công lịch.",
  },
  {
    title: "Yêu cầu đổi ca",
    content:
      "Trang Yêu cầu đổi ca tập trung các đơn nhân viên gửi lên. Quản lý hoặc trưởng ca có thể xem chi tiết rồi chấp nhận hoặc từ chối từng yêu cầu.",
  },
  {
    title: "Nhân sự & hồ sơ",
    content:
      "Mục Nhân viên mở danh sách nhân sự trong cửa hàng. Mục Yêu cầu chỉnh hồ sơ giúp duyệt thay đổi thông tin cá nhân trước khi cập nhật chính thức.",
  },
  {
    title: "Bảng lương",
    content:
      "Trang Bảng lương hiển thị tổng hợp lương theo tháng của nhân sự cửa hàng, tách dữ liệu nháp và trạng thái đã chốt để dễ theo dõi.",
  },
  {
    title: "Kiểm kê tồn kho",
    content:
      "Trang Tồn kho dùng để ghi nhận kiểm hàng theo ca. Phiếu kiểm hàng do trưởng ca gửi sẽ được xử lý ở mục Xác nhận phiếu kiểm hàng.",
  },
] as const;

export default function StoreManagerHelpPage() {
  return (
    <DashboardShell>
      <DashboardHero
        badge={<RoleBadge>Hỗ trợ</RoleBadge>}
        title="Hướng dẫn sử dụng trang quản lý cửa hàng"
        subtitle="Tổng hợp nhanh ý nghĩa từng module để bạn biết nên mở trang nào cho đúng tác vụ."
        footer={
          <Link
            to="/store/manager"
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "10px 16px",
              borderRadius: 12,
              background: "rgba(255,255,255,0.12)",
              border: "1px solid rgba(255,255,255,0.2)",
              color: "#fff",
              textDecoration: "none",
              fontWeight: 700,
              fontSize: "0.9rem",
            }}
          >
            Quay lại Trang chủ
          </Link>
        }
      />

      <DashboardSection
        title="Ghi chú sử dụng"
        description="Các mô tả ngắn bên dưới thay cho việc nhồi helper text dài vào từng card trên dashboard."
        emphasized
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 16,
          }}
        >
          {HELP_GROUPS.map((group) => (
            <article
              key={group.title}
              style={{
                background: dash.surface,
                border: `1px solid ${dash.border}`,
                borderRadius: dash.radiusLg,
                padding: 20,
                boxShadow: dash.shadow,
              }}
            >
              <h3
                style={{
                  margin: "0 0 10px",
                  color: dash.primaryDark,
                  fontSize: "1rem",
                  fontWeight: 800,
                }}
              >
                {group.title}
              </h3>
              <p style={{ margin: 0, color: dash.muted, lineHeight: 1.6, fontSize: "0.9rem" }}>
                {group.content}
              </p>
            </article>
          ))}
        </div>
      </DashboardSection>
    </DashboardShell>
  );
}

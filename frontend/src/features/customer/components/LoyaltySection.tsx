import { Link } from "react-router-dom";
import SectionHeader from "./SectionHeader";

type LoyaltySectionProps = {
  points?: number;
  voucherCount?: number;
  isLoggedIn: boolean;
};

export default function LoyaltySection({ points, voucherCount, isLoggedIn }: LoyaltySectionProps) {
  return (
    <section className="home-section">
      <div className="home-loyalty">
        <div className="home-loyalty__content">
          <SectionHeader
            title="Ưu đãi dành cho bạn"
            subtitle="Tích điểm, nhận voucher và khám phá quyền lợi hội viên"
          />
          <p>
            Tích điểm sau mỗi đơn hàng, đổi điểm lấy voucher hấp dẫn và nhận ưu đãi riêng cho hội
            viên trong toàn hệ thống.
          </p>
          {isLoggedIn ? (
            <div className="home-loyalty__stats">
              <div className="home-loyalty__stat">
                <strong>{Number(points || 0).toLocaleString("vi-VN")}</strong>
                <span>Điểm hiện có</span>
              </div>
              <div className="home-loyalty__stat">
                <strong>{Number(voucherCount || 0).toLocaleString("vi-VN")}</strong>
                <span>Voucher khả dụng</span>
              </div>
            </div>
          ) : null}
          <div className="home-loyalty__actions">
            <Link to="/customer/vouchers" className="cafe-btn-primary">
              Xem voucher của tôi
            </Link>
            <Link to="/customer/promotions" className="cafe-btn-secondary">
              Xem ưu đãi đang áp dụng
            </Link>
            {!isLoggedIn ? (
              <Link to="/register/customer" className="cafe-btn-secondary">
                Đăng ký hội viên
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

import { Link } from "react-router-dom";

export default function FinalCTASection() {
  return (
    <section className="home-section">
      <div className="home-final-cta">
        <h2>Sẵn sàng cho món yêu thích hôm nay?</h2>
        <p>Đặt hàng nhanh, nhận ưu đãi dễ dàng và tận hưởng trải nghiệm tốt hơn.</p>
        <div className="home-final-cta__actions">
          <Link to="/menu" className="cafe-btn-secondary">
            Xem thực đơn
          </Link>
          <Link to="/customer/order" className="cafe-btn-primary">
            Đặt hàng ngay
          </Link>
        </div>
      </div>
    </section>
  );
}

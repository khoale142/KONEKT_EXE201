import { Link } from "react-router-dom";
import type { HomeProductItem } from "./home.types";
import SectionHeader from "./SectionHeader";

type BestSellerSectionProps = {
  items: HomeProductItem[];
};

export default function BestSellerSection({ items }: BestSellerSectionProps) {
  return (
    <section className="home-section">
      <SectionHeader
        center
        title="Món bán chạy"
        subtitle="Những lựa chọn được khách hàng yêu thích nhất"
      />

      <div className="home-product-grid">
        {items.map((item) => (
          <article key={item.id} className="home-product-card">
            <div className="home-product-card__image-wrap">
              {item.badge ? <span className="home-product-card__badge">{item.badge}</span> : null}
              {item.imageUrl ? (
                <img src={item.imageUrl} alt={item.name} className="home-product-card__image" />
              ) : (
                <div className="home-product-card__image-placeholder">Kohi Coffee</div>
              )}
            </div>
            <div className="home-product-card__content">
              <h3>{item.name}</h3>
              <p className="home-product-card__price">{item.priceText}</p>
              <Link to={item.to} className="cafe-btn-primary home-product-card__cta">
                Đặt mua
              </Link>
            </div>
          </article>
        ))}
      </div>

      <div className="home-section-footer">
        <Link to="/menu" className="cafe-btn-secondary">
          Khám phá thêm thực đơn
        </Link>
      </div>
    </section>
  );
}

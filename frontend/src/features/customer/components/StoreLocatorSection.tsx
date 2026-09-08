import { Link } from "react-router-dom";
import type { HomeStoreItem } from "./home.types";
import SectionHeader from "./SectionHeader";

type StoreLocatorSectionProps = {
  stores: HomeStoreItem[];
};

export default function StoreLocatorSection({ stores }: StoreLocatorSectionProps) {
  return (
    <section className="home-section">
      <SectionHeader
        title="Cửa hàng gần bạn"
        subtitle="Chọn địa điểm thuận tiện để đặt món hoặc ghé quán"
      />
      <div className="home-store-grid">
        {stores.map((store) => (
          <article key={store.id} className="home-store-card">
            <h3>{store.name}</h3>
            <p className="home-store-card__address">{store.address}</p>
            <p className="home-store-card__city">{store.city}</p>
            <p className="home-store-card__status">Đang hoạt động</p>
            {store.openHours ? <p className="home-store-card__hours">Giờ mở cửa: {store.openHours}</p> : null}
            <div className="home-store-card__actions">
              <Link to={store.to} className="cafe-btn-secondary">
                Xem chi tiết
              </Link>
              <Link to="/customer/order" className="cafe-btn-primary">
                Đặt tại cửa hàng này
              </Link>
            </div>
          </article>
        ))}
      </div>
      <div className="home-section-footer">
        <Link to="/stores" className="cafe-btn-secondary">
          Xem tất cả cửa hàng
        </Link>
      </div>
    </section>
  );
}

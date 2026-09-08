import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { HomeNewsCategory, HomeNewsItem } from "./home.types";
import SectionHeader from "./SectionHeader";

type NewsPromotionSectionProps = {
  items: HomeNewsItem[];
  featuredItems?: HomeNewsItem[];
};

const FILTERS: Array<{ id: HomeNewsCategory; label: string }> = [
  { id: "all", label: "Tất cả" },
  { id: "news", label: "Tin tức" },
  { id: "promotion", label: "Khuyến mãi" },
  { id: "voucher", label: "Voucher" },
  { id: "new_product", label: "Món mới" },
  { id: "new_store", label: "Quán mới" },
  { id: "trending", label: "Thịnh hành" },
];

export default function NewsPromotionSection({
  items,
  featuredItems = [],
}: NewsPromotionSectionProps) {
  const [activeFilter, setActiveFilter] = useState<HomeNewsCategory>("all");

  const filteredItems = useMemo(() => {
    if (activeFilter === "all") return items;
    return items.filter((item) => item.category === activeFilter);
  }, [activeFilter, items]);

  return (
    <section className="home-section">
      <SectionHeader
        title="Tin tức & ưu đãi"
        subtitle="Cập nhật bài viết, chiến dịch, khuyến mãi, voucher và thông tin mới nhất từ thương hiệu."
      />

      {featuredItems.length > 0 ? (
        <div className="home-featured-grid">
          {featuredItems.slice(0, 2).map((item) => (
            <Link key={item.id} to={item.to} className="home-featured-card">
              <img src={item.imageUrl} alt={item.title} className="home-featured-card__image" />
              <div className="home-featured-card__overlay" />
              <div className="home-featured-card__content">
                <div className="home-featured-card__meta">
                  {item.badgeLabel ? <span className="home-news-badge is-featured">{item.badgeLabel}</span> : null}
                  <span>{item.typeLabel}</span>
                </div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </div>
            </Link>
          ))}
        </div>
      ) : null}

      <div className="home-tabs">
        {FILTERS.map((filter) => (
          <button
            key={filter.id}
            type="button"
            className={`home-tab ${activeFilter === filter.id ? "is-active" : ""}`}
            onClick={() => setActiveFilter(filter.id)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="home-news-grid">
        {filteredItems.map((item) => (
          <article key={item.id} className="home-news-card">
            <Link to={item.to} className="home-news-card__link-wrap">
              <img src={item.imageUrl} alt={item.title} />
              <div className="home-news-card__content">
                <div className="home-news-card__meta">
                  {item.badgeLabel ? <span className="home-news-badge">{item.badgeLabel}</span> : null}
                  {item.typeLabel ? <span>{item.typeLabel}</span> : null}
                  <span>{item.publishedAt}</span>
                  {item.views ? <span>{item.views.toLocaleString("vi-VN")} lượt xem</span> : null}
                </div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
                <span className="home-news-card__link">
                  {item.category === "promotion" || item.category === "voucher" ? "Mở ưu đãi" : "Đọc thêm"}
                </span>
              </div>
            </Link>
          </article>
        ))}
      </div>

      <div className="home-section-footer">
        <Link to="/discover" className="cafe-btn-secondary">
          Xem thêm bài viết
        </Link>
      </div>
    </section>
  );
}

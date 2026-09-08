import { Link } from "react-router-dom";
import type { HomeActionItem } from "./home.types";

type QuickActionsProps = {
  items: HomeActionItem[];
};

export default function QuickActions({ items }: QuickActionsProps) {
  return (
    <section className="home-section home-quick-actions">
      <div className="home-actions-grid">
        {items.map((item) => (
          <Link key={item.id} to={item.to} className="home-action-card">
            <span className="home-action-card__icon" aria-hidden>
              {item.icon}
            </span>
            <h3>{item.title}</h3>
            <p>{item.subtitle}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

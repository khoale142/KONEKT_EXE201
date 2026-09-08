import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { HomeHeroSlide } from "./home.types";

type HeroSectionProps = {
  slides: HomeHeroSlide[];
};

export default function HeroSection({ slides }: HeroSectionProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) return;
    const id = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => window.clearInterval(id);
  }, [slides.length]);

  if (slides.length === 0) return null;
  const active = slides[activeIndex];

  const nextSlide = () => {
    setActiveIndex((prev) => (prev + 1) % slides.length);
  };
  const prevSlide = () => {
    setActiveIndex((prev) => (prev - 1 + slides.length) % slides.length);
  };

  return (
    <section className="home-hero">
      <div key={active.id} className="home-hero__slide" style={{ backgroundImage: `url(${active.imageUrl})` }}>
        <div className="home-hero__overlay" />
        <div className="home-hero__content">
          <h1>{active.title}</h1>
          <p>{active.description}</p>
          <div className="home-hero__actions">
            <Link to={active.primaryCtaTo} className="cafe-btn-primary">
              Đặt ngay
            </Link>
            <Link to={active.secondaryCtaTo} className="cafe-btn-secondary">
              Xem chi tiết
            </Link>
          </div>
        </div>
      </div>

      {slides.length > 1 ? (
        <>
          <button type="button" className="home-hero__arrow home-hero__arrow--left" onClick={prevSlide} aria-label="Slide trước">
            ‹
          </button>
          <button type="button" className="home-hero__arrow home-hero__arrow--right" onClick={nextSlide} aria-label="Slide tiếp theo">
            ›
          </button>
          <div className="home-hero__dots">
            {slides.map((slide, idx) => (
              <button
                key={slide.id}
                type="button"
                className={`home-hero__dot ${idx === activeIndex ? "is-active" : ""}`}
                onClick={() => setActiveIndex(idx)}
                aria-label={`Đến slide ${idx + 1}`}
              />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}

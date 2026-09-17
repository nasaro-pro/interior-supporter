"use client";

import { useEffect, useState } from "react";

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return reduced;
}

export function PhotoSlider({
  slides,
  intervalMs = 4200,
  dots = false,
}: {
  slides: Array<{ src: string; alt: string }>;
  intervalMs?: number;
  dots?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced || slides.length < 2) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % slides.length);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs, reduced, slides.length]);

  return (
    <div className="photo-slider">
      {slides.map((slide, i) => (
        <img
          key={slide.src}
          src={slide.src}
          alt={slide.alt}
          className={i === index ? "is-active" : undefined}
        />
      ))}
      <div className="photo-slider-scrim" />
      {dots ? (
        <div className="hero-dots">
          {slides.map((slide, i) => (
            <button
              key={slide.src}
              type="button"
              className={i === index ? "is-on" : undefined}
              aria-label={`${i + 1}`}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function FilmStrip({
  images,
  reverse = false,
}: {
  images: string[];
  reverse?: boolean;
}) {
  const loop = [...images, ...images];
  return (
    <div className={`film-strip${reverse ? " is-reverse" : ""}`} aria-hidden>
      <div className="film-strip-track">
        {loop.map((src, i) => (
          <img key={`${src}-${i}`} src={src} alt="" />
        ))}
      </div>
    </div>
  );
}

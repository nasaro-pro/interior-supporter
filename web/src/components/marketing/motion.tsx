"use client";

import { useEffect, type ReactNode } from "react";

export function MotionRoot({ children }: { children: ReactNode }) {
  useEffect(() => {
    const root = document.querySelector(".is-hx") as HTMLElement | null;
    if (!root) return;
    root.classList.add("hx-js");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia("(pointer: coarse)").matches;

    const reveals = [...root.querySelectorAll(".hx-reveal")];
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.01, rootMargin: "0px 0px -4% 0px" },
    );
    for (const el of reveals) io.observe(el);
    const safety = window.setTimeout(() => {
      for (const el of reveals) el.classList.add("is-in");
    }, 900);

    const cursor = document.querySelector<HTMLElement>(".hx-cursor");
    const dot = document.querySelector<HTMLElement>(".hx-cursor-dot");
    let mx = innerWidth / 2;
    let my = innerHeight / 2;
    let cx = mx;
    let cy = my;
    const onMove = (e: PointerEvent) => {
      mx = e.clientX;
      my = e.clientY;
      cursor?.classList.add("is-on");
      const hit = (e.target as HTMLElement | null)?.closest("a, button, summary, input, textarea");
      cursor?.classList.toggle("is-hot", Boolean(hit));
    };

    let current = window.scrollY;
    let target = current;
    let driving = false;
    const maxY = () => Math.max(0, document.documentElement.scrollHeight - innerHeight);
    const onWheel = (e: WheelEvent) => {
      if (reduce || coarse) return;
      if ((e.target as HTMLElement | null)?.closest("input, textarea, select")) return;
      e.preventDefault();
      driving = true;
      target = Math.max(0, Math.min(maxY(), target + e.deltaY));
    };
    const onScroll = () => {
      if (!driving) {
        current = window.scrollY;
        target = current;
      }
    };
    const onHash = (e: Event) => {
      const a = (e.target as HTMLElement | null)?.closest("a[href^='#']");
      if (!a) return;
      const id = a.getAttribute("href")?.slice(1);
      if (!id) return;
      const el = document.getElementById(id);
      if (!el) return;
      e.preventDefault();
      driving = true;
      target = Math.max(0, Math.min(maxY(), el.getBoundingClientRect().top + window.scrollY - 72));
    };

    const map = document.querySelector<HTMLElement>("[data-hx-map]");
    const cards = [...(map?.querySelectorAll<HTMLElement>("[data-hx-pin]") ?? [])];

    let raf = 0;
    const tick = () => {
      cx += (mx - cx) * 0.22;
      cy += (my - cy) * 0.22;
      if (dot) dot.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;

      if (!reduce && !coarse) {
        current += (target - current) * 0.135;
        if (Math.abs(target - current) > 0.35) {
          window.scrollTo(0, current);
        } else {
          current = target;
          driving = false;
        }
      }

      if (map) {
        const rect = map.getBoundingClientRect();
        const span = map.offsetHeight - innerHeight;
        const p = span > 0 ? Math.min(1, Math.max(0, -rect.top / span)) : 0;
        map.style.setProperty("--hx-map-p", String(p));
        const visual = map.querySelector<HTMLElement>(".hx-map-visual img");
        if (visual) visual.style.transform = `scale(${1.08 - p * 0.08}) translate3d(0, ${p * -4}%, 0)`;
        cards.forEach((card, i) => {
          const start = i / cards.length;
          card.classList.toggle("is-on", p > start + 0.04);
        });
      }
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("scroll", onScroll, { passive: true });
    root.addEventListener("click", onHash);
    raf = requestAnimationFrame(tick);

    return () => {
      io.disconnect();
      window.clearTimeout(safety);
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("scroll", onScroll);
      root.removeEventListener("click", onHash);
    };
  }, []);

  return (
    <>
      <div className="hx-cursor" aria-hidden>
        <div className="hx-cursor-dot" />
      </div>
      {children}
    </>
  );
}

export function SplitLines({ text, as: Tag = "span" }: { text: string; as?: "span" | "h1" | "h2" | "p" }) {
  return (
    <Tag className="hx-reveal">
      {text.split("\n").map((line) => (
        <span className="hx-split" key={line}>
          <span>{line}</span>
        </span>
      ))}
    </Tag>
  );
}

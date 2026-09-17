# Page topology

1. loading overlay (time-driven, skipped as blocking UX)
2. header — fixed, z 10000000, hairline frame, Product/Pricing/Resources/About/Contact
3. home-hero — full viewport, building sketch + uppercase H1 + Discover more + ticker
4. home-intro — stacked manifesto + clients marquee
5. home-problem — 4 cards MANUAL/DISJOINTED/BLIND/SLOW
6. home-map — ~7560px sticky WebGL (recreated as sticky floor-plan scroll)
7. home-platform — two product columns
8. home-why — Observe / Advise / Act / Learn
9. home-usecase — people cards
10. cta — sketch + Contact us
11. footer — form + links + map sketch

Interaction: Lenis smooth scroll + GSAP ScrollTrigger. Recreated with native smooth scroll + CSS/IO.
html font-size 11.1111px at 1920 (`100vw / 172.8`). Ink #282828. Accent #FA3600. Paper + grain `bg.svg`. 12-col grid, gap 22.22px. Body pad 8.89px.

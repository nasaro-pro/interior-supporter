export const VISUAL = {
  living: "/visuals/living.jpg",
  lounge: "/visuals/lounge.jpg",
  kitchen: "/visuals/kitchen.jpg",
  dining: "/visuals/dining.jpg",
  bedroom: "/visuals/bedroom.jpg",
  bath: "/visuals/bath.jpg",
  facade: "/visuals/facade.jpg",
  atelier: "/visuals/atelier.jpg",
} as const;

const SITE = "/sites/heronaiapp-com-e0b5c319";
const PAGE = `${SITE}/root-8a5edab2`;

export const HX = {
  bg: `${SITE}/shared/bg.svg`,
  grid: `${SITE}/shared/bg-border-grid.svg`,
  border: `${SITE}/shared/bg-border.svg`,
  dash: `${SITE}/shared/border-dash.svg`,
  vert: `${SITE}/shared/border-vert.svg`,
  hero: `${PAGE}/hero-building.webp`,
  heroDetail: `${PAGE}/hero-detail.avif`,
  cta: `${PAGE}/cta-sketch.webp`,
  footer: `${PAGE}/footer.avif`,
  plan: `${PAGE}/plan.jpg`,
  floor: `${PAGE}/floor.png`,
  dashboard: `${PAGE}/dashboard.avif`,
  before: `${PAGE}/before.avif`,
  chat: `${PAGE}/chat.jpg`,
  peopleInterior: `${PAGE}/people-interior.jpg`,
  peopleArchitects: `${PAGE}/people-architects.jpg`,
  peopleEngineers: `${PAGE}/people-engineers.jpg`,
  peopleDrafters: `${PAGE}/people-drafters.jpg`,
} as const;

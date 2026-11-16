// 포트폴리오 경로 — 원본은 src/shared/contracts/routes.ts (CR-PF-02 반영). 이 파일은 짧은 이름 + 공개 이미지 주소만.
import { routes } from '@/shared/contracts/routes';

export const portfolioRoutes = {
  /** 공개 포트폴리오 (로그인 없이) PUB-10 */
  home: (slug: string) => routes.portfolio.home(slug),
  /** 공개 사례 상세 PUB-11 */
  work: (slug: string, workId: string) => routes.portfolio.work(slug, workId),
  /** 로그인 / 마이홈 / 관리 페이지 (한 주소, 받는 쪽이 갈 곳을 정함) */
  my: (slug: string) => routes.portfolio.my(slug),
  /** 관리 탭 PM-65 */
  settings: (slug: string) => routes.app.settings(slug, 'portfolio'),
  /** 관리자 미리보기 (PM-65 화면 상태 — 비공개 사례 포함) */
  preview: (slug: string) => routes.app.portfolioPreview(slug),
  previewWork: (slug: string, workId: string) => routes.app.portfolioPreview(slug, workId),
} as const;

const enc = encodeURIComponent;

/** 공개 버킷 객체 주소 — 인증·서명 없이 바로 열린다 (사본만 들어 있는 버킷) */
export function publicImageUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  return `${base}/storage/v1/object/public/portfolio-public/${path.split('/').map(enc).join('/')}`;
}

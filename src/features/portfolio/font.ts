// 공개 페이지 글꼴 (next/font/google → 빌드 때 우리 서버로 복사돼 font-src 'self' 그대로)
//  - 노토 산스 KR: 제목·본문 기본 (20261108001000). 400·500·600
//  - 노토 세리프 KR: 업체가 명조를 고르면 제목에 씀. 400·500·600
// 굵기마다 파일이 따로지만 페이지에서 실제로 쓰인 굵기만 받는다
// preload 끔 → 업체가 실제로 고른 글꼴만, 쓰인 글자 묶음만 그때그때 받는다. 프리텐다드는 루트 레이아웃이 이미 불러옴
import { Noto_Sans_KR, Noto_Serif_KR } from 'next/font/google';

export const brandSerif = Noto_Serif_KR({
  weight: ['400', '500', '600'],
  subsets: ['latin'],
  display: 'swap',
  preload: false,
  variable: '--font-brand-serif',
});

export const brandSans = Noto_Sans_KR({
  weight: ['400', '500', '600'],
  subsets: ['latin'],
  display: 'swap',
  preload: false,
  variable: '--font-noto-sans',
});

/** 공개 틀·관리 탭 글꼴 견본에 붙이는 변수 클래스 */
export const brandFontClass = `${brandSerif.variable} ${brandSans.variable}`;

// 홈페이지 전용 로고 받는 기준 — 서버(logo-actions)와 화면(LogoField)이 같이 쓴다
/** 내용으로 확인하는 형식 (sharp format 이름). SVG·GIF·HEIC 는 받지 않는다 */
export const LOGO_TYPES = ['png', 'jpeg', 'webp'] as const;
/** 파일 고르기 창에 넘기는 형식 */
export const LOGO_ACCEPT = 'image/png,image/jpeg,image/webp';
/** 서버로 보내는 크기 상한 — 서버 액션 본문 한도(1MB) 안. 큰 사진은 화면에서 먼저 줄인다 */
export const LOGO_MAX_BYTES = 950_000;
/** 화면에서 줄일 때 긴 변 (공개 사본은 서버가 다시 640px 로 만든다) */
export const LOGO_PREP_EDGE = 1024;

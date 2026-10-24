// 도안 공개 API — 다른 기능(A 의 개요·알림 등록부)은 이 파일만 import
// 고객 홈 문서 영역(DocumentsProvider)의 도안 부분은 server/summary.ts 의 documentsProvider (CR-INT-01 잠정)
export { designsSummary } from '@/features/designs/server/summary';
export { resolveDesignTarget } from '@/features/designs/server/notification-target';

// src/features/core/index.ts (A) — 공개 API. B·C 는 이 파일만 import 한다 (헌법 4.3)
// 계약: src/shared/contracts/integration.ts 1장 AccessApi
export {
  getAccessContext,
  requireProjectAccess,
  requireCompanyStaff,
  findProjectAccess,
} from './server/access';
export type { AccessContext, ProjectAccess } from '@/shared/contracts/integration';

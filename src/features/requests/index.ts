// requests 기능 공개 API — 클라이언트에서도 import 할 수 있도록 server 코드를 재수출하지 않는다.
// 연동 계약(SummaryProvider·NotificationTargetResolver)은 integration.ts 가 정한 경로
// `src/features/requests/server/{summary,notification-target}.ts` 에서 제공한다.
// UI 부품은 A 표준(`@/shared/ui/*`, `@/shared/hooks/*`)을 직접 쓴다 — C 전용 kit 은 P3 에서 삭제했다.
export type { RequestDetail, RequestListFilters, RequestListItem } from './types';
// C 공통 순수 도우미 (photos·schedule 도 사용 — UI 아님)
export {
  firstParam,
  parseListSize,
  withQuery,
  isUuid,
  escapeLike,
  type SearchParams,
} from './lib/list-params';

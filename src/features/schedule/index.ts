// schedule 기능 공개 API — 클라이언트에서도 import 할 수 있도록 server 코드를 재수출하지 않는다.
// 연동 계약(NextScheduleProvider·해석기)은 `src/features/schedule/server/{summary,notification-target}.ts`,
// 일정 조회(CT07)는 `server/queries.ts` 에서 제공한다.
export type { ScheduleEvent, ScheduleEventWithProject } from './types';
export { RELATED_TYPES, type RelatedType } from './schema';
export { buildMonthGrid, eventsOnDay, weekDays } from './lib/calendar';
export { formatEventWhen } from './lib/format';

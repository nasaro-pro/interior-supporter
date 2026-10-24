// src/features/core/notifications/targets.ts (A · TASK-010) — 알림 대상 해석기 등록부 (integration.ts 4장)
// 알림 행에는 object_type/object_id 만 있다. 제목·링크는 열 때 현재 권한으로 다시 조회한다 (POL-027, A-T07).
// B·C 해석기 위치·이름: src/features/<기능>/server/notification-target.ts 의 `notificationTarget`
//   — 계약(integration.ts)에 export 이름이 없어 CR-A-01 로 고정 요청 (progress/A.md 4번)
import 'server-only';
import {
  NOTIFICATION_TARGET_OWNERS,
  type NotificationTargetResolver,
} from '@/shared/contracts/integration';
import { notificationTarget as designs } from '@/features/designs/server/notification-target';
import { notificationTarget as materials } from '@/features/materials/server/notification-target';
import { notificationTarget as estimateVersions } from '@/features/estimates/server/notification-target';
import { notificationTarget as requests } from '@/features/requests/server/notification-target';
import { notificationTarget as photos } from '@/features/photos/server/notification-target';
import { notificationTarget as scheduleEvents } from '@/features/schedule/server/notification-target';
import { participantTarget } from './participant-target';

export const NOTIFICATION_TARGETS: Record<
  keyof typeof NOTIFICATION_TARGET_OWNERS,
  NotificationTargetResolver
> = {
  project_participants: participantTarget,
  designs,
  materials,
  estimate_versions: estimateVersions,
  requests,
  photos,
  schedule_events: scheduleEvents,
};

export function resolverFor(objectType: string): NotificationTargetResolver | null {
  return objectType in NOTIFICATION_TARGETS
    ? NOTIFICATION_TARGETS[objectType as keyof typeof NOTIFICATION_TARGETS]
    : null;
}

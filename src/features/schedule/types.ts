// schedule 화면용 타입 (camelCase) — date/time 은 KST 달력 값 그대로 (POL-023)
import type { RelatedType, ScheduleProgress } from './schema';

export interface ScheduleEvent {
  id: string;
  projectId: string;
  title: string;
  description: string;
  /** 'YYYY-MM-DD' */
  startDate: string;
  /** 'HH:MM' — null 이면 종일 */
  startTime: string | null;
  /** 'YYYY-MM-DD' (포함) — null 이면 시작일 하루 */
  endDate: string | null;
  endTime: string | null;
  isPublic: boolean;
  /** D-30 예정 · 진행중 · 완료 */
  progress: ScheduleProgress;
  relatedType: RelatedType | null;
  relatedId: string | null;
  archived: boolean;
  version: number;
  createdAt: string;
}

/** 전체 캘린더 등에서 프로젝트 이름을 함께 보여 줄 때 */
export interface ScheduleEventWithProject extends ScheduleEvent {
  projectName: string;
}

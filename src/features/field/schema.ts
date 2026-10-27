// 시공팀 열람 설정 입력 검증 — project_field_settings 열과 같다 (F2·F9)
import { z } from 'zod';

export const fieldAccessSchema = z.object({
  projectId: z.uuid(),
  showSchedule: z.boolean(),
  showDesigns: z.boolean(),
  showMaterials: z.boolean(),
  photoAutoPublic: z.boolean(),
});
export type FieldAccessInput = z.infer<typeof fieldAccessSchema>;

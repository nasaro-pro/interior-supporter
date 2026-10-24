// 업로더 표시 — "업체 · 이름" / 이름을 볼 수 없으면(can_see_profile) 역할만. PM·고객·시공팀 공통
import type { PhotoItem } from '../types';

type T = (key: string) => string;

export function uploaderLabel(t: T, photo: Pick<PhotoItem, 'uploaderRole' | 'uploaderName'>) {
  const role = t(`uploaderRole.${photo.uploaderRole}`);
  return photo.uploaderName ? `${role} · ${photo.uploaderName}` : role;
}

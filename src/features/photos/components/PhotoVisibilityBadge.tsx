// 공개/비공개 배지 — 02 문서 7.2 고정 매핑(StatusBadge): 공개 brand·Eye / 비공개 neutral·EyeOff (PM·시공팀 화면에서만)
import { useTranslations } from 'next-intl';
import { StatusBadge } from '@/shared/ui/status-badge';

export function PhotoVisibilityBadge({ isPublic }: { isPublic: boolean }) {
  const t = useTranslations('common.visibility');
  return isPublic ? (
    <StatusBadge status="public" label={t('public')} />
  ) : (
    <StatusBadge status="private" label={t('private')} />
  );
}

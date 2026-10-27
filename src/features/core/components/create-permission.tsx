'use client';
// src/features/core/components/create-permission.tsx (A · D-36 · CA-07) — 프로젝트 생성 권한
// - 담당자 화면: 권한이 있으면 '생성' Sheet, 없으면 '생성 권한 요청' 버튼, 요청 중이면 안내
// - 업체관리자 화면: 담당자별 켜기/끄기 스위치, 대기 요청 승인·거절
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Check, Clock, KeyRound, X } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Switch } from '@/shared/ui/switch';
import { useActionErrorText } from '@/shared/ui/action-error';
import {
  decideProjectCreatePermission,
  requestProjectCreatePermission,
  setProjectCreatePermission,
} from '../server/create-permission-actions';
import { ProjectCreateSheet } from './project-forms';

export function ProjectCreateEntry({
  companySlug,
  companyId,
  allowed,
  pending,
}: {
  companySlug: string;
  companyId: string;
  allowed: boolean;
  pending: boolean;
}) {
  const t = useTranslations('projects');
  const router = useRouter();
  const errorText = useActionErrorText();
  const [busy, start] = useTransition();
  if (allowed) return <ProjectCreateSheet companySlug={companySlug} />;
  if (pending) {
    return (
      <span
        className="text-muted-foreground text-meta inline-flex items-center gap-1"
        data-ui-key="project-create-pending"
      >
        <Clock aria-hidden className="size-3.5" />
        {t('createPermission.pending')}
      </span>
    );
  }
  return (
    <Button
      variant="outline"
      disabled={busy}
      aria-busy={busy}
      data-ui-key="project-create-request"
      onClick={() =>
        start(async () => {
          const res = await requestProjectCreatePermission({ companyId, note: '' });
          if (!res.ok) {
            toast.error(errorText(res.error));
            return;
          }
          toast.success(t('createPermission.requested'));
          router.refresh();
        })
      }
    >
      <KeyRound aria-hidden />
      {t('createPermission.request')}
    </Button>
  );
}

/** 업체관리자: 담당자 한 명의 생성 권한 스위치 */
export function CreatePermissionSwitch({
  companyId,
  memberId,
  allowed,
  name,
}: {
  companyId: string;
  memberId: string;
  allowed: boolean;
  name: string;
}) {
  const t = useTranslations('settings');
  const router = useRouter();
  const errorText = useActionErrorText();
  const [value, setValue] = useState(allowed);
  const [synced, setSynced] = useState(allowed);
  if (synced !== allowed) {
    setSynced(allowed);
    setValue(allowed);
  }
  const [busy, start] = useTransition();
  return (
    <Switch
      checked={value}
      disabled={busy}
      aria-label={t('members.createPermissionFor', { name })}
      data-ui-key="member-create-permission"
      onCheckedChange={(next) =>
        start(async () => {
          const res = await setProjectCreatePermission({ companyId, memberId, allowed: next });
          if (!res.ok) {
            toast.error(errorText(res.error)); // 실패 → 서버 값 그대로
            return;
          }
          setValue(next);
          toast.success(next ? t('toast.createPermissionOn') : t('toast.createPermissionOff'));
          router.refresh();
        })
      }
    />
  );
}

/** 업체관리자: 대기 요청 승인·거절 버튼 */
export function CreateRequestDecision({
  companyId,
  requestId,
  name,
}: {
  companyId: string;
  requestId: string;
  name: string;
}) {
  const t = useTranslations('settings');
  const router = useRouter();
  const errorText = useActionErrorText();
  const [busy, start] = useTransition();
  const decide = (approve: boolean) =>
    start(async () => {
      const res = await decideProjectCreatePermission({ companyId, requestId, approve });
      if (!res.ok) {
        toast.error(errorText(res.error));
        return;
      }
      toast.success(approve ? t('toast.createRequestApproved') : t('toast.createRequestRejected'));
      router.refresh();
    });
  return (
    <span className="flex gap-1">
      <Button
        size="sm"
        disabled={busy}
        aria-label={t('createRequests.approveFor', { name })}
        data-ui-key="create-request-approve"
        onClick={() => decide(true)}
      >
        <Check aria-hidden />
        {t('createRequests.approve')}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={busy}
        aria-label={t('createRequests.rejectFor', { name })}
        data-ui-key="create-request-reject"
        onClick={() => decide(false)}
      >
        <X aria-hidden />
        {t('createRequests.reject')}
      </Button>
    </span>
  );
}

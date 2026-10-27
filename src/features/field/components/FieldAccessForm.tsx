'use client';
// PM-10 '시공팀 공개 범위' 구역 (F2·F9) — 담당자가 시공팀에게 보여 줄 탭과 '시공팀 사진 바로 공개'를 켠다
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/shared/ui/button';
import { SwitchField } from '@/shared/ui/switch-field';
import { saveFieldAccess } from '../server/actions';
import type { FieldAccessSettings } from '../types';

const FIELDS = ['showSchedule', 'showDesigns', 'showMaterials', 'photoAutoPublic'] as const;

export function FieldAccessForm({
  projectId,
  value,
}: {
  projectId: string;
  value: FieldAccessSettings;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [draft, setDraft] = useState(value);
  const [pending, start] = useTransition();
  const dirty = FIELDS.some((k) => draft[k] !== value[k]);

  const save = () =>
    start(async () => {
      const res = await saveFieldAccess({ projectId, ...draft });
      if (res.ok) {
        toast.success(t('field.access.saved'));
        router.refresh();
      } else toast.error(t(`errors.${res.error.code}`));
    });

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">{t('field.access.hint')}</p>
      {FIELDS.map((k) => (
        <SwitchField
          key={k}
          id={`field-access-${k}`}
          label={t(`field.access.${k}.label`)}
          description={t(`field.access.${k}.hint`)}
          checked={draft[k]}
          onCheckedChange={(on: boolean) => setDraft((d) => ({ ...d, [k]: on }))}
          uiKey={`field-access-${k}`}
        />
      ))}
      <div>
        <Button
          size="sm"
          onClick={save}
          disabled={pending || !dirty}
          aria-busy={pending}
          data-ui-key="field-access-save"
        >
          {t('common.action.save')}
        </Button>
      </div>
    </div>
  );
}

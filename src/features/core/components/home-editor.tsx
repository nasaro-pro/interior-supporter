'use client';
// src/features/core/components/home-editor.tsx (A · TASK-012, REQ-014) — 고객 홈 편집 (화면 상태 ?mode=edit, D4/D5 없음)
// 안내문 2,000자 + 4영역 순서(위/아래)·표시. 저장 실패 시 편집 내용 보존 (POL-026)
import { useState, useTransition } from 'react';
import { ButtonLink } from '@/shared/ui/button-link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Textarea } from '@/shared/ui/textarea';
import { FormError } from '@/shared/ui/form-parts';
import { ConflictState } from '@/shared/ui/states';
import type { AppError } from '@/shared/contracts/errors';
import type { HomeSections } from '@/shared/contracts/domain';
import { updateHome } from '../server/project-actions';
import { moveSection } from '../home-sections';

export function HomeEditor({
  projectId,
  version,
  homeMessage,
  homeSections,
  doneHref,
}: {
  projectId: string;
  version: number;
  homeMessage: string;
  homeSections: HomeSections;
  doneHref: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [message, setMessage] = useState(homeMessage);
  const [sections, setSections] = useState(homeSections);
  const [error, setError] = useState<AppError | null>(null);
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      setError(null);
      const res = await updateHome({
        projectId,
        baseVersion: version,
        homeMessage: message,
        homeSections: sections,
      });
      if (res.ok) {
        toast.success(t('projects.home.saved'));
        router.replace(doneHref);
        router.refresh();
      } else setError(res.error);
    });

  if (error?.code === 'VERSION_CONFLICT') {
    return (
      <ConflictState
        action={
          <Button
            onClick={() => {
              // A-06: 충돌 안내를 닫고 편집 화면으로 — 입력(안내문·영역 순서)은 그대로 두고,
              // refresh 로 받은 최신 version 이 다음 저장의 baseVersion 이 된다
              setError(null);
              router.refresh();
            }}
            data-ui-key="home-editor-reload"
          >
            {t('common.action.loadLatest')}
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="home-message" className="text-sm font-medium">
          {t('projects.field.homeMessage')}
        </label>
        <Textarea
          id="home-message"
          value={message}
          maxLength={2000}
          rows={6}
          onChange={(e) => setMessage(e.target.value)}
          aria-describedby="home-message-count"
        />
        <p
          id="home-message-count"
          className="text-muted-foreground text-meta text-end tabular-nums"
        >
          {message.length} / 2000
        </p>
      </div>
      <ol className="flex flex-col gap-2" aria-label={t('projects.home.sectionsLabel')}>
        {sections.map((s, i) => (
          <li
            key={s.key}
            data-key={s.key}
            className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
          >
            <span className="font-medium">{t(`projects.homeSection.${s.key}`)}</span>
            <span className="flex items-center gap-1">
              <label className="me-2 inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="accent-primary size-4"
                  checked={s.visible}
                  onChange={(e) =>
                    setSections(
                      sections.map((x) =>
                        x.key === s.key ? { ...x, visible: e.target.checked } : x,
                      ),
                    )
                  }
                  data-ui-key="home-section-visible-toggle"
                />
                {t('projects.home.show')}
              </label>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t('projects.home.moveUp')}
                disabled={i === 0}
                onClick={() => setSections(moveSection(sections, i, -1))}
                data-ui-key="home-section-move-up"
              >
                <ArrowUp aria-hidden />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t('projects.home.moveDown')}
                disabled={i === sections.length - 1}
                onClick={() => setSections(moveSection(sections, i, 1))}
                data-ui-key="home-section-move-down"
              >
                <ArrowDown aria-hidden />
              </Button>
            </span>
          </li>
        ))}
      </ol>
      <FormError error={error} />
      <div className="flex gap-2">
        <Button
          onClick={save}
          disabled={pending}
          aria-busy={pending}
          data-ui-key="home-editor-save"
        >
          {t('common.action.save')}
        </Button>
        <ButtonLink href={doneHref} variant="outline" data-ui-key="home-editor-cancel">
          {t('common.action.cancel')}
        </ButtonLink>
      </div>
    </div>
  );
}

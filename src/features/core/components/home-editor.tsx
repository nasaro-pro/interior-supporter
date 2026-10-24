'use client';
// src/features/core/components/home-editor.tsx (A · TASK-012, REQ-014) — 고객 홈 편집 (화면 상태 ?mode=edit, D4/D5 없음)
// 안내문 2,000자 + 4영역 순서(위/아래)·표시 + 색상 테마·배경 표시. 저장 실패 시 편집 내용 보존 (POL-026)
import { useState, useTransition } from 'react';
import { ButtonLink } from '@/shared/ui/button-link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/shared/ui/button';
import { Textarea } from '@/shared/ui/textarea';
import { FormError } from '@/shared/ui/form-parts';
import { ConflictState } from '@/shared/ui/states';
import type { AppError } from '@/shared/contracts/errors';
import type { HomeSections } from '@/shared/contracts/domain';
import { updateHome } from '../server/project-actions';
import type { HomeTheme } from '../home-theme';
import { HomeSectionsField, HomeThemeField } from './home-template-fields';

export function HomeEditor({
  projectId,
  version,
  homeMessage,
  homeSections,
  homeTheme,
  homeBackgroundFileId,
  doneHref,
}: {
  projectId: string;
  version: number;
  homeMessage: string;
  homeSections: HomeSections;
  homeTheme: HomeTheme;
  homeBackgroundFileId: string | null;
  doneHref: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [message, setMessage] = useState(homeMessage);
  const [sections, setSections] = useState(homeSections);
  const [theme, setTheme] = useState(homeTheme);
  const [background, setBackground] = useState(homeBackgroundFileId);
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
        homeTheme: theme,
        homeBackgroundFileId: background,
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
      <HomeSectionsField
        sections={sections}
        onChange={setSections}
        label={t('projects.home.sectionsLabel')}
      />
      <HomeThemeField
        name="home-theme"
        value={theme}
        onChange={setTheme}
        label={t('projects.home.themeLabel')}
      />
      {homeBackgroundFileId ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t('projects.home.backgroundLabel')}</span>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="accent-primary size-4"
              checked={background !== null}
              onChange={(e) => setBackground(e.target.checked ? homeBackgroundFileId : null)}
              data-ui-key="home-background-toggle"
            />
            {t('projects.home.showBackground')}
          </label>
          <p className="text-muted-foreground text-meta">{t('projects.home.backgroundHint')}</p>
        </div>
      ) : null}
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

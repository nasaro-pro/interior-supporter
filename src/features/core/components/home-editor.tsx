'use client';
// src/features/core/components/home-editor.tsx (A · TASK-012, REQ-014) — 고객 홈 편집 (화면 상태 ?mode=edit, D4/D5 없음)
// 안내문 2,000자 + 4영역 순서(위/아래)·표시 + 색상 테마 + 페이지 분위기·페이지 이미지 표시. 저장 실패 시 편집 내용 보존 (POL-026)
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
import { routes } from '@/shared/contracts/routes';
import { PORTAL_TABS } from '@/shared/contracts/screens';
import type { HomeTheme } from '../home-theme';
import type { PageImages, PageTone } from '../page-theme';
import { HomeSectionsField, HomeThemeField, PageToneField } from './home-template-fields';

export function HomeEditor({
  projectId,
  version,
  homeMessage,
  homeSections,
  homeTheme,
  pageImages,
  pageTone,
  doneHref,
}: {
  projectId: string;
  version: number;
  homeMessage: string;
  homeSections: HomeSections;
  homeTheme: HomeTheme;
  pageImages: PageImages;
  pageTone: PageTone;
  doneHref: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [message, setMessage] = useState(homeMessage);
  const [sections, setSections] = useState(homeSections);
  const [theme, setTheme] = useState(homeTheme);
  const [tone, setTone] = useState(pageTone);
  const [images, setImages] = useState<PageImages>(pageImages);
  // 템플릿에서 복사된 이미지가 있는 탭만 (여기서는 표시 여부만 고른다)
  const templateTabs = PORTAL_TABS.filter((tab) => pageImages[tab]);
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
        pageImages: images,
        pageTone: tone,
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
      <PageToneField
        name="home-page-tone"
        value={tone}
        onChange={setTone}
        label={t('projects.home.pageToneLabel')}
      />
      {templateTabs.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium" id="home-page-images-label">
            {t('projects.home.pageImagesLabel')}
          </span>
          <ul className="flex flex-col gap-2" aria-labelledby="home-page-images-label">
            {templateTabs.map((tab) => (
              <li
                key={tab}
                data-key={tab}
                className="flex items-center gap-3 rounded-md border px-3 py-2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- /api/files 302 서명 URL (next/image 최적화 대상 아님) */}
                <img
                  src={routes.file(pageImages[tab]!)}
                  alt=""
                  className="aspect-video w-20 shrink-0 rounded border object-cover"
                />
                <span className="min-w-0 flex-1 font-medium">{t(`projects.tab.${tab}`)}</span>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="accent-primary size-4"
                    checked={!!images[tab]}
                    onChange={(e) =>
                      setImages((prev) => {
                        const next = { ...prev };
                        if (e.target.checked) next[tab] = pageImages[tab];
                        else delete next[tab];
                        return next;
                      })
                    }
                    data-ui-key="home-page-image-toggle"
                  />
                  {t('projects.home.showImage')}
                </label>
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground text-meta">{t('projects.home.pageImagesHint')}</p>
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

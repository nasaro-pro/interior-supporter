// PM-14 / CL-14 도안 상세 (D4) — 같은 컴포넌트 + viewer.as 로 동작 버튼만 다르게 (02 문서 5장)
// 헤더(제목·상태 배지·주요 동작) → 메타 → 본문(비교) → 사이드(기록·버전)
// 고객 화면에는 비공개 항목·과거 버전·편집 버튼·내부 행위자·미확정 배지를 그리지 않는다
import { getLocale, getTranslations } from 'next-intl/server';
import { Download } from 'lucide-react';
import type { ProjectAccess } from '@/shared/contracts/integration';
import { formatDateTime } from '@/shared/lib/dates';
import { ArchiveToggle, PublishToggle } from '@/shared/ui/record-actions';
import { Notice } from '@/shared/ui/notice';
import { Section } from '@/shared/ui/section';
import { buttonVariants } from '@/shared/ui/button';
import { FileDownloadLink, extOf } from '@/features/files';
import type { ComparablePreview } from '@/features/designs/server/queries';
import { setDesignArchived, setDesignPublic } from '@/features/designs/server/actions';
import type { DesignDetail } from '@/features/designs/types';
import { CompareSlider } from '@/features/designs/components/CompareSlider';
import { ConfirmButton } from '@/features/designs/components/ConfirmButton';
import { ConfirmRecord, confirmedLine } from '@/features/designs/components/ConfirmRecord';
import { DesignEditButton } from '@/features/designs/components/DesignEditButton';
import { DesignVersionAddButton } from '@/features/designs/components/DesignVersionAddButton';
import { DesignVersionList } from '@/features/designs/components/DesignVersionList';
import { PreviewAddButton } from '@/features/designs/components/PreviewAddButton';
import { PreviewArchiveButton } from '@/features/designs/components/PreviewArchiveButton';
import { ReconfirmRequestButton } from '@/features/designs/components/ReconfirmRequestButton';
import {
  ArchivedBadge,
  ConfirmStateBadge,
  VisibilityBadge,
} from '@/features/designs/components/StateBadges';

export async function DesignDetailView({
  design,
  viewer,
  candidates,
}: {
  design: DesignDetail;
  viewer: ProjectAccess;
  candidates: ComparablePreview[];
}) {
  const t = await getTranslations('designs');
  const tc = await getTranslations('common');
  const locale = (await getLocale()) === 'en' ? 'en' : 'ko';
  const editor = viewer.as === 'editor';
  const confirmer = viewer.as === 'customer' && viewer.canConfirm;
  const current = design.versions.find((v) => v.versionNo === design.currentVersion) ?? null;
  const currentExt = current?.file ? extOf(current.file.name) : '';
  const isCad = currentExt === '.skp' || currentExt === '.dwg';
  const versioned = { projectId: viewer.projectId, id: design.id, baseVersion: design.version };
  const ownPreview = candidates.find((c) => c.designId === design.id);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold break-words">{design.title}</h2>
          {editor ? (
            <VisibilityBadge
              isPublic={design.isPublic}
              label={design.isPublic ? tc('visibility.public') : tc('visibility.private')}
            />
          ) : null}
          {/* 미확정 배지는 PM 화면만 (고객에게는 그리지 않는다) */}
          {editor || design.confirmState !== 'none' ? (
            <ConfirmStateBadge
              state={design.confirmState}
              label={t(`confirmState.${design.confirmState}`)}
            />
          ) : null}
          {design.archivedAt ? <ArchivedBadge label={tc('filter.archived')} /> : null}
        </div>
        {editor ? (
          <div className="flex flex-wrap gap-2">
            {/* B-06: 보관된 도안은 읽기 전용 — 수정·공개·새 버전은 복원 후 */}
            {design.archivedAt ? null : (
              <>
                <DesignEditButton
                  projectId={viewer.projectId}
                  id={design.id}
                  baseVersion={design.version}
                  title={design.title}
                  description={design.description}
                />
                <PublishToggle
                  action={setDesignPublic}
                  payload={versioned}
                  isPublic={design.isPublic}
                  confirm={{ title: t('publish.title'), body: t('publish.hint') }}
                  uiKey="design-publish-toggle"
                />
                <DesignVersionAddButton
                  projectId={viewer.projectId}
                  companyId={viewer.companyId}
                  designId={design.id}
                  nextVersionNo={design.currentVersion + 1}
                  confirmed={design.confirmState === 'confirmed'}
                />
              </>
            )}
            {design.confirmState === 'confirmed' && !design.archivedAt ? (
              <ReconfirmRequestButton
                projectId={viewer.projectId}
                targetType="designs"
                targetId={design.id}
              />
            ) : null}
            <ArchiveToggle
              action={setDesignArchived}
              payload={versioned}
              archived={!!design.archivedAt}
              uiKey="design-archive"
            />
          </div>
        ) : null}
        {editor && design.archivedAt ? (
          <Notice tone="neutral">{tc('state.archivedItem')}</Notice>
        ) : null}
        {editor && !design.isPublic ? (
          <Notice tone="neutral">{tc('state.privateItem')}</Notice>
        ) : null}
        {editor && design.confirmState === 'needs_reconfirm' ? (
          <Notice tone="attention">{t('state.pmNeedsReconfirm')}</Notice>
        ) : null}
      </header>

      <section aria-label={t('screen.detail')} className="flex min-w-0 flex-col gap-2 text-sm">
        {design.description ? (
          <p className="text-base break-words whitespace-pre-wrap">{design.description}</p>
        ) : null}
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1">
          <dt className="text-muted-foreground">{t('field.currentVersion')}</dt>
          <dd data-numeric>{t('field.version', { no: design.currentVersion })}</dd>
          <dt className="text-muted-foreground">{tc('field.updatedAt')}</dt>
          <dd data-numeric>{formatDateTime(design.updatedAt, locale)}</dd>
          {current?.file ? (
            <>
              <dt className="text-muted-foreground">{t('field.original')}</dt>
              <dd className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="min-w-0 truncate">{current.file.name}</span>
                {/* B-T02: 비교 이미지와 무관하게 원본 다운로드 가능 */}
                <FileDownloadLink
                  fileId={current.file.id}
                  uiKey="design-original-download"
                  className={buttonVariants({ variant: 'outline', size: 'sm' })}
                >
                  <Download aria-hidden />
                  {t('action.downloadOriginal')}
                </FileDownloadLink>
              </dd>
            </>
          ) : null}
        </dl>
      </section>

      {/* 고객: 확정권 고객에게만 확정 버튼 (REQ-120) */}
      {confirmer ? (
        <ConfirmButton
          projectId={viewer.projectId}
          targetType="designs"
          targetId={design.id}
          revision={design.currentVersion}
          state={design.confirmState}
          summary={`${design.title} · ${t('field.version', { no: design.currentVersion })}`}
          confirmedLine={await confirmedLine(design.confirmations)}
        />
      ) : null}

      <Section
        title={t('field.previews')}
        actions={
          editor && !design.archivedAt ? (
            <PreviewAddButton
              projectId={viewer.projectId}
              companyId={viewer.companyId}
              designId={design.id}
              versions={design.versions.map((v) => ({
                id: v.id,
                versionNo: v.versionNo,
                fileId: v.file?.id ?? null,
                isPdf: v.file?.mime === 'application/pdf',
              }))}
            />
          ) : undefined
        }
      >
        {design.previews.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {isCad ? t('preview.cadHint') : t('preview.empty')}
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2 text-sm">
            {design.previews.map((p) => (
              <li
                key={p.id}
                data-key={p.id}
                className="bg-card flex max-w-full min-w-0 items-center gap-2 rounded-md border px-2 py-1"
              >
                <span className="min-w-0 truncate">{p.label}</span>
                <span className="text-meta text-muted-foreground shrink-0">
                  {p.versionNo ? t('field.version', { no: p.versionNo }) : t('field.wholeDesign')}
                  {p.pdfPage ? ` · ${t('field.pdfPage', { page: p.pdfPage })}` : ''}
                </span>
                {editor && !design.archivedAt ? (
                  <PreviewArchiveButton
                    projectId={viewer.projectId}
                    designId={design.id}
                    id={p.id}
                    label={p.label}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <CompareSlider
          images={candidates.map((c) => ({
            id: c.id,
            fileId: c.fileId,
            label: c.label,
            designTitle: c.designTitle,
            versionNo: c.versionNo,
            pdfPage: c.pdfPage,
          }))}
          initialA={ownPreview?.id}
        />
      </Section>

      {/* 확정권 고객은 ConfirmButton 이 현재 확정 기록을 보여 준다 (중복 표시 없음) */}
      {confirmer ? null : <ConfirmRecord records={design.confirmations} showHistory={editor} />}

      {editor ? (
        <DesignVersionList versions={design.versions} currentVersion={design.currentVersion} />
      ) : null}
    </div>
  );
}

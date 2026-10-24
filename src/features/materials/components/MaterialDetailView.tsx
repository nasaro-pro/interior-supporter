// PM-15 / CL-15 자재 상세 (D4, REQ-112·113·120·121) — 수정은 Sheet (D5 없음, TR-04)
import { getLocale, getTranslations } from 'next-intl/server';
import type { ProjectAccess } from '@/shared/contracts/integration';
import { routes } from '@/shared/contracts/routes';
import { formatDateTime } from '@/shared/lib/dates';
import { formatWon } from '@/shared/lib/money';
import { ArchiveToggle, PublishToggle } from '@/shared/ui/record-actions';
import { Notice } from '@/shared/ui/notice';
import { ConfirmButton } from '@/features/designs/components/ConfirmButton';
import { ConfirmRecord, confirmedLine } from '@/features/designs/components/ConfirmRecord';
import {
  ArchivedBadge,
  ConfirmStateBadge,
  VisibilityBadge,
} from '@/features/designs/components/StateBadges';
import { ReconfirmRequestButton } from '@/features/designs/components/ReconfirmRequestButton';
import { setMaterialArchived, setMaterialPublic } from '@/features/materials/server/actions';
import { MaterialFormSheet } from '@/features/materials/components/MaterialFormSheet';
import type { MaterialDetail } from '@/features/materials/types';

export async function MaterialDetailView({
  material: m,
  viewer,
  categories,
}: {
  material: MaterialDetail;
  viewer: ProjectAccess;
  categories: string[];
}) {
  const t = await getTranslations('materials');
  const tc = await getTranslations('common');
  const locale = (await getLocale()) === 'en' ? 'en' : 'ko';
  const editor = viewer.as === 'editor';
  const confirmer = viewer.as === 'customer' && viewer.canConfirm;
  const versioned = { projectId: viewer.projectId, id: m.id, baseVersion: m.version };
  const quantity = m.quantity !== null ? `${m.quantity}${m.unit ? ` ${m.unit}` : ''}` : null;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold break-words">{m.name}</h2>
          {editor ? (
            <VisibilityBadge
              isPublic={m.isPublic}
              label={m.isPublic ? tc('visibility.public') : tc('visibility.private')}
            />
          ) : null}
          {/* 미확정 배지는 PM 화면만 */}
          {editor || m.confirmState !== 'none' ? (
            <ConfirmStateBadge state={m.confirmState} label={t(`confirmState.${m.confirmState}`)} />
          ) : null}
          {editor ? (
            <span className="text-meta text-muted-foreground" data-numeric>
              {t('field.revision', { no: m.revision })}
            </span>
          ) : null}
          {m.archivedAt ? <ArchivedBadge label={tc('filter.archived')} /> : null}
        </div>
        {editor ? (
          <div className="flex flex-wrap gap-2">
            {m.archivedAt ? null : (
              <>
                <MaterialFormSheet
                  mode="edit"
                  projectId={viewer.projectId}
                  companyId={viewer.companyId}
                  companySlug={viewer.companySlug}
                  categories={categories}
                  initial={{
                    id: m.id,
                    name: m.name,
                    category: m.category,
                    space: m.space,
                    spec: m.spec,
                    quantity: m.quantity,
                    unit: m.unit,
                    unitPrice: m.unitPrice,
                    imageFileId: m.imageFileId,
                    locationNote: m.locationNote,
                    description: m.description,
                  }}
                  baseVersion={m.version}
                  confirmState={m.confirmState}
                />
                <PublishToggle
                  action={setMaterialPublic}
                  payload={versioned}
                  isPublic={m.isPublic}
                  confirm={{ title: t('publish.title'), body: t('publish.body') }}
                  uiKey="material-publish-toggle"
                />
              </>
            )}
            {m.confirmState === 'confirmed' && !m.archivedAt ? (
              <ReconfirmRequestButton
                projectId={viewer.projectId}
                targetType="materials"
                targetId={m.id}
              />
            ) : null}
            <ArchiveToggle
              action={setMaterialArchived}
              payload={versioned}
              archived={!!m.archivedAt}
              uiKey="material-archive"
            />
          </div>
        ) : null}
        {editor && m.archivedAt ? <Notice tone="neutral">{tc('state.archivedItem')}</Notice> : null}
        {editor && !m.isPublic ? <Notice tone="neutral">{tc('state.privateItem')}</Notice> : null}
        {editor && m.confirmState === 'needs_reconfirm' ? (
          <Notice tone="attention">{t('state.pmNeedsReconfirm')}</Notice>
        ) : null}
      </header>

      <section
        aria-label={t('screen.detail')}
        className="grid min-w-0 gap-4 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]"
      >
        <div className="bg-muted aspect-square max-w-xs overflow-hidden rounded-md border sm:max-w-none">
          {m.imageFileId ? (
            // eslint-disable-next-line @next/next/no-img-element -- 권한 재검사 라우트(302)
            <img
              src={routes.file(m.imageFileId)}
              alt={m.name}
              className="h-full w-full object-contain"
            />
          ) : (
            <p className="text-muted-foreground flex h-full items-center justify-center text-sm">
              {t('image.empty')}
            </p>
          )}
        </div>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] content-start gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">{t('field.category')}</dt>
          <dd>{m.category || '—'}</dd>
          <dt className="text-muted-foreground">{t('field.space')}</dt>
          <dd>{t(`space.${m.space}`)}</dd>
          <dt className="text-muted-foreground">{t('field.spec')}</dt>
          <dd className="break-words whitespace-pre-wrap" data-ui-key="material-detail-spec">
            {m.spec || '—'}
          </dd>
          <dt className="text-muted-foreground">{t('field.quantity')}</dt>
          <dd data-numeric>{quantity ?? '—'}</dd>
          <dt className="text-muted-foreground">{t('field.unitPrice')}</dt>
          <dd data-numeric data-ui-key="material-detail-unit-price">
            {m.unitPrice !== null ? formatWon(m.unitPrice, locale) : '—'}
          </dd>
          <dt className="text-muted-foreground">{t('field.locationNote')}</dt>
          <dd>{m.locationNote || '—'}</dd>
          {m.description ? (
            <>
              <dt className="text-muted-foreground">{t('field.description')}</dt>
              <dd className="break-words whitespace-pre-wrap">{m.description}</dd>
            </>
          ) : null}
          <dt className="text-muted-foreground">{tc('field.updatedAt')}</dt>
          <dd data-numeric>{formatDateTime(m.updatedAt, locale)}</dd>
        </dl>
      </section>

      {confirmer ? (
        <ConfirmButton
          projectId={viewer.projectId}
          targetType="materials"
          targetId={m.id}
          revision={m.revision}
          state={m.confirmState}
          summary={[
            m.name,
            m.spec,
            quantity,
            m.unitPrice !== null ? formatWon(m.unitPrice, locale) : null,
          ]
            .filter(Boolean)
            .join(' · ')}
          confirmedLine={await confirmedLine(m.confirmations)}
        />
      ) : null}
      {/* 확정권 고객은 ConfirmButton 이 현재 확정 기록을 보여 준다 */}
      {confirmer ? null : <ConfirmRecord records={m.confirmations} showHistory={editor} />}
    </div>
  );
}

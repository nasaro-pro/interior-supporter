'use client';
// PM-65 사례 목록 — 대표(★, 정한 수까지)·순서(↑↓)·고객 동의 기록/철회·공개/비공개. PC 표 / 휴대폰 카드
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  ArrowDown,
  ArrowUp,
  CircleCheck,
  Eye,
  EyeOff,
  ImageIcon,
  Pencil,
  Star,
  TriangleAlert,
} from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { FormSheet } from '@/shared/ui/form-sheet';
import { FormRow } from '@/shared/ui/form-parts';
import { Input } from '@/shared/ui/input';
import { useActionErrorText } from '@/shared/ui/action-error';
import { cn } from '@/shared/lib/utils';
import type { ActionResult } from '@/shared/contracts/errors';
import {
  canToggleFeatured,
  featuredState,
  moveWork,
  type ManageWork,
} from '@/features/portfolio/lib/manage';
import { publicImageUrl } from '@/features/portfolio/routes';
import {
  recordConsent,
  setWorkStatus,
  updateWork,
  withdrawConsent,
} from '@/features/portfolio/server/actions';
import { reorderWorks } from '@/features/portfolio/server/manage-actions';
import { EditWorkSheet } from './EditWorkSheet';

function Badge({
  tone,
  icon,
  children,
}: {
  tone: 'brand' | 'neutral' | 'positive' | 'attention';
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const cls = {
    brand: 'bg-tone-brand-bg text-tone-brand-fg',
    neutral: 'bg-tone-neutral-bg text-tone-neutral-fg',
    positive: 'bg-tone-positive-bg text-tone-positive-fg',
    attention: 'bg-tone-attention-bg text-tone-attention-fg',
  }[tone];
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1 rounded-md px-2 text-xs font-medium whitespace-nowrap [&_svg]:size-3.5',
        cls,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

export function PortfolioWorksTable({
  companyId,
  works,
  featuredLimit,
  full = true,
}: {
  companyId: string;
  works: ManageWork[];
  featuredLimit: number;
  /** 전체 관리(대표·관리자 포함)면 true. '사례 올리기' 단계는 대표·순서·공개 버튼이 없다 */
  full?: boolean;
}) {
  const t = useTranslations('portfolio');
  const router = useRouter();
  const errText = useActionErrorText();
  const [pending, start] = useTransition();
  const [consentFor, setConsentFor] = useState<ManageWork | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const fs = featuredState(works, featuredLimit);

  const run = (p: Promise<ActionResult<unknown>>, okMsg?: string) =>
    start(async () => {
      const res = await p;
      if (res.ok) {
        if (okMsg) toast.success(okMsg);
        router.refresh();
      } else toast.error(errText(res.error));
    });

  const toggleStar = (w: ManageWork) =>
    run(updateWork({ companyId, workId: w.id, baseVersion: w.version, isFeatured: !w.isFeatured }));
  const move = (w: ManageWork, d: -1 | 1) => {
    const items = moveWork(works, w.id, d);
    if (items) run(reorderWorks({ companyId, items }));
  };
  const togglePublic = (w: ManageWork) =>
    run(
      setWorkStatus({
        companyId,
        workId: w.id,
        baseVersion: w.version,
        status: w.status === 'published' ? 'draft' : 'published',
      }),
    );

  if (!works.length) {
    return (
      <p
        role="status"
        className="text-muted-foreground rounded-md border border-dashed p-8 text-center text-sm"
      >
        {t('manage.emptyWorks')}
      </p>
    );
  }

  const meta = (w: ManageWork) =>
    [
      w.areaLabel,
      w.sizePyeong ? `${w.sizePyeong}${t('public.stat.pyeong')}` : null,
      w.durationWeeks ? t('public.weeks', { n: w.durationWeeks }) : null,
    ]
      .filter(Boolean)
      .join(' · ');

  const Star_ = ({ w }: { w: ManageWork }) => {
    if (!full) {
      return w.isFeatured ? (
        <Star
          aria-label={t('manage.featured')}
          role="img"
          className="text-tone-caution-fg mx-2 size-4 fill-current"
        />
      ) : (
        <span className="sr-only">—</span>
      );
    }
    const can = canToggleFeatured(w, works, featuredLimit);
    return (
      <Button
        variant="ghost"
        size="icon-sm"
        aria-pressed={w.isFeatured}
        aria-label={
          w.isFeatured
            ? t('manage.unfeature', { title: w.title })
            : t('manage.feature', { title: w.title })
        }
        title={
          !can
            ? w.coverThumbPath
              ? t('manage.featuredFull')
              : t('manage.coverMissing')
            : undefined
        }
        disabled={!can || pending}
        onClick={() => toggleStar(w)}
        data-ui-key="portfolio-work-star"
      >
        <Star aria-hidden className={cn(w.isFeatured && 'text-tone-caution-fg fill-current')} />
      </Button>
    );
  };

  const Thumb = ({ w, className }: { w: ManageWork; className?: string }) =>
    w.coverThumbPath ? (
      // eslint-disable-next-line @next/next/no-img-element -- 공개 버킷 썸네일
      <img
        src={publicImageUrl(w.coverThumbPath)}
        alt=""
        className={cn('bg-muted rounded object-cover', className)}
      />
    ) : (
      <span
        className={cn('bg-muted text-muted-foreground grid place-items-center rounded', className)}
      >
        <ImageIcon aria-hidden className="size-4" />
      </span>
    );

  const Status = ({ w }: { w: ManageWork }) => (
    <div className="flex flex-wrap gap-1.5">
      {w.hasConsent ? (
        <Badge tone="positive" icon={<CircleCheck aria-hidden />}>
          {t('manage.consent.done')}
        </Badge>
      ) : (
        <Badge tone="attention" icon={<TriangleAlert aria-hidden />}>
          {t('manage.consent.needed')}
        </Badge>
      )}
      {w.status === 'published' ? (
        <Badge tone="brand" icon={<Eye aria-hidden />}>
          {t('manage.status.published')}
        </Badge>
      ) : (
        <Badge tone="neutral" icon={<EyeOff aria-hidden />}>
          {t('manage.status.draft')}
        </Badge>
      )}
    </div>
  );

  const Actions = ({ w, i }: { w: ManageWork; i: number }) => (
    <div className="flex flex-wrap items-center justify-end gap-1">
      {full ? (
        <>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t('manage.moveUp', { title: w.title })}
            disabled={i === 0 || pending}
            onClick={() => move(w, -1)}
            data-ui-key="portfolio-work-up"
          >
            <ArrowUp aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t('manage.moveDown', { title: w.title })}
            disabled={i === works.length - 1 || pending}
            onClick={() => move(w, 1)}
            data-ui-key="portfolio-work-down"
          >
            <ArrowDown aria-hidden />
          </Button>
        </>
      ) : null}
      {w.editable ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setEditId(w.id)}
          aria-label={t('manage.edit.openFor', { title: w.title })}
          data-ui-key="portfolio-work-edit"
        >
          <Pencil aria-hidden />
          {t('manage.edit.open')}
        </Button>
      ) : null}
      {!w.editable ? (
        // '사례 올리기' 단계: 남의 프로젝트이거나 이미 공개된 사례는 보기만
        <span className="text-muted-foreground text-meta" data-ui-key="portfolio-work-readonly">
          {t('permission.readOnly')}
        </span>
      ) : !w.hasConsent ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setConsentFor(w)}
          data-ui-key="portfolio-consent-open"
        >
          {t('manage.consent.record')}
        </Button>
      ) : (
        <>
          {full ? (
            <Button
              variant="outline"
              size="sm"
              disabled={pending || (w.status === 'draft' && !w.coverThumbPath)}
              title={
                w.status === 'draft' && !w.coverThumbPath ? t('manage.coverMissing') : undefined
              }
              onClick={() => togglePublic(w)}
              data-ui-key="portfolio-work-publish"
            >
              {w.status === 'published' ? t('manage.unpublish') : t('manage.publish')}
            </Button>
          ) : (
            <span className="text-muted-foreground text-meta" data-ui-key="portfolio-work-awaiting">
              {t('permission.awaitingPublish')}
            </span>
          )}
          <ConfirmDialog
            title={t('manage.consent.withdraw')}
            body={t('manage.consent.withdrawConfirm')}
            confirmLabel={t('manage.consent.withdraw')}
            uiKey="portfolio-consent-withdraw"
            trigger={t('manage.consent.withdraw')}
            triggerVariant="ghost"
            triggerSize="sm"
            action={() => withdrawConsent({ companyId, workId: w.id, baseVersion: w.version })}
          />
        </>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      {!full ? (
        <p
          className="bg-muted text-meta rounded-md px-3 py-2"
          data-ui-key="portfolio-works-level-note"
        >
          {t('permission.worksNote')}
        </p>
      ) : null}
      <p
        className={cn('text-meta', fs.over ? 'text-tone-attention-fg' : 'text-muted-foreground')}
        role="status"
        data-numeric
      >
        {t('manage.featuredCount', { count: fs.count, limit: featuredLimit })}
        {fs.over
          ? ` · ${t('manage.featuredLimitOver', { count: fs.count, limit: featuredLimit })}`
          : null}
      </p>

      {/* PC 표 */}
      <table className="hidden w-full text-sm md:table">
        <thead>
          <tr className="text-muted-foreground border-b text-left text-[13px]">
            <th className="w-12 py-2 font-medium">{t('manage.featured')}</th>
            <th className="py-2 font-medium">{t('manage.column.work')}</th>
            <th className="py-2 font-medium">{t('manage.column.photos')}</th>
            <th className="py-2 font-medium">{t('manage.column.status')}</th>
            <th className="py-2 text-right font-medium">{t('manage.column.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {works.map((w, i) => (
            <tr key={w.id} data-key={w.id} className="border-b last:border-b-0">
              <td className="py-3">
                <Star_ w={w} />
              </td>
              <td className="py-3">
                <div className="flex items-center gap-3">
                  <Thumb w={w} className="h-12 w-16 shrink-0" />
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{w.title}</p>
                    <p className="text-muted-foreground text-meta" data-numeric>
                      {meta(w)}
                    </p>
                  </div>
                </div>
              </td>
              <td className="py-3" data-numeric>
                {t('manage.photoCount', { n: w.photoCount })}
              </td>
              <td className="py-3">
                <Status w={w} />
              </td>
              <td className="py-3">
                <Actions w={w} i={i} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 휴대폰 카드 */}
      <ul className="flex flex-col gap-3 md:hidden">
        {works.map((w, i) => (
          <li key={w.id} data-key={w.id} className="overflow-hidden rounded-lg border">
            <Thumb w={w} className="aspect-video w-full rounded-none" />
            <div className="flex flex-col gap-2 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">{w.title}</p>
                  <p className="text-muted-foreground text-meta" data-numeric>
                    {meta(w)} · {t('manage.photoCount', { n: w.photoCount })}
                  </p>
                </div>
                <Star_ w={w} />
              </div>
              <Status w={w} />
              <Actions w={w} i={i} />
            </div>
          </li>
        ))}
      </ul>

      <ConsentSheet companyId={companyId} work={consentFor} onClose={() => setConsentFor(null)} />
      <EditWorkSheet companyId={companyId} workId={editId} onClose={() => setEditId(null)} />
    </div>
  );
}

/** 고객 동의 기록 — 체크 + 받은 방법. 누가·언제는 서버가 남긴다 */
function ConsentSheet({
  companyId,
  work,
  onClose,
}: {
  companyId: string;
  work: ManageWork | null;
  onClose: () => void;
}) {
  const t = useTranslations('portfolio');
  const router = useRouter();
  const errText = useActionErrorText();
  const [checked, setChecked] = useState(false);
  const [note, setNote] = useState('');
  const [pending, start] = useTransition();
  const submit = () =>
    work &&
    start(async () => {
      const res = await recordConsent({
        companyId,
        workId: work.id,
        baseVersion: work.version,
        note,
        confirmed: checked,
      });
      if (res.ok) {
        toast.success(t('manage.consent.recorded'));
        setChecked(false);
        setNote('');
        onClose();
        router.refresh();
      } else toast.error(errText(res.error));
    });
  return (
    <FormSheet
      title={t('manage.consent.title')}
      description={work?.title}
      open={!!work}
      onOpenChange={(o) => (!o ? onClose() : undefined)}
      busy={pending}
      uiKey="portfolio-consent-sheet"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            {t('manage.cancel')}
          </Button>
          <Button
            onClick={submit}
            disabled={!checked || !note.trim() || pending}
            aria-busy={pending}
            data-ui-key="portfolio-consent-submit"
          >
            {t('manage.consent.record')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <label className="flex items-start gap-3 rounded-md border p-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 size-4"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            data-ui-key="portfolio-consent-check"
          />
          <span>
            {t('manage.consent.check')}
            <span className="text-muted-foreground text-meta mt-1 block">
              {t('manage.consent.private')}
            </span>
          </span>
        </label>
        <FormRow label={t('manage.consent.note')} htmlFor="pf-consent-note" required>
          <Input
            id="pf-consent-note"
            value={note}
            maxLength={200}
            placeholder={t('manage.consent.notePlaceholder')}
            onChange={(e) => setNote(e.target.value)}
          />
        </FormRow>
      </div>
    </FormSheet>
  );
}

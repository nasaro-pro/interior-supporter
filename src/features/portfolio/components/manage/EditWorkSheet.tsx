'use client';
// PM-65 사례 수정 Sheet — [기본 정보] 이름·지역·평수·기간·완공일·공간·설명 / [사진] 추가·삭제·공간·공간 이름·역할·설명·대표 사진
// 쓰기는 각 액션이 권한 단계를 다시 확인하고 RLS 가 막는다 ('사례 올리기'는 자기 담당 프로젝트의 초안만)
// 사진 칸은 고치는 즉시 저장 (칸마다 version 으로 낙관적 잠금). 저장할 때마다 최신을 다시 불러온다
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Check, ImagePlus, Star, Trash2 } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { FormSheet } from '@/shared/ui/form-sheet';
import { FormRow } from '@/shared/ui/form-parts';
import { Input } from '@/shared/ui/input';
import { Textarea } from '@/shared/ui/textarea';
import { NativeSelect } from '@/shared/ui/native-fields';
import { useActionErrorText } from '@/shared/ui/action-error';
import { routes } from '@/shared/contracts/routes';
import { cn } from '@/shared/lib/utils';
import { SPACE_DISPLAY_ORDER } from '@/features/portfolio/lib/grid';
import { numOrNull, workPatch, type WorkFields } from '@/features/portfolio/lib/manage';
import { publicImageUrl } from '@/features/portfolio/routes';
import type { PortfolioSpace } from '@/features/portfolio/schema';
import {
  addPortfolioImages,
  archivePortfolioImage,
  updatePortfolioImage,
  updateWork,
} from '@/features/portfolio/server/actions';
import {
  listProjectImages,
  loadWorkForEdit,
  type EditImage,
  type EditWork,
  type ProjectImageOption,
} from '@/features/portfolio/server/manage-actions';

type Tab = 'info' | 'photos';

export function EditWorkSheet({
  companyId,
  workId,
  onClose,
}: {
  companyId: string;
  /** 열 사례 (null 이면 닫힘) */
  workId: string | null;
  onClose: () => void;
}) {
  const t = useTranslations();
  const tp = useTranslations('portfolio.manage');
  const te = useTranslations('portfolio.manage.edit');
  const router = useRouter();
  const errText = useActionErrorText();
  const [tab, setTab] = useState<Tab>('info');
  const [work, setWork] = useState<EditWork | null>(null);
  const [form, setForm] = useState<{
    title: string;
    area: string;
    py: string;
    weeks: string;
    done: string;
    spaces: string[];
    summary: string;
  } | null>(null);
  const [options, setOptions] = useState<ProjectImageOption[] | null>(null);
  const [picks, setPicks] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const reload = (id: string) =>
    loadWorkForEdit({ companyId, workId: id }).then((res) => {
      if (!res.ok) {
        toast.error(errText(res.error));
        return null;
      }
      setWork(res.data);
      return res.data;
    });

  // 다른 사례를 열면 화면 상태를 처음으로 (렌더 중 조정 — 효과 안에서 바로 setState 하지 않음)
  const [openedFor, setOpenedFor] = useState(workId);
  if (openedFor !== workId) {
    setOpenedFor(workId);
    if (workId) {
      setTab('info');
      setWork(null);
      setOptions(null);
      setPicks([]);
    }
  }

  useEffect(() => {
    if (!workId) return;
    void reload(workId).then((w) => {
      if (w)
        setForm({
          title: w.title,
          area: w.areaLabel,
          py: w.sizePyeong === null ? '' : String(w.sizePyeong),
          weeks: w.durationWeeks === null ? '' : String(w.durationWeeks),
          done: w.completedOn ?? '',
          spaces: w.spaces,
          summary: w.summary,
        });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 열 때마다 한 번
  }, [workId]);

  const fieldsOf = (w: EditWork): WorkFields => ({
    title: w.title,
    areaLabel: w.areaLabel,
    sizePyeong: w.sizePyeong,
    durationWeeks: w.durationWeeks,
    completedOn: w.completedOn,
    spaces: w.spaces,
    summary: w.summary,
  });

  const saveInfo = () =>
    work &&
    form &&
    start(async () => {
      const patch = workPatch(fieldsOf(work), {
        title: form.title.trim(),
        areaLabel: form.area.trim(),
        sizePyeong: numOrNull(form.py),
        durationWeeks: numOrNull(form.weeks),
        completedOn: form.done || null,
        spaces: form.spaces,
        summary: form.summary.trim(),
      });
      if (!Object.keys(patch).length) {
        toast.info(te('noChange'));
        return;
      }
      const res = await updateWork({
        companyId,
        workId: work.id,
        baseVersion: work.version,
        ...patch,
      });
      if (!res.ok) return void toast.error(errText(res.error));
      toast.success(te('saved'));
      await reload(work.id);
      router.refresh();
    });

  /** 사진 칸 하나 저장 → 최신 다시 불러오기 */
  const saveImage = (
    img: EditImage,
    patch: Partial<Pick<EditImage, 'space' | 'spaceLabel' | 'caption' | 'role'>>,
  ) =>
    work &&
    start(async () => {
      const res = await updatePortfolioImage({
        companyId,
        imageId: img.id,
        baseVersion: img.version,
        ...patch,
      });
      if (!res.ok) toast.error(errText(res.error));
      await reload(work.id);
      router.refresh();
    });

  const setCover = (img: EditImage) =>
    work &&
    start(async () => {
      const res = await updateWork({
        companyId,
        workId: work.id,
        baseVersion: work.version,
        coverImageId: img.id,
      });
      if (!res.ok) toast.error(errText(res.error));
      else toast.success(te('coverSet'));
      await reload(work.id);
      router.refresh();
    });

  const remove = (img: EditImage) =>
    work &&
    start(async () => {
      setConfirmDelete(null);
      const res = await archivePortfolioImage({
        companyId,
        imageId: img.id,
        baseVersion: img.version,
      });
      if (!res.ok) toast.error(errText(res.error));
      else toast.success(te('removed'));
      await reload(work.id);
      router.refresh();
    });

  const openPicker = () => {
    const projectId = work?.projectId;
    if (!work || !projectId) return;
    start(async () => {
      const res = await listProjectImages({ companyId, projectId });
      if (!res.ok) return void toast.error(errText(res.error));
      const used = new Set(work.images.map((i) => i.sourceFileId));
      setOptions(res.data.filter((o) => !used.has(o.fileId)));
      setPicks([]);
    });
  };

  const addPicked = () =>
    work &&
    picks.length &&
    start(async () => {
      const res = await addPortfolioImages({
        companyId,
        workId: work.id,
        items: picks.map((sourceFileId) => ({
          sourceFileId,
          space: null,
          spaceLabel: '',
          role: 'gallery',
          caption: '',
        })),
      });
      if (!res.ok) return void toast.error(errText(res.error));
      const failed = res.data.results.filter((r) => !r.ok).length;
      if (failed) toast.warning(tp('copyFailedCount', { n: failed }));
      else toast.success(te('added', { n: picks.length }));
      setOptions(null);
      setPicks([]);
      const w = await reload(work.id);
      // 대표 사진이 없으면 방금 추가한 첫 장을 대표로
      const first = res.data.results.find((r) => r.ok);
      if (w && !w.coverImageId && first && first.ok) {
        await updateWork({
          companyId,
          workId: w.id,
          baseVersion: w.version,
          coverImageId: first.imageId,
        });
        await reload(w.id);
      }
      router.refresh();
    });

  const tabBtn = (k: Tab, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === k}
      onClick={() => setTab(k)}
      className={cn(
        'focus-visible:ring-ring/50 -mb-px border-b-2 px-3 py-2 text-sm outline-none focus-visible:ring-3',
        tab === k ? 'border-foreground font-semibold' : 'text-muted-foreground border-transparent',
      )}
      data-ui-key={`portfolio-edit-tab-${k}`}
    >
      {label}
    </button>
  );

  return (
    <FormSheet
      title={te('title')}
      description={work?.title}
      open={!!workId}
      onOpenChange={(o) => (!o ? onClose() : undefined)}
      busy={pending}
      uiKey="portfolio-work-edit"
      className="data-[side=right]:sm:max-w-xl"
      footer={
        tab === 'info' ? (
          <>
            <Button variant="outline" onClick={onClose} disabled={pending}>
              {tp('cancel')}
            </Button>
            <Button
              onClick={saveInfo}
              disabled={!form?.title.trim() || pending}
              aria-busy={pending}
              data-ui-key="portfolio-edit-save"
            >
              {te('save')}
            </Button>
          </>
        ) : (
          <Button variant="outline" onClick={onClose} disabled={pending}>
            {te('done')}
          </Button>
        )
      }
    >
      {!work || !form ? (
        <p role="status" className="text-muted-foreground text-sm">
          {t('common.state.loading')}
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          <div role="tablist" aria-label={te('title')} className="flex gap-1 border-b">
            {tabBtn('info', te('tabInfo'))}
            {tabBtn('photos', te('tabPhotos', { n: work.images.length }))}
          </div>

          {tab === 'info' ? (
            <section role="tabpanel" className="flex flex-col gap-4">
              <FormRow label={tp('title')} htmlFor="pf-edit-title" required>
                <Input
                  id="pf-edit-title"
                  value={form.title}
                  maxLength={80}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </FormRow>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormRow label={tp('area')} htmlFor="pf-edit-area" hint={tp('areaHint')}>
                  <Input
                    id="pf-edit-area"
                    value={form.area}
                    maxLength={30}
                    placeholder={tp('areaPlaceholder')}
                    onChange={(e) => setForm({ ...form, area: e.target.value })}
                  />
                </FormRow>
                <FormRow label={tp('sizePyeong')} htmlFor="pf-edit-py">
                  <Input
                    id="pf-edit-py"
                    inputMode="decimal"
                    value={form.py}
                    onChange={(e) => setForm({ ...form, py: e.target.value })}
                  />
                </FormRow>
                <FormRow label={tp('durationWeeks')} htmlFor="pf-edit-weeks">
                  <Input
                    id="pf-edit-weeks"
                    inputMode="numeric"
                    value={form.weeks}
                    onChange={(e) => setForm({ ...form, weeks: e.target.value })}
                  />
                </FormRow>
                <FormRow label={tp('completedOn')} htmlFor="pf-edit-done">
                  <Input
                    id="pf-edit-done"
                    type="date"
                    value={form.done}
                    onChange={(e) => setForm({ ...form, done: e.target.value })}
                  />
                </FormRow>
              </div>
              <fieldset>
                <legend className="mb-1.5 text-sm font-medium">{tp('spaces')}</legend>
                <div className="flex flex-wrap gap-1.5">
                  {SPACE_DISPLAY_ORDER.map((s) => {
                    const on = form.spaces.includes(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          setForm({
                            ...form,
                            spaces: on ? form.spaces.filter((x) => x !== s) : [...form.spaces, s],
                          })
                        }
                        className={cn(
                          'focus-visible:ring-ring/50 h-8 rounded-full border px-3 text-sm outline-none focus-visible:ring-3',
                          on ? 'border-primary bg-accent font-medium' : 'bg-card',
                        )}
                      >
                        {t(`materials.space.${s}`)}
                      </button>
                    );
                  })}
                </div>
                <p className="text-muted-foreground text-meta mt-1.5">{te('spacesHint')}</p>
              </fieldset>
              <FormRow
                label={tp('summary')}
                htmlFor="pf-edit-summary"
                hint={`${form.summary.length}/1000`}
              >
                <Textarea
                  id="pf-edit-summary"
                  rows={4}
                  maxLength={1000}
                  value={form.summary}
                  onChange={(e) => setForm({ ...form, summary: e.target.value })}
                />
              </FormRow>
            </section>
          ) : (
            <section role="tabpanel" className="flex flex-col gap-4">
              <p className="text-muted-foreground text-meta">{te('photosHint')}</p>
              {!work.coverImageId && work.images.length ? (
                <p
                  role="status"
                  className="bg-tone-attention-bg text-tone-attention-fg rounded-md px-3 py-2 text-sm"
                >
                  {te('coverMissing')}
                </p>
              ) : null}
              {work.images.length === 0 ? (
                <p className="text-muted-foreground rounded-md border border-dashed p-6 text-center text-sm">
                  {te('noPhotos')}
                </p>
              ) : (
                <ul className="flex flex-col gap-3" aria-label={te('photoList')}>
                  {work.images.map((img, i) => {
                    const cover = work.coverImageId === img.id;
                    const label = te('photoN', { n: i + 1 });
                    return (
                      <li
                        key={img.id}
                        data-key={img.id}
                        className={cn(
                          'grid grid-cols-[96px_1fr] gap-3 rounded-md border p-2.5',
                          cover && 'border-foreground',
                        )}
                      >
                        <div className="flex flex-col gap-1.5">
                          {/* eslint-disable-next-line @next/next/no-img-element -- 공개 버킷 썸네일 */}
                          <img
                            src={publicImageUrl(img.thumbPath)}
                            alt=""
                            className="bg-muted aspect-[4/3] w-full rounded object-cover"
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant={cover ? 'default' : 'outline'}
                            disabled={cover || pending || img.role === 'before'}
                            aria-pressed={cover}
                            aria-label={te('setCoverFor', { name: label })}
                            title={img.role === 'before' ? te('beforeNotCover') : undefined}
                            onClick={() => setCover(img)}
                            data-ui-key="portfolio-edit-cover"
                          >
                            <Star aria-hidden className={cn(cover && 'fill-current')} />
                            {cover ? te('isCover') : te('setCover')}
                          </Button>
                        </div>
                        <div className="grid min-w-0 gap-2 sm:grid-cols-2">
                          <NativeSelect
                            aria-label={tp('spaceOf', { name: label })}
                            value={img.space ?? ''}
                            disabled={pending}
                            onChange={(e) =>
                              saveImage(img, {
                                space: (e.target.value || null) as PortfolioSpace | null,
                              })
                            }
                          >
                            <option value="">{tp('noSpace')}</option>
                            {SPACE_DISPLAY_ORDER.map((s) => (
                              <option key={s} value={s}>
                                {t(`materials.space.${s}`)}
                              </option>
                            ))}
                          </NativeSelect>
                          <Input
                            aria-label={te('spaceLabelFor', { name: label })}
                            placeholder={tp('spaceLabelPlaceholder')}
                            maxLength={20}
                            defaultValue={img.spaceLabel}
                            disabled={pending}
                            onBlur={(e) =>
                              e.target.value.trim() !== img.spaceLabel &&
                              saveImage(img, { spaceLabel: e.target.value })
                            }
                          />
                          <NativeSelect
                            aria-label={tp('roleOf', { name: label })}
                            value={img.role}
                            disabled={pending}
                            onChange={(e) =>
                              saveImage(img, { role: e.target.value as EditImage['role'] })
                            }
                          >
                            <option value="gallery">{tp('role.gallery')}</option>
                            <option value="after">{tp('role.after')}</option>
                            <option value="before">{tp('role.before')}</option>
                          </NativeSelect>
                          <Input
                            aria-label={te('captionFor', { name: label })}
                            placeholder={te('captionPlaceholder')}
                            maxLength={120}
                            defaultValue={img.caption}
                            disabled={pending}
                            onBlur={(e) =>
                              e.target.value.trim() !== img.caption &&
                              saveImage(img, { caption: e.target.value })
                            }
                          />
                          <div className="flex justify-end sm:col-span-2">
                            {confirmDelete === img.id ? (
                              <span className="flex items-center gap-1.5 text-sm">
                                {te('removeConfirm')}
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  disabled={pending}
                                  onClick={() => remove(img)}
                                  data-ui-key="portfolio-edit-remove-confirm"
                                >
                                  {te('remove')}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setConfirmDelete(null)}
                                >
                                  {tp('cancel')}
                                </Button>
                              </span>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={pending}
                                aria-label={te('removeFor', { name: label })}
                                onClick={() => setConfirmDelete(img.id)}
                                data-ui-key="portfolio-edit-remove"
                              >
                                <Trash2 aria-hidden />
                                {te('remove')}
                              </Button>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              {/* 사진 추가 — 원본 프로젝트 사진에서 */}
              {!work.projectId ? (
                <p className="text-muted-foreground text-meta">{te('noProject')}</p>
              ) : options === null ? (
                <Button
                  variant="outline"
                  onClick={openPicker}
                  disabled={pending}
                  data-ui-key="portfolio-edit-add-open"
                >
                  <ImagePlus aria-hidden />
                  {te('addFromProject')}
                </Button>
              ) : (
                <div className="flex flex-col gap-2 rounded-md border p-3">
                  <p className="text-sm font-medium">
                    {te('pickTitle')}{' '}
                    <span className="text-muted-foreground font-normal" data-numeric>
                      {tp('picked', { n: picks.length })}
                    </span>
                  </p>
                  {options.length === 0 ? (
                    <p className="text-muted-foreground text-meta">{te('allUsed')}</p>
                  ) : (
                    <ul className="grid grid-cols-4 gap-2">
                      {options.map((o) => {
                        const on = picks.includes(o.fileId);
                        return (
                          <li key={o.fileId}>
                            <button
                              type="button"
                              aria-pressed={on}
                              aria-label={o.name}
                              onClick={() =>
                                setPicks((p) =>
                                  on
                                    ? p.filter((x) => x !== o.fileId)
                                    : p.length >= 20
                                      ? p
                                      : [...p, o.fileId],
                                )
                              }
                              className={cn(
                                'focus-visible:ring-ring/50 relative block w-full overflow-hidden rounded outline-none focus-visible:ring-3',
                                on && 'ring-primary ring-2 ring-offset-1',
                              )}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element -- 권한 재검사 파일 라우트 */}
                              <img
                                src={routes.file(o.previewFileId)}
                                alt=""
                                loading="lazy"
                                className="bg-muted aspect-square w-full object-cover"
                              />
                              <span
                                className={cn(
                                  'absolute top-1 left-1 grid size-5 place-items-center rounded border-2 border-white',
                                  on ? 'bg-primary' : 'bg-black/25',
                                )}
                              >
                                {on ? <Check aria-hidden className="size-3 text-white" /> : null}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setOptions(null);
                        setPicks([]);
                      }}
                    >
                      {tp('cancel')}
                    </Button>
                    <Button
                      size="sm"
                      onClick={addPicked}
                      disabled={!picks.length || pending}
                      aria-busy={pending}
                      data-ui-key="portfolio-edit-add"
                    >
                      {te('addN', { n: picks.length })}
                    </Button>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </FormSheet>
  );
}

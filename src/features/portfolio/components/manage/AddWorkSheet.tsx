'use client';
// PM-65 사례 추가 Sheet — ① 프로젝트·기본 정보 ② 공개할 사진 고르기(비포·애프터·공간 이름) ③ 고객 동의(선택)
// 저장 순서: 사례 만들기 → 공개용 사본 만들기(한 장씩) → 대표 사진 지정 → (체크했으면) 동의 기록. 공개는 목록에서 따로.
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Check, Plus, ShieldCheck } from 'lucide-react';
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
import { chooseCover, setRole, type PickedImage } from '@/features/portfolio/lib/manage';
import { weeksBetween, type PortfolioSpace } from '@/features/portfolio/schema';
import {
  addPortfolioImages,
  createWork,
  recordConsent,
  updateWork,
} from '@/features/portfolio/server/actions';
import {
  listProjectImages,
  type ProjectImageOption,
} from '@/features/portfolio/server/manage-actions';
import type { ManageProject } from '@/features/portfolio/server/manage-queries';

type Step = 'idle' | 'creating' | 'copying' | 'finishing';

export function AddWorkSheet({
  companyId,
  projects,
  projectRequired = false,
}: {
  companyId: string;
  /** 고를 수 있는 프로젝트 ('사례 올리기' 단계는 자기 담당 프로젝트만 넘어온다) */
  projects: ManageProject[];
  /** '사례 올리기' 단계는 프로젝트를 꼭 골라야 한다 (원본 없는 사례는 전체 관리만) */
  projectRequired?: boolean;
}) {
  const t = useTranslations();
  const tp = useTranslations('portfolio.manage');
  const router = useRouter();
  const errText = useActionErrorText();
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [title, setTitle] = useState('');
  const [area, setArea] = useState('');
  const [pyeong, setPyeong] = useState('');
  const [weeks, setWeeks] = useState('');
  const [completedOn, setCompletedOn] = useState('');
  const [summary, setSummary] = useState('');
  const [spaces, setSpaces] = useState<PortfolioSpace[]>([]);
  const [options, setOptions] = useState<ProjectImageOption[]>([]);
  const [picks, setPicks] = useState<PickedImage[]>([]);
  const [consent, setConsent] = useState(false);
  const [note, setNote] = useState('');
  const [step, setStep] = useState<Step>('idle');
  const [loadingImages, startLoad] = useTransition();
  const busy = step !== 'idle';

  const reset = () => {
    setProjectId('');
    setTitle('');
    setArea('');
    setPyeong('');
    setWeeks('');
    setCompletedOn('');
    setSummary('');
    setSpaces([]);
    setOptions([]);
    setPicks([]);
    setConsent(false);
    setNote('');
    setStep('idle');
  };

  const chooseProject = (id: string) => {
    setProjectId(id);
    setPicks([]);
    const p = projects.find((x) => x.id === id);
    if (p) {
      setTitle(p.name);
      setCompletedOn(p.endDate ?? '');
      const w = weeksBetween(p.startDate, p.endDate);
      setWeeks(w ? String(w) : '');
    }
    if (!id) return setOptions([]);
    startLoad(async () => {
      const res = await listProjectImages({ companyId, projectId: id });
      if (res.ok) setOptions(res.data);
      else toast.error(errText(res.error));
    });
  };

  const togglePick = (fileId: string) =>
    setPicks((prev) =>
      prev.some((p) => p.sourceFileId === fileId)
        ? prev.filter((p) => p.sourceFileId !== fileId)
        : prev.length >= 20
          ? prev
          : [...prev, { sourceFileId: fileId, space: null, spaceLabel: '', role: 'gallery' }],
    );
  const patch = (fileId: string, x: Partial<PickedImage>) =>
    setPicks((prev) => prev.map((p) => (p.sourceFileId === fileId ? { ...p, ...x } : p)));

  const submit = async () => {
    const id = crypto.randomUUID();
    setStep('creating');
    const created = await createWork({
      id,
      companyId,
      projectId: projectId || null,
      title,
      areaLabel: area,
      sizePyeong: pyeong ? Number(pyeong) : null,
      durationWeeks: weeks ? Number(weeks) : null,
      completedOn: completedOn || null,
      spaces,
      summary,
    });
    if (!created.ok) {
      setStep('idle');
      return toast.error(errText(created.error));
    }
    let version = 1;
    if (picks.length) {
      setStep('copying');
      const res = await addPortfolioImages({ companyId, workId: id, items: picks });
      if (res.ok) {
        const okOnes = res.data.results.flatMap((r) =>
          r.ok
            ? [
                {
                  imageId: r.imageId,
                  role: picks.find((p) => p.sourceFileId === r.sourceFileId)?.role ?? 'gallery',
                },
              ]
            : [],
        );
        const failed = res.data.results.length - okOnes.length;
        if (failed) toast.warning(tp('copyFailedCount', { n: failed }));
        const cover = chooseCover(okOnes);
        if (cover) {
          const u = await updateWork({
            companyId,
            workId: id,
            baseVersion: version,
            coverImageId: cover,
          });
          if (u.ok) version = u.data.version;
        }
      } else toast.error(errText(res.error));
    }
    if (consent && note.trim()) {
      setStep('finishing');
      const c = await recordConsent({
        companyId,
        workId: id,
        baseVersion: version,
        note,
        confirmed: true,
      });
      if (!c.ok) toast.error(errText(c.error));
    }
    toast.success(tp('created'));
    reset();
    setOpen(false);
    router.refresh();
  };

  const kindLabel = (k: ProjectImageOption['kind']) => tp(`kind.${k}`);

  return (
    <FormSheet
      title={tp('addWork')}
      description={tp('addWorkHint')}
      triggerLabel={tp('addWork')}
      triggerIcon={<Plus aria-hidden />}
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
      busy={busy}
      uiKey="portfolio-work-add"
      className="data-[side=right]:sm:max-w-xl"
      footer={
        <>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            {tp('cancel')}
          </Button>
          <Button
            onClick={submit}
            disabled={!title.trim() || (projectRequired && !projectId) || busy}
            aria-busy={busy}
            data-ui-key="portfolio-work-add-submit"
          >
            {busy ? tp(`progress.${step}`) : tp('create')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-4" aria-labelledby="pf-add-s1">
          <h3 id="pf-add-s1" className="text-sm font-semibold">
            ① {tp('step.basic')}
          </h3>
          <FormRow label={tp('fromProject')} htmlFor="pf-add-project" required={projectRequired}>
            <NativeSelect
              id="pf-add-project"
              value={projectId}
              onChange={(e) => chooseProject(e.target.value)}
              data-ui-key="portfolio-work-add-project"
            >
              <option value="">{tp('selectProject')}</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.endDate ? ` · ${p.endDate.replaceAll('-', '. ')}.` : ''}
                </option>
              ))}
            </NativeSelect>
          </FormRow>
          <FormRow label={tp('title')} htmlFor="pf-add-title" required>
            <Input
              id="pf-add-title"
              value={title}
              maxLength={80}
              onChange={(e) => setTitle(e.target.value)}
            />
          </FormRow>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormRow label={tp('area')} htmlFor="pf-add-area" hint={tp('areaHint')}>
              <Input
                id="pf-add-area"
                value={area}
                maxLength={30}
                placeholder={tp('areaPlaceholder')}
                onChange={(e) => setArea(e.target.value)}
              />
            </FormRow>
            <FormRow label={tp('sizePyeong')} htmlFor="pf-add-py">
              <Input
                id="pf-add-py"
                inputMode="decimal"
                value={pyeong}
                onChange={(e) => setPyeong(e.target.value)}
              />
            </FormRow>
            <FormRow label={tp('durationWeeks')} htmlFor="pf-add-weeks" hint={tp('durationHint')}>
              <Input
                id="pf-add-weeks"
                inputMode="numeric"
                value={weeks}
                onChange={(e) => setWeeks(e.target.value)}
              />
            </FormRow>
            <FormRow label={tp('completedOn')} htmlFor="pf-add-done">
              <Input
                id="pf-add-done"
                type="date"
                value={completedOn}
                onChange={(e) => setCompletedOn(e.target.value)}
              />
            </FormRow>
          </div>
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">{tp('spaces')}</legend>
            <div className="flex flex-wrap gap-1.5">
              {SPACE_DISPLAY_ORDER.map((s) => {
                const on = spaces.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setSpaces((prev) => (on ? prev.filter((x) => x !== s) : [...prev, s]))
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
          </fieldset>
          <FormRow label={tp('summary')} htmlFor="pf-add-summary">
            <Textarea
              id="pf-add-summary"
              rows={3}
              maxLength={1000}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
          </FormRow>
        </section>

        <section className="flex flex-col gap-3 border-t pt-5" aria-labelledby="pf-add-s2">
          <h3 id="pf-add-s2" className="text-sm font-semibold">
            ② {tp('pickPhotos')}{' '}
            <span className="text-muted-foreground font-normal" data-numeric>
              {tp('picked', { n: picks.length })}
            </span>
          </h3>
          <p className="bg-tone-info-bg text-tone-info-fg flex gap-2 rounded-md p-3 text-[13px]">
            <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
            {tp('pickHint')}
          </p>
          {!projectId ? (
            <p className="text-muted-foreground text-meta">{tp('pickProjectFirst')}</p>
          ) : loadingImages ? (
            <p className="text-muted-foreground text-meta" role="status">
              {t('common.state.loading')}
            </p>
          ) : !options.length ? (
            <p className="text-muted-foreground text-meta">{tp('photosEmpty')}</p>
          ) : (
            <ul className="grid grid-cols-3 gap-2">
              {options.map((o) => {
                const on = picks.some((p) => p.sourceFileId === o.fileId);
                return (
                  <li key={o.fileId}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => togglePick(o.fileId)}
                      aria-label={`${kindLabel(o.kind)} · ${o.name}`}
                      className={cn(
                        'focus-visible:ring-ring/50 relative block w-full overflow-hidden rounded outline-none focus-visible:ring-3',
                        on && 'ring-primary ring-2 ring-offset-1',
                      )}
                      data-ui-key="portfolio-work-add-photo"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- 권한 재검사 파일 라우트 */}
                      <img
                        src={routes.file(o.previewFileId)}
                        alt=""
                        loading="lazy"
                        className="bg-muted aspect-[4/3] w-full object-cover"
                      />
                      <span
                        className={cn(
                          'absolute top-1.5 left-1.5 grid size-5 place-items-center rounded border-2 border-white',
                          on ? 'bg-primary' : 'bg-black/25',
                        )}
                      >
                        {on ? <Check aria-hidden className="size-3 text-white" /> : null}
                      </span>
                      <span className="absolute right-1 bottom-1 rounded bg-white/90 px-1 text-[11px]">
                        {kindLabel(o.kind)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {picks.length ? (
            <ul className="flex flex-col gap-2" aria-label={tp('pickedList')}>
              {picks.map((p) => {
                const o = options.find((x) => x.fileId === p.sourceFileId);
                return (
                  <li
                    key={p.sourceFileId}
                    className="grid grid-cols-[48px_1fr_1fr_1fr] items-center gap-2"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- 권한 재검사 파일 라우트 */}
                    <img
                      src={o ? routes.file(o.previewFileId) : ''}
                      alt=""
                      className="bg-muted h-9 w-12 rounded object-cover"
                    />
                    <NativeSelect
                      aria-label={tp('spaceOf', { name: o?.name ?? '' })}
                      value={p.space ?? ''}
                      onChange={(e) =>
                        patch(p.sourceFileId, {
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
                      aria-label={tp('spaceLabel')}
                      placeholder={tp('spaceLabelPlaceholder')}
                      maxLength={20}
                      value={p.spaceLabel}
                      onChange={(e) => patch(p.sourceFileId, { spaceLabel: e.target.value })}
                    />
                    <NativeSelect
                      aria-label={tp('roleOf', { name: o?.name ?? '' })}
                      value={p.role}
                      onChange={(e) =>
                        setPicks((prev) =>
                          setRole(prev, p.sourceFileId, e.target.value as PickedImage['role']),
                        )
                      }
                    >
                      <option value="gallery">{tp('role.gallery')}</option>
                      <option value="after">{tp('role.after')}</option>
                      <option value="before">{tp('role.before')}</option>
                    </NativeSelect>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </section>

        <section className="flex flex-col gap-3 border-t pt-5" aria-labelledby="pf-add-s3">
          <h3 id="pf-add-s3" className="text-sm font-semibold">
            ③ {tp('consent.title')}{' '}
            <span className="text-muted-foreground font-normal">{tp('consent.optional')}</span>
          </h3>
          <label className="flex items-start gap-3 rounded-md border p-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-4"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span>
              {tp('consent.check')}
              <span className="text-muted-foreground text-meta mt-1 block">
                {tp('consent.private')}
              </span>
            </span>
          </label>
          {consent ? (
            <FormRow label={tp('consent.note')} htmlFor="pf-add-note" required>
              <Input
                id="pf-add-note"
                value={note}
                maxLength={200}
                placeholder={tp('consent.notePlaceholder')}
                onChange={(e) => setNote(e.target.value)}
              />
            </FormRow>
          ) : null}
        </section>
      </div>
    </FormSheet>
  );
}

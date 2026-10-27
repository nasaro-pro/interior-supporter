'use client';
// 다중 업로드 (PM-07 ?mode=upload · FW-03 ?upload=1) — REQ-211, REQ-221, 02 문서 6.2
// 최대 20장, 파일별 상태·실패분만 재시도, 성공분 즉시 반영. 저장은 FilesApi(B) 시그니처로만.
// 통합본 F3~F7: GIF·BMP→JPEG·4000px 축소(브라우저), 바이트 진행률, 네트워크 실패 자동 재시도, 사진별 공정
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ImagePlus, MapPin, RotateCcw, Upload, X } from 'lucide-react';
import { createUploadIntent, finalizeUpload } from '@/features/files';
import {
  FILE_RULES,
  PHOTO_BATCH_MAX,
  PHOTO_PHASES,
  type PhotoPhase,
} from '@/shared/contracts/domain';
import { useSearchParamState } from '@/shared/hooks/use-search-param-state';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { FormField } from '@/shared/ui/form-parts';
import { FormSheet } from '@/shared/ui/form-sheet';
import { Input } from '@/shared/ui/input';
import { NativeSelect } from '@/shared/ui/native-fields';
import { Notice } from '@/shared/ui/notice';
import { SwitchField } from '@/shared/ui/switch-field';
import { Textarea } from '@/shared/ui/textarea';
import { createPhoto } from '../server/actions';
import { LocalThumb } from './LocalThumb';
import { PHOTO_LIMITS } from '../schema';
import { readExifDate } from '../lib/exif-date';
import { prepareImage } from '../lib/image-prep';
import { putWithProgress, signedUploadUrl } from '../lib/signed-upload';
import { runUploadItemWithRetry, type PipelineDeps } from '../lib/upload-pipeline';
import {
  PICK_EXTS,
  createUploadItem,
  fitsUploadLimit,
  isActive,
  itemProgress,
  summarizeQueue,
  uploadQueueReducer,
  validatePhotoFile,
  type QueueAction,
  type UploadItem,
} from '../lib/upload-queue';

const CONCURRENCY = 3;
const MAX_MB = FILE_RULES.photo_original.maxBytes / 1024 / 1024;

const deps: PipelineDeps = {
  createUploadIntent,
  finalizeUpload,
  createPhoto,
  // F5: uploadToSignedUrl 과 같은 요청을 XHR 로 보내 바이트 진행률을 받는다.
  // 재시도 때 이전 시도에서 이미 올라간 객체(409)만 통과 (finalize 가 실제 바이트를 다시 검사)
  upload(bucket, path, token, file, onProgress) {
    return putWithProgress(
      signedUploadUrl(process.env.NEXT_PUBLIC_SUPABASE_URL!, bucket, path, token),
      file,
      { 'x-upsert': 'false', apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
      onProgress,
    );
  },
};

export function PhotoUploadSheet({
  projectId,
  companyId,
  allowPublic,
  trigger,
  siteName,
  crewAutoPublic = false,
}: {
  projectId: string;
  companyId: string;
  /** 시공팀은 공개 입력 없음 (POL-017) */
  allowPublic: boolean;
  /** PM-07: ?mode=upload / FW-03: ?upload=1 (screens.ts) */
  trigger: 'mode' | 'upload';
  /** FW-03: 폼 상단 현장명 고정 표시 */
  siteName?: string;
  /** F9: 담당자가 '시공팀 사진 바로 공개'를 켠 현장 — 안내 문구만 바뀐다 (공개 여부는 DB 가 정함) */
  crewAutoPublic?: boolean;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [param, setParam] = useSearchParamState(trigger);
  const openValue = trigger === 'mode' ? 'upload' : '1';
  const open = param === openValue;

  // 큐 상태는 Sheet 밖(이 컴포넌트)에 두어 Sheet 를 닫아도 진행 중인 업로드가 이어진다
  // dispatch 는 ref 사본을 동기로 갱신해 업로드 작업자가 항상 최신 상태를 읽는다
  const [items, setItems] = useState<UploadItem[]>([]);
  const itemsRef = useRef<UploadItem[]>([]);
  const dispatch = useCallback((action: QueueAction) => {
    itemsRef.current = uploadQueueReducer(itemsRef.current, action);
    setItems(itemsRef.current);
  }, []);
  const files = useRef(new Map<string, File>());
  // 미리보기(D-24)용 사본 — 렌더 중에는 ref 를 읽지 않는다 (react-hooks/refs)
  const [previews, setPreviews] = useState<ReadonlyMap<string, File>>(() => new Map());
  const running = useRef(new Set<string>());
  const [pumping, setPumping] = useState(false);
  const pumpingRef = useRef(false);
  const pumpAgain = useRef(false);
  const [rejected, setRejected] = useState<string[]>([]);
  const [preparing, setPreparing] = useState(0);
  const [phase, setPhase] = useState<PhotoPhase>('other');
  const [capturedOn, setCapturedOn] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const summary = summarizeQueue(items);
  const busy = pumping || summary.active > 0 || preparing > 0;

  // 업로드 중 페이지 이탈 경고 (files.queue.leaveWarning)
  useEffect(() => {
    if (!busy) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [busy]);

  /** 고른 파일 1개: EXIF 촬영일(원본에서) → 변환·축소(F3·F4) → 최종 20MB 검사 */
  const prepareOne = async (
    file: File,
  ): Promise<
    { ok: true; file: File; exifDate: string | null } | { ok: false; message: string }
  > => {
    const exifDate = await readExifDate(file);
    const prepared = await prepareImage(file);
    if (!prepared.ok) {
      return { ok: false, message: `${file.name}: ${t('files.rejectReason.corrupt')}` };
    }
    if (!fitsUploadLimit(prepared.file.size)) {
      return { ok: false, message: `${file.name}: ${t('errors.FILE_TOO_LARGE')}` };
    }
    return { ok: true, file: prepared.file, exifDate };
  };

  const addFiles = async (list: FileList | null) => {
    if (!list) return;
    const pendingCount = itemsRef.current.filter((i) => i.stage !== 'done').length;
    const messages: string[] = [];
    const picked: File[] = [];
    for (const file of Array.from(list)) {
      const problem = validatePhotoFile(file);
      if (problem === 'heic') messages.push(`${file.name}: ${t('files.dropzone.heic')}`);
      else if (problem === 'type') messages.push(`${file.name}: ${t('errors.FILE_TYPE_REJECTED')}`);
      else if (problem === 'size') messages.push(`${file.name}: ${t('errors.FILE_TOO_LARGE')}`);
      else if (pendingCount + picked.length >= PHOTO_BATCH_MAX) {
        messages.push(t('files.dropzone.tooMany', { max: PHOTO_BATCH_MAX }));
        break;
      } else picked.push(file);
    }
    if (inputRef.current) inputRef.current.value = '';
    setPreparing((n) => n + picked.length);
    const results = await Promise.all(
      picked.map(async (file) => {
        try {
          return await prepareOne(file);
        } finally {
          setPreparing((n) => n - 1);
        }
      }),
    );
    const accepted: UploadItem[] = [];
    for (const r of results) {
      if (!r.ok) {
        messages.push(r.message);
        continue;
      }
      const key = crypto.randomUUID();
      files.current.set(key, r.file);
      // EXIF 촬영일 제안 (POL-022) — 다시 그린 파일에는 EXIF 가 없으므로 원본에서 읽은 값
      accepted.push({
        ...createUploadItem(r.file, key, crypto.randomUUID()),
        exifDate: r.exifDate,
      });
    }
    setRejected(messages);
    if (accepted.length) {
      setPreviews((prev) => {
        const next = new Map(prev);
        for (const a of accepted) {
          const f = files.current.get(a.key);
          if (f) next.set(a.key, f);
        }
        return next;
      });
      dispatch({ type: 'add', items: accepted });
    }
  };

  const common = useCallback(
    () => ({
      projectId,
      companyId,
      phase,
      capturedOn: capturedOn || null,
      description: description.trim().slice(0, PHOTO_LIMITS.description),
      isPublic: allowPublic && isPublic,
    }),
    [allowPublic, capturedOn, companyId, description, isPublic, phase, projectId],
  );

  // F6: 돌고 있는 중에 다시 부르면(재시도 등) 표시만 하고, 도는 쪽이 끝에서 대기 항목을 한 번 더 확인한다.
  // 예전에는 마지막 작업자가 이미 빠져나간 뒤 누른 재시도가 '대기'로 남을 수 있었다
  const pump = useCallback(async () => {
    if (pumpingRef.current) {
      pumpAgain.current = true;
      return;
    }
    pumpingRef.current = true;
    setPumping(true);
    const input = common();
    const next = () =>
      itemsRef.current.find((i) => i.stage === 'queued' && !running.current.has(i.key));
    const getItem = (key: string) => itemsRef.current.find((i) => i.key === key);
    const worker = async () => {
      for (let item = next(); item; item = next()) {
        const key = item.key;
        running.current.add(key);
        const file = files.current.get(key);
        if (file) {
          await runUploadItemWithRetry(key, file, input, deps, dispatch, getItem);
          // 성공분은 즉시 목록에 반영 (REQ-211)
          if (getItem(key)?.stage === 'done') router.refresh();
        }
        running.current.delete(key);
      }
    };
    do {
      pumpAgain.current = false;
      await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    } while (pumpAgain.current || next());
    pumpingRef.current = false;
    setPumping(false);
    const s = summarizeQueue(itemsRef.current);
    if (s.failed > 0) {
      toast.error(t('files.queue.partial', { total: s.total, failed: s.failed }));
    } else if (s.done > 0) {
      toast.success(t('photos.toast.uploaded', { count: s.done }));
      dispatch({ type: 'clearDone' });
      files.current.clear();
      setPreviews(new Map());
      setParam(null); // 입력 상태 종료 → 같은 현장 목록 (TR-08)
      router.refresh();
    }
  }, [common, dispatch, router, setParam, t]);

  const retry = (key: string) => {
    dispatch({ type: 'retry', key });
    void pump();
  };

  const canStart = summary.queued > 0 && !busy;

  return (
    <>
      <Button onClick={() => setParam(openValue)} data-ui-key="photo-upload-open">
        <Upload aria-hidden />
        {t('photos.action.upload')}
      </Button>
      <FormSheet
        open={open}
        onOpenChange={(next) => setParam(next ? openValue : null)}
        uiKey="photo-upload-sheet"
        title={t('photos.screen.upload')}
        description={t('photos.upload.batchHint', {
          max: PHOTO_BATCH_MAX,
          size: t('files.size.mb', { value: MAX_MB }),
        })}
        footer={
          <>
            <Button variant="outline" onClick={() => setParam(null)}>
              {t('common.action.close')}
            </Button>
            <Button
              onClick={() => void pump()}
              disabled={!canStart}
              pending={busy}
              data-ui-key="photo-upload-submit"
            >
              <Upload aria-hidden />
              {t('photos.upload.start')}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          {siteName ? (
            <Notice tone="brand" icon={MapPin}>
              <span className="font-medium">
                {t('photos.upload.siteFixed', { name: siteName })}
              </span>
            </Notice>
          ) : null}
          {!allowPublic ? (
            <p className="text-muted-foreground text-meta">
              {t(crewAutoPublic ? 'photos.crew.autoPublicNotice' : 'photos.crew.privateNotice')}
            </p>
          ) : null}

          <div className="flex flex-col gap-2">
            <input
              ref={inputRef}
              id="photo-upload-input"
              type="file"
              multiple
              // D-25: MIME 을 함께 적으면 아이폰 사파리가 HEIC 사진을 JPEG 로 바꿔서 넘겨 준다 (GIF·BMP 는 PICK_EXTS 로 받아 F3 변환)
              accept={[...FILE_RULES.photo_original.mimes, ...PICK_EXTS].join(',')}
              className="peer sr-only"
              onChange={(e) => void addFiles(e.target.files)}
              disabled={busy}
            />
            <label
              htmlFor="photo-upload-input"
              className={cn(
                'border-input hover:bg-muted flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center text-sm motion-safe:transition-colors',
                // 숨긴 파일 입력이 포커스를 받으면 상자에 포커스 링 (키보드 사용)
                'peer-focus-visible:ring-ring/50 peer-focus-visible:ring-3',
                busy && 'pointer-events-none opacity-50',
              )}
              data-ui-key="photo-upload-choose"
            >
              <ImagePlus className="text-muted-foreground size-6" aria-hidden />
              <span className="font-medium">{t('photos.upload.choose')}</span>
              <span className="text-muted-foreground text-meta">
                {t('files.dropzone.spec', {
                  exts: PICK_EXTS.join(', '),
                  size: t('files.size.mb', { value: MAX_MB }),
                })}
              </span>
            </label>
            <p className="text-muted-foreground text-xs">{t('files.dropzone.metadataNotice')}</p>
            <p className="text-muted-foreground text-xs">{t('photos.upload.prepNotice')}</p>
            {preparing > 0 ? (
              <p role="status" className="text-muted-foreground text-sm">
                {t('photos.upload.preparing', { count: preparing })}
              </p>
            ) : null}
            {rejected.length > 0 ? (
              <ul role="alert" className="text-destructive text-meta flex flex-col gap-1">
                {rejected.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            ) : null}
          </div>

          <fieldset className="flex flex-col gap-4" disabled={busy}>
            <legend className="text-muted-foreground text-meta">
              {t('photos.form.commonHint')}
            </legend>
            <FormField id="photo-upload-phase" label={t('photos.field.phase')}>
              <NativeSelect value={phase} onChange={(e) => setPhase(e.target.value as PhotoPhase)}>
                {PHOTO_PHASES.map((p) => (
                  <option key={p} value={p}>
                    {t(`photos.phase.${p}`)}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField
              id="photo-upload-date"
              label={t('photos.field.capturedOn')}
              hint={t('photos.form.capturedOnCommonHint')}
            >
              <Input
                type="date"
                value={capturedOn}
                onChange={(e) => setCapturedOn(e.target.value)}
              />
            </FormField>
            <FormField id="photo-upload-desc" label={t('photos.field.description')}>
              <Textarea
                rows={3}
                maxLength={PHOTO_LIMITS.description}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </FormField>
            {allowPublic ? (
              <SwitchField
                id="photo-upload-public"
                label={t('common.visibility.label')}
                description={t('photos.form.publicHint')}
                checked={isPublic}
                onCheckedChange={setIsPublic}
                uiKey="photo-upload-public"
              />
            ) : null}
          </fieldset>

          {items.length > 0 ? (
            <ul className="divide-y rounded-lg border" aria-label={t('photos.upload.queueLabel')}>
              {items.map((item) => (
                <QueueRow
                  key={item.key}
                  item={item}
                  commonPhase={phase}
                  onPhase={(p) =>
                    dispatch({
                      type: 'patch',
                      key: item.key,
                      patch: { phase: p === phase ? null : p },
                    })
                  }
                  file={previews.get(item.key)}
                  onRetry={() => retry(item.key)}
                  onRemove={() => {
                    files.current.delete(item.key);
                    setPreviews((prev) => {
                      const next = new Map(prev);
                      next.delete(item.key);
                      return next;
                    });
                    dispatch({ type: 'remove', key: item.key });
                  }}
                />
              ))}
            </ul>
          ) : null}
          {busy ? (
            <p role="status" className="text-muted-foreground text-sm">
              {t('files.queue.leaveWarning')}
            </p>
          ) : null}
          {summary.failed > 0 && !busy ? (
            <p role="status" className="text-destructive text-sm">
              {t('files.queue.partial', { total: summary.total, failed: summary.failed })}
            </p>
          ) : null}
        </div>
      </FormSheet>
    </>
  );
}

function QueueRow({
  item,
  commonPhase,
  onPhase,
  file,
  onRetry,
  onRemove,
}: {
  item: UploadItem;
  commonPhase: PhotoPhase;
  onPhase: (phase: PhotoPhase) => void;
  file?: File;
  onRetry: () => void;
  onRemove: () => void;
}) {
  const t = useTranslations();
  const progress = itemProgress(item);
  const editable = item.stage === 'queued' || item.stage === 'failed';
  const reason =
    item.error?.kind === 'reject'
      ? t(`files.rejectReason.${item.error.reason}`)
      : item.error?.kind === 'code'
        ? t(`errors.${item.error.code}`)
        : item.error?.kind === 'network'
          ? t('photos.upload.networkError')
          : null;
  return (
    <li data-key={item.key} data-stage={item.stage} className="flex flex-col gap-1.5 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <LocalThumb file={file} alt={t('photos.upload.previewAlt', { name: item.name })} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.name}</span>
        <span className="text-muted-foreground text-xs" data-numeric>
          {t('files.size.mb', { value: (item.size / 1024 / 1024).toFixed(1) })}
        </span>
        <span
          className={cn(
            'text-xs font-medium',
            item.stage === 'failed' && 'text-destructive',
            item.stage === 'done' && 'text-success',
          )}
        >
          {t(`photos.upload.stage.${item.stage}`)}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={t('photos.upload.progressLabel', { name: item.name })}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
        className="bg-muted h-1 overflow-hidden rounded-full"
      >
        <div
          className={cn(
            'h-full rounded-full motion-safe:transition-[width]',
            item.stage === 'failed' ? 'bg-destructive' : 'bg-primary',
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs">
          {item.exifDate
            ? t('photos.upload.exifDate', { date: item.exifDate })
            : t('photos.upload.noExifDate')}
          {item.autoRetry > 0 && item.stage !== 'done'
            ? ` · ${t('photos.upload.autoRetry', { attempt: item.autoRetry })}`
            : ''}
        </p>
        {/* F7: 사진마다 공정을 바꿀 수 있다 (기본은 공통 공정) */}
        <NativeSelect
          aria-label={t('photos.upload.itemPhase', { name: item.name })}
          value={item.phase ?? commonPhase}
          onChange={(e) => onPhase(e.target.value as PhotoPhase)}
          disabled={!editable}
          className="h-8 w-auto text-xs"
          data-ui-key="photo-upload-item-phase"
        >
          {PHOTO_PHASES.map((p) => (
            <option key={p} value={p}>
              {t(`photos.phase.${p}`)}
            </option>
          ))}
        </NativeSelect>
      </div>
      {item.stage === 'failed' ? (
        <div className="flex flex-wrap items-center gap-2">
          {reason ? (
            <p className="text-destructive text-xs" role="alert">
              {reason}
              {item.error?.kind === 'code' && item.error.ref
                ? ` · ${t('common.state.errorRef', { ref: item.error.ref })}`
                : ''}
            </p>
          ) : null}
          <Button size="sm" variant="outline" onClick={onRetry} data-ui-key="photo-upload-retry">
            <RotateCcw aria-hidden />
            {t('photos.upload.retry')}
            <span className="sr-only">{item.name}</span>
          </Button>
        </div>
      ) : null}
      {(item.stage === 'queued' || item.stage === 'failed') && !isActive(item) ? (
        <Button size="sm" variant="ghost" onClick={onRemove} data-ui-key="photo-upload-remove">
          <X aria-hidden />
          {t('photos.upload.remove')}
          <span className="sr-only">{item.name}</span>
        </Button>
      ) : null}
    </li>
  );
}

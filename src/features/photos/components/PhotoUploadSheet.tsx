'use client';
// 다중 업로드 (PM-07 ?mode=upload · FW-03 ?upload=1) — REQ-211, REQ-221, 02 문서 6.2
// 최대 20장, 파일별 상태·실패분만 재시도, 성공분 즉시 반영. 저장은 FilesApi(B) 시그니처로만.
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
import { createBrowserSupabase } from '@/shared/lib/supabase/browser';
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
import { runUploadItem, type PipelineDeps } from '../lib/upload-pipeline';
import { isAlreadyExistsError } from '../lib/storage-error';
import {
  STAGE_PROGRESS,
  createUploadItem,
  isActive,
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
  async upload(bucket, path, token, file) {
    const { error } = await createBrowserSupabase()
      .storage.from(bucket)
      .uploadToSignedUrl(path, token, file, { contentType: file.type });
    if (!error) return { ok: true };
    // 재시도 때 이전 시도에서 이미 올라간 객체(409)만 통과 (finalize 가 실제 바이트를 다시 검사)
    return { ok: false, alreadyExists: isAlreadyExistsError(error) };
  },
};

export function PhotoUploadSheet({
  projectId,
  companyId,
  allowPublic,
  trigger,
  siteName,
}: {
  projectId: string;
  companyId: string;
  /** 시공팀은 공개 입력 없음 (POL-017) */
  allowPublic: boolean;
  /** PM-07: ?mode=upload / FW-03: ?upload=1 (screens.ts) */
  trigger: 'mode' | 'upload';
  /** FW-03: 폼 상단 현장명 고정 표시 */
  siteName?: string;
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
  const running = useRef(new Set<string>());
  const [pumping, setPumping] = useState(false);
  const [rejected, setRejected] = useState<string[]>([]);
  const [phase, setPhase] = useState<PhotoPhase>('other');
  const [capturedOn, setCapturedOn] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const summary = summarizeQueue(items);
  const busy = pumping || summary.active > 0;

  // 업로드 중 페이지 이탈 경고 (files.queue.leaveWarning)
  useEffect(() => {
    if (!busy) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [busy]);

  const addFiles = async (list: FileList | null) => {
    if (!list) return;
    const pendingCount = itemsRef.current.filter((i) => i.stage !== 'done').length;
    const messages: string[] = [];
    const accepted: UploadItem[] = [];
    for (const file of Array.from(list)) {
      const problem = validatePhotoFile(file);
      if (problem === 'heic') messages.push(`${file.name}: ${t('files.dropzone.heic')}`);
      else if (problem === 'type') messages.push(`${file.name}: ${t('errors.FILE_TYPE_REJECTED')}`);
      else if (problem === 'size') messages.push(`${file.name}: ${t('errors.FILE_TOO_LARGE')}`);
      else if (pendingCount + accepted.length >= PHOTO_BATCH_MAX) {
        messages.push(t('files.dropzone.tooMany', { max: PHOTO_BATCH_MAX }));
        break;
      } else {
        const key = crypto.randomUUID();
        files.current.set(key, file);
        accepted.push(createUploadItem(file, key, crypto.randomUUID()));
      }
    }
    setRejected(messages);
    if (accepted.length) dispatch({ type: 'add', items: accepted });
    if (inputRef.current) inputRef.current.value = '';
    // EXIF 촬영일 제안 (POL-022)
    await Promise.all(
      accepted.map(async (item) => {
        const exifDate = await readExifDate(files.current.get(item.key)!);
        if (exifDate) dispatch({ type: 'patch', key: item.key, patch: { exifDate } });
      }),
    );
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

  const pump = useCallback(async () => {
    if (running.current.size > 0) return; // 진행 중인 작업자가 새 대기 항목도 가져간다
    setPumping(true);
    const input = common();
    const next = () =>
      itemsRef.current.find((i) => i.stage === 'queued' && !running.current.has(i.key));
    const worker = async () => {
      for (let item = next(); item; item = next()) {
        running.current.add(item.key);
        const file = files.current.get(item.key);
        if (file) {
          await runUploadItem(item, file, input, deps, dispatch);
          // 성공분은 즉시 목록에 반영 (REQ-211)
          if (itemsRef.current.find((i) => i.key === item!.key)?.stage === 'done') router.refresh();
        }
        running.current.delete(item.key);
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    setPumping(false);
    const s = summarizeQueue(itemsRef.current);
    if (s.failed > 0) {
      toast.error(t('files.queue.partial', { total: s.total, failed: s.failed }));
    } else if (s.done > 0) {
      toast.success(t('photos.toast.uploaded', { count: s.done }));
      dispatch({ type: 'clearDone' });
      files.current.clear();
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
            <p className="text-muted-foreground text-meta">{t('photos.crew.privateNotice')}</p>
          ) : null}

          <div className="flex flex-col gap-2">
            <input
              ref={inputRef}
              id="photo-upload-input"
              type="file"
              multiple
              // D-25: MIME 을 함께 적으면 아이폰 사파리가 HEIC 사진을 JPEG 로 바꿔서 넘겨 준다
              accept={[...FILE_RULES.photo_original.mimes, ...FILE_RULES.photo_original.exts].join(
                ',',
              )}
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
                  exts: FILE_RULES.photo_original.exts.join(', '),
                  size: t('files.size.mb', { value: MAX_MB }),
                })}
              </span>
            </label>
            <p className="text-muted-foreground text-xs">{t('files.dropzone.metadataNotice')}</p>
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
                  file={files.current.get(item.key)}
                  onRetry={() => retry(item.key)}
                  onRemove={() => {
                    files.current.delete(item.key);
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
  file,
  onRetry,
  onRemove,
}: {
  item: UploadItem;
  file?: File;
  onRetry: () => void;
  onRemove: () => void;
}) {
  const t = useTranslations();
  const progress = STAGE_PROGRESS[item.stage];
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
      <p className="text-muted-foreground text-xs">
        {item.exifDate
          ? t('photos.upload.exifDate', { date: item.exifDate })
          : t('photos.upload.noExifDate')}
      </p>
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

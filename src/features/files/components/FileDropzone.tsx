'use client';
// 파일 선택·끌어 놓기 (REQ-060). 규격 문구는 FILE_RULES 에서 만든다.
import { useId, useRef, useState, type DragEvent } from 'react';
import { useTranslations } from 'next-intl';
import { FILE_RULES } from '@/shared/contracts/domain';
import { sizeParts, type UploadKind } from '@/features/files/lib/rules';
import { Upload } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';

export function FileDropzone({
  kind,
  multiple = false,
  max = 1,
  disabled = false,
  onFiles,
  uiKey,
}: {
  kind: UploadKind;
  multiple?: boolean;
  max?: number;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
  uiKey?: string;
}) {
  const t = useTranslations('files');
  const inputRef = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const [over, setOver] = useState(false);
  const [tooMany, setTooMany] = useState(false);
  const rule = FILE_RULES[kind];
  const size = sizeParts(rule.maxBytes);

  const accept = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const files = Array.from(list);
    if (files.length > max) {
      setTooMany(true);
      return;
    }
    setTooMany(false);
    onFiles(files);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setOver(false);
    if (!disabled) accept(e.dataTransfer.files);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      className={cn(
        'border-input flex min-w-0 flex-col items-center gap-2 rounded-md border border-dashed p-4 text-center text-sm',
        over && 'border-ring bg-accent',
        disabled && 'opacity-60',
      )}
    >
      <p>{t('dropzone.prompt')}</p>
      <Button
        variant="outline"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        aria-describedby={hintId}
        data-ui-key={uiKey ?? 'file-dropzone-choose'}
      >
        <Upload aria-hidden />
        {t('dropzone.choose')}
      </Button>
      <p id={hintId} className="text-meta text-muted-foreground break-words">
        {t('dropzone.spec', {
          exts: rule.exts.join(', '),
          size: t(`size.${size.unit}`, { value: size.value }),
        })}
      </p>
      {kind === 'photo_original' ? (
        <p className="text-meta text-muted-foreground">{t('dropzone.metadataNotice')}</p>
      ) : null}
      {tooMany ? (
        <p role="alert" className="text-meta text-destructive">
          {t('dropzone.tooMany', { max })}
        </p>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        hidden
        multiple={multiple}
        accept={rule.exts.join(',')}
        onChange={(e) => {
          accept(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}

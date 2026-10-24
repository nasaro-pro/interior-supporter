'use client';
// PM-19 / CL-19 버전 선택 (?v=N) — 선택 버전의 PDF 미리보기·다운로드가 같은 버전을 가리킨다 (REQ-132)
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { NativeSelect } from '@/shared/ui/native-fields';

export function EstimateVersionPicker({
  versions,
  selectedNo,
  hrefs,
}: {
  versions: { versionNo: number; versionLabel: string; isPublic: boolean }[];
  selectedNo: number;
  /** versionNo → routes.app|portal.estimate(..., N) 로 만든 정규 경로 */
  hrefs: Record<number, string>;
}) {
  const t = useTranslations('estimates');
  const router = useRouter();
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-sm sm:w-64">
      <span className="font-medium">{t('action.selectVersion')}</span>
      <NativeSelect
        value={selectedNo}
        onChange={(e) => {
          const href = hrefs[Number(e.target.value)];
          if (href) router.push(href, { scroll: false });
        }}
        data-ui-key="estimate-version-select"
      >
        {versions.map((v) => (
          <option key={v.versionNo} value={v.versionNo}>
            {t('field.version', { no: v.versionNo })} · {v.versionLabel}
          </option>
        ))}
      </NativeSelect>
    </label>
  );
}

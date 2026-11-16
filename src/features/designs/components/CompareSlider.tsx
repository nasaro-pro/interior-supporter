'use client';
// PM-14 / CL-14 A/B 비교 슬라이더 (REQ-105, 02 문서 6.1) — 선택·조작은 파일·확정 상태를 바꾸지 않는다 (B-T08)
// CR-PF-04: 공개 포트폴리오에서도 쓰도록 이미지 주소(src)·고정 비교(fixedPair)·라벨을 밖에서 받을 수 있게 했다.
//           넘기지 않으면 지금과 똑같이 동작한다 (도안 상세 PM-14·CL-14 는 바꿀 것 없음).
import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { useTranslations } from 'next-intl';
import { routes } from '@/shared/contracts/routes';
import {
  clipForPosition,
  compareDisabledReason,
  DEFAULT_POSITION,
  positionForKey,
  positionFromPointer,
} from '@/features/designs/lib/compare';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { NativeSelect } from '@/shared/ui/native-fields';

export interface CompareImage {
  id: string;
  /** 권한 재검사 파일 라우트(/api/files/…)로 여는 비공개 원본. src 가 있으면 쓰지 않는다 */
  fileId?: string;
  /** 바로 열 수 있는 주소(공개용 사본). 있으면 접근 확인(fetch)을 건너뛴다 */
  src?: string;
  label: string;
  designTitle: string;
  versionNo: number | null;
  pdfPage: number | null;
}

type LoadState = 'loading' | 'ok' | 'failed' | 'denied';

/** 이미지 주소: 공개 주소가 있으면 그대로, 없으면 권한 재검사 라우트 */
export const compareSrc = (img: CompareImage) => img.src ?? routes.file(img.fileId ?? '');

/** B-03: 실패한 이미지를 다시 그릴 수 있게 loading 으로 되돌린다 (denied·ok 는 유지) */
const resetFailed = (prev: Record<string, LoadState>, ids: (string | null | undefined)[]) => {
  const next = { ...prev };
  let changed = false;
  for (const id of ids) {
    if (id && next[id] === 'failed') {
      next[id] = 'loading';
      changed = true;
    }
  }
  return changed ? next : prev;
};

export function CompareSlider({
  images,
  initialA,
  initialB,
  fixedPair = false,
  sideLabels,
  uiKey = 'design-compare',
  fit = 'contain',
}: {
  images: CompareImage[];
  /** 현재 도안의 이미지를 A 기본값으로 */
  initialA?: string;
  /** B 기본값 (없으면 A 가 아닌 첫 이미지) */
  initialB?: string;
  /** true 면 A/B 선택 상자를 숨긴다 — 포트폴리오 비포·애프터처럼 짝이 정해진 경우 */
  fixedPair?: boolean;
  /** 틀 위 라벨 (기본: designs 문구의 A·B). 예: { a: '애프터', b: '비포' } */
  sideLabels?: { a: string; b: string };
  /** data-ui-key 접두어 (화면마다 다르게) */
  uiKey?: string;
  /**
   * 틀 채우기 (CR-PF-04). contain(기본) = 도안처럼 잘리면 안 되는 그림, 비율 유지 + 여백
   * cover = 시공 사진 — 비포·애프터 비율이 달라도 둘 다 틀을 꽉 채워 같은 자리끼리 겹친다
   */
  fit?: 'contain' | 'cover';
}) {
  const t = useTranslations('designs');
  const [a, setA] = useState<string | null>(initialA ?? images[0]?.id ?? null);
  const [b, setB] = useState<string | null>(
    initialB ?? images.find((i) => i.id !== (initialA ?? images[0]?.id))?.id ?? null,
  );
  const [pos, setPos] = useState(DEFAULT_POSITION);
  const [load, setLoad] = useState<Record<string, LoadState>>({});
  /** 이미지별 재시도 횟수 — <img key> 에 넣어 다시 마운트(다시 요청)한다 */
  const [attempt, setAttempt] = useState<Record<string, number>>({});
  const frame = useRef<HTMLDivElement>(null);
  const raf = useRef<number | null>(null);
  const dragging = useRef(false);
  const hintId = useId();

  const imgA = images.find((i) => i.id === a) ?? null;
  const imgB = images.find((i) => i.id === b) ?? null;

  // 접근 가능 여부를 먼저 확인한다 (권한 없음 403/404 와 로딩 실패를 구분)
  // 파일 라우트는 볼 수 있으면 302(서명 URL) → opaqueredirect, 비로그인·권한 없음·준비 전은 404 (B-01).
  // 로그인 화면으로 보내는 리다이렉트는 더 이상 없으므로 opaqueredirect 는 "볼 수 있음" 으로 본다.
  useEffect(() => {
    const targets = [imgA, imgB].filter((x): x is CompareImage => !!x);
    let cancelled = false;
    for (const img of targets) {
      if (load[img.id] === 'ok') continue;
      // 공개 주소는 권한 개념이 없다 — 확인 없이 <img> 의 onLoad/onError 로만 판정
      if (img.src) continue;
      fetch(routes.file(img.fileId ?? ''), { redirect: 'manual', credentials: 'same-origin' })
        .then((res) => {
          if (cancelled) return;
          if (res.type === 'opaqueredirect' || res.ok) {
            // 확인 성공: 앞선 실패(일시 오류)를 되돌려 이미지를 다시 그린다
            setLoad((prev) => resetFailed(prev, [img.id]));
            return;
          }
          setLoad((prev) => ({
            ...prev,
            [img.id]: res.status === 404 || res.status === 403 ? 'denied' : 'failed',
          }));
        })
        .catch(() => {
          if (!cancelled) setLoad((prev) => ({ ...prev, [img.id]: 'failed' }));
        });
    }
    return () => {
      cancelled = true;
    };
    // load 는 결과 기록용이라 의존성에서 뺀다 (선택이 바뀌거나 다시 시도할 때만 확인)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imgA?.id, imgB?.id, attempt[imgA?.id ?? ''], attempt[imgB?.id ?? '']]);

  const stateOf = (img: CompareImage | null) => (img ? (load[img.id] ?? 'loading') : 'loading');
  const failedA = stateOf(imgA) === 'failed';
  const failedB = stateOf(imgB) === 'failed';
  const reason = compareDisabledReason({
    candidateCount: images.length,
    a,
    b,
    denied: stateOf(imgA) === 'denied' || stateOf(imgB) === 'denied',
    loadFailed: failedA || failedB,
  });
  const disabled = reason !== null;
  // 이미지별 실패: 실패한 쪽만 빼고 다른 쪽은 계속 그린다 (후보 부족·미선택·접근 불가면 둘 다 그리지 않음)
  const showImages = reason === null || reason === 'loadFailed';

  const selectA = (id: string | null) => {
    setA(id);
    setLoad((prev) => resetFailed(prev, [id]));
  };
  const selectB = (id: string | null) => {
    setB(id);
    setLoad((prev) => resetFailed(prev, [id]));
  };
  const retry = () => {
    const ids = [failedA ? imgA?.id : null, failedB ? imgB?.id : null].filter(
      (x): x is string => !!x,
    );
    setAttempt((prev) => {
      const next = { ...prev };
      for (const id of ids) next[id] = (next[id] ?? 0) + 1;
      return next;
    });
    setLoad((prev) => resetFailed(prev, ids));
  };

  const setFromPointer = (clientX: number) => {
    const rect = frame.current?.getBoundingClientRect();
    if (!rect) return;
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() =>
      setPos(positionFromPointer(clientX, rect.left, rect.width)),
    );
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    setFromPointer(e.clientX);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (dragging.current) setFromPointer(e.clientX);
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    dragging.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const next = positionForKey(pos, e.key, e.shiftKey);
    if (next === null) return;
    e.preventDefault();
    setPos(next);
  };

  const optionLabel = (img: CompareImage) =>
    [
      img.label,
      img.designTitle,
      img.versionNo ? t('field.version', { no: img.versionNo }) : t('field.wholeDesign'),
      img.pdfPage ? t('field.pdfPage', { page: img.pdfPage }) : null,
    ]
      .filter(Boolean)
      .join(' · ');

  const onImgLoad = (id: string) =>
    setLoad((prev) => (prev[id] === 'denied' ? prev : { ...prev, [id]: 'ok' }));
  const onImgError = (id: string) =>
    setLoad((prev) => (prev[id] === 'denied' ? prev : { ...prev, [id]: 'failed' }));

  const aPct = Math.round(pos);
  // 라벨을 바꿨으면(포트폴리오: 애프터/비포) 읽어 주는 값도 같은 이름으로
  const valueText = sideLabels
    ? `${sideLabels.a} ${aPct}% / ${sideLabels.b} ${100 - aPct}%`
    : t('compare.valueText', { a: aPct, b: 100 - aPct });

  return (
    <section aria-label={t('action.compare')} className="flex flex-col gap-3" data-ui-key={uiKey}>
      <div className={fixedPair ? 'hidden' : 'grid gap-2 sm:grid-cols-2'}>
        <label className="flex min-w-0 flex-col gap-1.5 text-sm">
          <span className="font-medium">{t('compare.sideA')}</span>
          <NativeSelect
            value={a ?? ''}
            onChange={(e) => selectA(e.target.value || null)}
            disabled={images.length < 2}
            data-ui-key={`${uiKey}-select-a`}
          >
            <option value="">{t('compare.choose')}</option>
            {images.map((img) => (
              <option key={img.id} value={img.id} disabled={img.id === b}>
                {optionLabel(img)}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="flex min-w-0 flex-col gap-1.5 text-sm">
          <span className="font-medium">{t('compare.sideB')}</span>
          <NativeSelect
            value={b ?? ''}
            onChange={(e) => selectB(e.target.value || null)}
            disabled={images.length < 2}
            data-ui-key={`${uiKey}-select-b`}
          >
            <option value="">{t('compare.choose')}</option>
            {images.map((img) => (
              <option key={img.id} value={img.id} disabled={img.id === a}>
                {optionLabel(img)}
              </option>
            ))}
          </NativeSelect>
        </label>
      </div>

      <div
        ref={frame}
        // D-06: 큰 모니터에서 세로가 화면을 넘지 않도록 높이 상한(화면의 70%) — 이미지는 object-contain 으로 비율 유지
        className="bg-muted relative aspect-[16/10] max-h-[70svh] w-full min-w-0 touch-none overflow-hidden rounded-md border select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        data-testid="compare-frame"
      >
        {imgB && showImages && !failedB ? (
          // eslint-disable-next-line @next/next/no-img-element -- 권한 재검사 라우트(302)라 next/image 최적화 대상이 아님
          <img
            key={`${imgB.id}:${attempt[imgB.id] ?? 0}`}
            src={compareSrc(imgB)}
            alt={imgB.label}
            draggable={false}
            onLoad={() => onImgLoad(imgB.id)}
            onError={() => onImgError(imgB.id)}
            className={`absolute inset-0 h-full w-full ${fit === 'cover' ? 'object-cover' : 'object-contain'}`}
            data-testid="compare-b"
          />
        ) : null}
        {imgA && showImages && !failedA ? (
          // eslint-disable-next-line @next/next/no-img-element -- 위와 같음
          <img
            key={`${imgA.id}:${attempt[imgA.id] ?? 0}`}
            src={compareSrc(imgA)}
            alt={imgA.label}
            draggable={false}
            onLoad={() => onImgLoad(imgA.id)}
            onError={() => onImgError(imgA.id)}
            style={{ clipPath: clipForPosition(pos) }}
            // X1: object-contain 여백은 투명이라 아래 B 가 비친다 → 틀과 같은 불투명 배경으로 A 쪽을 덮는다
            className={`bg-muted absolute inset-0 h-full w-full ${fit === 'cover' ? 'object-cover' : 'object-contain'}`}
            data-testid="compare-a"
          />
        ) : null}
        {disabled ? (
          <div
            role="status"
            className="text-muted-foreground absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center text-sm"
          >
            <span
              className={reason === 'loadFailed' ? 'bg-background/90 rounded-sm px-2 py-1' : ''}
            >
              {t(`compare.disabled.${reason}`)}
            </span>
            {reason === 'loadFailed' ? (
              <Button variant="outline" onClick={retry} data-ui-key={`${uiKey}-retry`}>
                <RefreshCw aria-hidden />
                {t('compare.retry')}
              </Button>
            ) : null}
          </div>
        ) : (
          <>
            <span className="bg-background/80 absolute top-2 left-2 rounded-sm px-1.5 text-xs">
              {sideLabels?.a ?? t('compare.sideA')}
            </span>
            <span className="bg-background/80 absolute top-2 right-2 rounded-sm px-1.5 text-xs">
              {sideLabels?.b ?? t('compare.sideB')}
            </span>
            <div
              role="slider"
              tabIndex={0}
              aria-label={t('compare.handle')}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={aPct}
              aria-valuetext={valueText}
              aria-describedby={hintId}
              onKeyDown={onKeyDown}
              data-ui-key={`${uiKey}-handle`}
              style={{ left: `${pos}%` }}
              className="focus-visible:ring-ring/50 absolute top-0 bottom-0 w-6 -translate-x-1/2 cursor-ew-resize rounded-sm outline-none focus-visible:ring-3"
            >
              <span className="bg-background absolute top-0 bottom-0 left-1/2 w-0.5 -translate-x-1/2 shadow-sm" />
              <span className="border-border bg-background absolute top-1/2 left-1/2 h-6 w-6 -translate-1/2 rounded-full border" />
            </div>
          </>
        )}
      </div>
      <p className="text-meta text-muted-foreground flex flex-wrap justify-between gap-x-3">
        <span id={hintId}>{t('compare.keyboardHint')}</span>
        {!disabled ? (
          <span aria-hidden className="whitespace-nowrap">
            {valueText}
          </span>
        ) : null}
      </p>
    </section>
  );
}

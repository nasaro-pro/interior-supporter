'use client';
// D-26~D-28 도안 공간·대표·순서 (디자이너 화면) — 공간 선택칸 · 대표 지정 버튼 · 위/아래 이동
import { useTransition, type ComponentProps } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, Star } from 'lucide-react';
import { MATERIAL_SPACES } from '@/shared/contracts/domain';
import { Button } from '@/shared/ui/button';
import { NativeSelect } from '@/shared/ui/native-fields';
import { useActionErrorText } from '@/shared/ui/action-error';
import { moveDesign, moveDesignSpace, setMainDesign } from '@/features/designs/server/actions';
import type { Space } from '@/features/designs/lib/order';

/** 공간 선택 (빈 값 = 전체). react-hook-form register 결과를 그대로 펼쳐 넣는다 */
export function DesignSpaceSelect(props: ComponentProps<typeof NativeSelect>) {
  const t = useTranslations('designs');
  const tm = useTranslations('materials');
  return (
    <NativeSelect data-ui-key="design-space-select" {...props}>
      <option value="">{t('space.all')}</option>
      {MATERIAL_SPACES.map((s) => (
        <option key={s} value={s}>
          {tm(`space.${s}`)}
        </option>
      ))}
    </NativeSelect>
  );
}

/** react-hook-form: '' → null */
export const spaceValue = (v: unknown) => (v === '' || v == null ? null : v);

export function MainDesignButton({ projectId, id }: { projectId: string; id: string }) {
  const t = useTranslations('designs');
  const actionText = useActionErrorText();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      aria-busy={pending}
      data-ui-key="design-set-main"
      onClick={() =>
        start(async () => {
          const res = await setMainDesign({ projectId, id });
          if (!res.ok) {
            toast.error(actionText(res.error));
            return;
          }
          toast.success(t('toast.mainSet'));
          router.refresh();
        })
      }
    >
      <Star aria-hidden />
      {t('action.setMain')}
    </Button>
  );
}

export function DesignMoveButtons({
  projectId,
  id,
  title,
  first,
  last,
}: {
  projectId: string;
  id: string;
  title: string;
  first: boolean;
  last: boolean;
}) {
  const t = useTranslations('designs');
  const actionText = useActionErrorText();
  const router = useRouter();
  const [pending, start] = useTransition();
  const move = (direction: 'up' | 'down') =>
    start(async () => {
      const res = await moveDesign({ projectId, id, direction });
      if (!res.ok) toast.error(actionText(res.error));
      else router.refresh();
    });
  return (
    <span className="flex gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={pending || first}
        aria-label={t('action.moveUp', { title })}
        data-ui-key="design-move-up"
        onClick={() => move('up')}
      >
        <ArrowUp aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={pending || last}
        aria-label={t('action.moveDown', { title })}
        data-ui-key="design-move-down"
        onClick={() => move('down')}
      >
        <ArrowDown aria-hidden />
      </Button>
    </span>
  );
}

/** D-28 공간 순서 위/아래 (공간 묶음 제목 옆) */
export function DesignSpaceMoveButtons({
  projectId,
  space,
  label,
  first,
  last,
}: {
  projectId: string;
  space: Space;
  label: string;
  first: boolean;
  last: boolean;
}) {
  const t = useTranslations('designs');
  const actionText = useActionErrorText();
  const router = useRouter();
  const [pending, start] = useTransition();
  const move = (direction: 'up' | 'down') =>
    start(async () => {
      const res = await moveDesignSpace({ projectId, space, direction });
      if (!res.ok) toast.error(actionText(res.error));
      else router.refresh();
    });
  return (
    <span className="flex gap-1" data-ui-key="design-space-move">
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={pending || first}
        aria-label={t('action.spaceUp', { space: label })}
        data-ui-key="design-space-move-up"
        onClick={() => move('up')}
      >
        <ArrowUp aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={pending || last}
        aria-label={t('action.spaceDown', { space: label })}
        data-ui-key="design-space-move-down"
        onClick={() => move('down')}
      >
        <ArrowDown aria-hidden />
      </Button>
    </span>
  );
}

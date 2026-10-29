// D-32 · D-33 · CU-05 · CU-06 도안 · 자재 옆 메모 (서버 컴포넌트) — CR-6 메모 패널 제공 계약
// 보고 있는 항목에 자동 연결된 메모만 보여 준다. 고객: 본인 메모 + 새 메모 입력 / 편집자: 전체 메모 + 답변
// 사용: B 의 도안 · 자재 상세 화면이 <ItemMemoSection> 으로 감싼다 (레이아웃은 MemoLayout)
import type { ReactNode } from 'react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { getAccessContext } from '@/features/core';
import type { ProjectAccess } from '@/shared/contracts/integration';
import { routes } from '@/shared/contracts/routes';
import { EmptyState } from '@/shared/ui/states';
import { listItemMemos } from '../server/queries';
import type { RequestTargetType } from '../schema';
import { MemoComposer } from './MemoComposer';
import { MemoLayout } from './MemoLayout';
import { RequestStatusBadge } from './RequestStatusBadge';
import { RequestThread } from './RequestThread';

export async function ItemMemoSection({
  viewer,
  targetType,
  targetId,
  canMemo,
  children,
}: {
  viewer: ProjectAccess;
  targetType: RequestTargetType;
  targetId: string;
  /** 고객이 새 메모를 쓸 수 있는가 (공개 · 보관 안 된 항목만 — DB 트리거도 확인) */
  canMemo: boolean;
  children: ReactNode;
}) {
  // 시공팀은 메모를 보지 않는다 (POL-005)
  if (viewer.as === 'field') return <>{children}</>;
  const t = await getTranslations('requests');
  const ctx = await getAccessContext();
  const memos = await listItemMemos(viewer.projectId, viewer, ctx.userId, targetType, targetId);
  const editor = viewer.as === 'editor';
  const detailHref = (id: string) =>
    editor
      ? routes.app.request(viewer.companySlug, viewer.projectId, id)
      : routes.portal.request(viewer.projectId, id);

  const panel = (
    <div className="flex flex-col gap-4" data-ui-key="item-memo-list">
      {memos.length === 0 ? (
        <EmptyState
          title={editor ? t('memo.emptyEditor') : t('memo.emptyCustomer')}
          className="py-4"
        />
      ) : (
        memos.map((m) => (
          <section
            key={m.id}
            data-key={m.id}
            className="flex flex-col gap-2 border-b pb-4 last:border-0"
          >
            <div className="flex items-center justify-between gap-2">
              <RequestStatusBadge status={m.status} />
              <Link
                href={detailHref(m.id)}
                className="text-meta text-muted-foreground underline-offset-2 hover:underline"
                data-ui-key="item-memo-detail"
              >
                {t('memo.openThread')}
              </Link>
            </div>
            <RequestThread
              entries={m.entries}
              perspective={editor ? 'editor' : 'customer'}
              compact
            />
            {editor && m.status !== 'resolved' ? (
              <MemoComposer kind="reply" projectId={viewer.projectId} requestId={m.id} />
            ) : null}
          </section>
        ))
      )}
      {/* 담당자의 고객 화면 미리보기는 읽기 전용 */}
      {!editor && canMemo && !viewer.preview ? (
        <MemoComposer
          kind="memo"
          projectId={viewer.projectId}
          targetType={targetType}
          targetId={targetId}
        />
      ) : null}
    </div>
  );

  return (
    <MemoLayout panel={panel} count={memos.length}>
      {children}
    </MemoLayout>
  );
}

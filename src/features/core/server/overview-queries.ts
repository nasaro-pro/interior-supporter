// src/features/core/server/overview-queries.ts (A · TASK-006·009) — 개요 PM-03·고객 홈 CL-03 의 B·C 요약 호출 (CT05)
// 원본 단일(P-04): 요약은 B·C provider 가 원본을 호출자 권한(RLS)으로 조회한 결과만 표시한다. 복사·캐시 없음.
// provider 위치·이름: src/features/<기능>/server/summary.ts — CR-A-01 (계약에 export 이름 없음)
import 'server-only';
import type { ProjectAccess, SummaryItem } from '@/shared/contracts/integration';
import { logger } from '@/shared/lib/logger';
import {
  summaryProvider as designsSummary,
  documentsProvider as designsDocuments,
} from '@/features/designs/server/summary';
import { summaryProvider as materialsSummary } from '@/features/materials/server/summary';
import {
  summaryProvider as estimatesSummary,
  documentsProvider as estimatesDocuments,
} from '@/features/estimates/server/summary';
import { summaryProvider as requestsSummary } from '@/features/requests/server/summary';
import { summaryProvider as photosSummary } from '@/features/photos/server/summary';
import { nextScheduleProvider } from '@/features/schedule/server/summary';

/** 한 영역의 결과: 실패해도 다른 영역은 표시 (부분 실패 허용) */
export type Block = { items: SummaryItem[]; failed: boolean };

async function safe(
  label: string,
  projectId: string,
  fn: () => Promise<SummaryItem[]>,
): Promise<Block> {
  try {
    return { items: await fn(), failed: false };
  } catch (e) {
    logger.warn('overview.provider.failed', {
      projectId,
      action: label,
      code: e instanceof Error ? e.name : 'unknown',
    });
    return { items: [], failed: true };
  }
}

const byAtDesc = (a: SummaryItem, b: SummaryItem) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0);

export async function loadProjectSummaries(
  projectId: string,
  viewer: ProjectAccess,
  limit = 8,
): Promise<{ recent: Block; schedule: Block; documents: Block }> {
  const recentProviders = [
    ['designs', designsSummary],
    ['materials', materialsSummary],
    ['estimates', estimatesSummary],
    ['requests', requestsSummary],
    ['photos', photosSummary],
  ] as const;
  const [recentParts, schedule, docA, docB] = await Promise.all([
    Promise.all(
      recentProviders.map(([label, p]) =>
        safe(label, projectId, () => p.recent(projectId, viewer, 5)),
      ),
    ),
    safe('schedule', projectId, () => nextScheduleProvider.next(projectId, viewer, 3)),
    safe('designs.documents', projectId, () => designsDocuments.documents(projectId, viewer)),
    safe('estimates.documents', projectId, () => estimatesDocuments.documents(projectId, viewer)),
  ]);
  const recent: Block = {
    items: recentParts
      .flatMap((b) => b.items)
      .sort(byAtDesc)
      .slice(0, limit),
    failed: recentParts.some((b) => b.failed),
  };
  return {
    recent,
    schedule,
    documents: { items: [...docA.items, ...docB.items], failed: docA.failed || docB.failed },
  };
}

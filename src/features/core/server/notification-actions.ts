'use server';
// src/features/core/server/notification-actions.ts (A · TASK-010) — 알림 열기(읽음 + 정규 D4 이동)·모두 읽음 (REQ-040, TR-09)
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import { fail, ok, type ActionResult } from '@/shared/contracts/errors';
import { routes } from '@/shared/contracts/routes';
import { logger } from '@/shared/lib/logger';
import { resolverFor } from '../notifications/targets';
import { loadAccessContext } from './access';
import { areaOfNotification, isTypeInArea, typesForArea, type Area } from './notification-queries';

const UUID = /^[0-9a-f-]{36}$/i;

function listHref(area: Area, slug: string | undefined): string {
  if (area === 'portal') return routes.portal.notifications();
  if (area === 'field') return routes.field.notifications();
  return slug ? routes.app.notifications(slug) : routes.selectArea();
}

/**
 * 클릭: 읽음 처리 → 현재 권한으로 대상 해석 → 정규 화면으로 이동.
 * 볼 수 없으면 목록으로 돌아가 안내 (다른 프로젝트로 묵시 이동 금지, POL-027)
 */
export async function openNotification(area: Area, slug: string, id: string): Promise<void> {
  const back = listHref(area, slug || undefined);
  if (!UUID.test(id)) redirect(back);
  const ctx = await loadAccessContext();
  if (!ctx) redirect(routes.login());
  const supabase = await createServerSupabase();
  const { data: n } = await supabase
    .from('notifications')
    .select('id, type, object_type, object_id, project_id, company_id, read_at')
    .eq('id', id)
    .eq('recipient_id', ctx.userId) // A-07 심층 방어
    .maybeSingle();
  if (!n || !isTypeInArea(n.type, area)) redirect(back);
  if (!n.read_at) {
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', n.id);
    if (error) logger.warn('notifications.read.failed', { userId: ctx.userId, dbCode: error.code });
  }
  const resolver = resolverFor(n.object_type);
  const companySlug = ctx.memberships.find((m) => m.companyId === n.company_id)?.slug ?? '';
  let href: string | null = null;
  if (resolver && n.project_id) {
    try {
      const target = await resolver(
        n.object_id,
        n.project_id,
        areaOfNotification(n.type, area),
        companySlug,
      );
      href = target?.href ?? null;
    } catch (e) {
      logger.warn('notifications.resolve.failed', {
        objectId: n.object_id,
        code: e instanceof Error ? e.name : 'unknown',
      });
    }
  }
  revalidatePath(back);
  redirect(href ?? `${back}?unavailable=1`);
}

/** A-07: 지금 보고 있는 영역(+PM 은 그 업체)의 알림만 모두 읽음 */
export async function markAllNotificationsRead(
  area: Area,
  slug?: string,
): Promise<ActionResult<null>> {
  if (area !== 'app' && area !== 'portal' && area !== 'field') return fail('VALIDATION_FAILED');
  const ctx = await loadAccessContext();
  if (!ctx) return fail('UNAUTHENTICATED');
  let companyId: string | undefined;
  if (area === 'app' && slug) {
    const s = decodeURIComponent(slug).toLowerCase();
    companyId = ctx.memberships.find((m) => m.slug.toLowerCase() === s)?.companyId;
    if (!companyId) return fail('NOT_FOUND');
  }
  const supabase = await createServerSupabase();
  let q = supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_id', ctx.userId)
    .in('type', typesForArea(area))
    .is('read_at', null);
  if (companyId) q = q.eq('company_id', companyId);
  const { error } = await q;
  if (error) {
    logger.warn('notifications.read_all.failed', { userId: ctx.userId, dbCode: error.code });
    return fail('INTERNAL');
  }
  revalidatePath('/', 'layout');
  return ok(null);
}

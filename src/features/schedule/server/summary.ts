// ⑨ NextScheduleProvider — 다음 일정 (REQ-234, integration.ts 3장). A 의 개요·고객 홈이 호출.
// 오늘(KST) 이후 끝나는 일정 중 가장 이른 것부터. 고객은 공개 일정만 (D13). 원본은 schedule_events 하나 (INT-07)
import 'server-only';
import { getLocale, getTranslations } from 'next-intl/server';
import type { NextScheduleProvider, SummaryItem } from '@/shared/contracts/integration';
import { routes } from '@/shared/contracts/routes';
import { todayKst } from '@/shared/lib/dates';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import { formatEventWhen } from '../lib/format';

const hm = (v: string | null) => (v ? v.slice(0, 5) : null);

export const nextScheduleProvider: NextScheduleProvider = {
  async next(projectId, viewer, limit = 3) {
    if (viewer.as === 'field') return [];
    const today = todayKst();
    const supabase = await createServerSupabase();
    let query = supabase
      .from('schedule_events')
      .select('id, title, start_date, start_time, end_date, end_time')
      .eq('project_id', projectId)
      .is('archived_at', null)
      .or(`end_date.gte.${today},and(end_date.is.null,start_date.gte.${today})`);
    if (viewer.as === 'customer') query = query.eq('is_public', true);
    const { data } = await query
      .order('start_date', { ascending: true })
      .order('start_time', { ascending: true, nullsFirst: true })
      .limit(limit);
    const locale = (await getLocale()) === 'en' ? 'en' : 'ko';
    const t = await getTranslations('schedule');
    return (data ?? []).map<SummaryItem>((e) => {
      const event = {
        startDate: e.start_date,
        startTime: hm(e.start_time),
        endDate: e.end_date,
        endTime: hm(e.end_time),
      };
      return {
        kind: 'schedule_events',
        id: e.id,
        title: e.title,
        // 정렬 기준 = 시작 시각 (KST 달력 값을 오프셋과 함께 ISO 로)
        at: `${e.start_date}T${event.startTime ?? '00:00'}:00+09:00`,
        subtitleKey: 'schedule.summary.when',
        subtitleValues: { date: formatEventWhen(event, locale, { allDay: t('field.allDay') }) },
        screenId: viewer.as === 'editor' ? 'PM-18' : 'CL-18',
        href:
          viewer.as === 'editor'
            ? routes.app.scheduleEvent(viewer.companySlug, projectId, e.id)
            : routes.portal.scheduleEvent(projectId, e.id),
      };
    });
  },
};

export default nextScheduleProvider;

// 마이홈(CL-03 위쪽) 공사 진행 막대 — 시작일·완공 예정일·오늘(KST)로 계산 (순수 함수, 테스트 대상)
// 날짜는 모두 'YYYY-MM-DD'. 양 끝 포함 (POL-006 과 같은 셈)

export type ProgressState = 'unknown' | 'before' | 'during' | 'after' | 'done';

export interface ConstructionProgress {
  state: ProgressState;
  /** 0~100 (정수). unknown 이면 null */
  percent: number | null;
  /** 공사 며칠째 (during 일 때만) */
  dayNo: number | null;
  /** 전체 공사 일수 (양 끝 포함) */
  totalDays: number | null;
  /** 완공 예정일까지 남은 날 (before·during). 오늘이 완공일이면 0 */
  daysLeft: number | null;
  /** 시작까지 남은 날 (before 일 때만) */
  daysToStart: number | null;
}

const DAY = 86_400_000;
const toUtc = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return Date.UTC(y!, (m ?? 1) - 1, d ?? 1);
};
const diff = (a: string, b: string) => Math.round((toUtc(b) - toUtc(a)) / DAY);

export function constructionProgress(
  p: { startDate: string | null; endDate: string | null; status: string },
  today: string,
): ConstructionProgress {
  const none = { percent: null, dayNo: null, totalDays: null, daysLeft: null, daysToStart: null };
  if (p.status === 'completed') {
    const totalDays = p.startDate && p.endDate ? diff(p.startDate, p.endDate) + 1 : null;
    return { ...none, state: 'done', percent: 100, totalDays };
  }
  if (!p.startDate || !p.endDate || p.endDate < p.startDate) return { ...none, state: 'unknown' };
  const totalDays = diff(p.startDate, p.endDate) + 1;
  if (today < p.startDate) {
    return {
      ...none,
      state: 'before',
      percent: 0,
      totalDays,
      daysToStart: diff(today, p.startDate),
      daysLeft: diff(today, p.endDate),
    };
  }
  if (today > p.endDate) {
    // 예정일이 지났는데 완료 처리 전 — 막대는 가득, '마무리 중'으로 보여 준다
    return { ...none, state: 'after', percent: 100, totalDays };
  }
  const dayNo = diff(p.startDate, today) + 1;
  return {
    ...none,
    state: 'during',
    totalDays,
    dayNo,
    daysLeft: diff(today, p.endDate),
    percent: Math.min(99, Math.max(1, Math.round((dayNo / totalDays) * 100))),
  };
}

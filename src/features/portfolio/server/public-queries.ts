// 공개 포트폴리오 조회 (PUB-10·11) — 공개 RPC 2개만 쓴다 (표는 직원 전용 RLS라 비로그인은 직접 못 읽음)
// cache(): 같은 요청 안에서 generateMetadata·layout·page 가 같은 값을 한 번만 가져온다.
// 참고: createServerSupabase 는 쿠키를 읽으므로 페이지가 매 요청 렌더된다(정적 캐시 불가).
//       공개 페이지를 캐시하려면 쿠키 없는 anon 클라이언트 도우미가 필요 → CR-PF-11.
import 'server-only';
import { cache } from 'react';
import { z } from 'zod';
import { logger } from '@/shared/lib/logger';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import { parsePortfolio, parseWork } from '../lib/parse';

const SLUG = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/; // companies.slug check 와 같은 규칙

export const getPublicPortfolio = cache(async (slug: string) => {
  const s = decodeURIComponent(slug).trim().toLowerCase();
  if (!SLUG.test(s)) return null; // DB 호출 없이 거절
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc('get_public_portfolio', { p_slug: s });
  if (error) {
    logger.warn('portfolio.public.list_failed', { dbCode: error.code });
    return null;
  }
  return parsePortfolio(data);
});

export const getPublicWork = cache(async (slug: string, workId: string) => {
  const s = decodeURIComponent(slug).trim().toLowerCase();
  if (!SLUG.test(s) || !z.guid().safeParse(workId).success) return null;
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc('get_public_portfolio_work', {
    p_slug: s,
    p_work: workId,
  });
  if (error) {
    logger.warn('portfolio.public.work_failed', { dbCode: error.code, objectId: workId });
    return null;
  }
  return parseWork(data);
});

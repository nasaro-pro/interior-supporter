// src/shared/lib/supabase/admin.ts (A) — service_role. 허용 목록 밖 import 금지 (TC-909)
import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/shared/contracts/database.types';

const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function createAdminSupabase() {
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      // 50MB 원본 다운로드(finalize)를 고려해 사용자 클라이언트보다 길게
      fetch: (input, init) => fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(60_000) }),
    },
  });
}

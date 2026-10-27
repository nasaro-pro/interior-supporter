// eslint.config.mjs (A · 스타터 고정) — 00 헌법 5.2(금지 기술)·8장(보안)을 기계로 검사한다. 규칙 완화는 CR.
import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

/** 00 헌법 5.2 — 설치·import 금지 패키지 */
const BANNED = [
  '@supabase/auth-helpers-nextjs',
  'axios',
  'moment',
  'dayjs',
  '@prisma/client',
  'drizzle-orm',
  'redux',
  '@reduxjs/toolkit',
  'zustand',
  'jotai',
  '@tanstack/react-query',
  'swr',
  'styled-components',
  '@emotion/react',
  '@emotion/styled',
  '@mui/material',
  '@chakra-ui/react',
  'antd',
  'next-auth',
  'firebase',
  '@trpc/server',
  '@trpc/client',
  'express',
  'next/router',
].map((name) => ({
  name,
  message: '00 헌법 5.2 금지 기술입니다. 필요하면 진행 기록에 CR 로 적으세요.',
}));

/** 00 헌법 8.3 — service_role 클라이언트는 허용 파일에서만 */
const ADMIN = {
  name: '@/shared/lib/supabase/admin',
  message:
    'service_role 클라이언트는 허용 파일(core/server/auth-actions.ts, files/server/*)에서만 씁니다 (TC-909).',
};

const PATTERNS = [
  { group: ['../../*'], message: '상대 경로 대신 @/ 별칭을 쓰세요 (00 헌법 6.1).' },
];

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    '.next/**',
    'node_modules/**',
    'next-env.d.ts',
    'supabase/**',
    'ai/**',
    'docs/**',
    '_submit/**',
    '_starter/**',
    'scripts/**',
    'src/shared/contracts/database.types.ts',
  ]),
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-restricted-imports': ['error', { paths: [...BANNED, ADMIN], patterns: PATTERNS }],
    },
  },
  {
    files: [
      'src/shared/lib/supabase/admin.ts',
      'src/features/core/server/auth-actions.ts',
      'src/features/files/server/**/*.ts',
      // 2차 수정 CR-3: 계정 정지·익명화·재설정 링크·정리 파일 삭제 (사이트 관리)
      'src/features/admin/server/auth-admin.ts',
    ],
    rules: { 'no-restricted-imports': ['error', { paths: BANNED, patterns: PATTERNS }] },
  },
]);

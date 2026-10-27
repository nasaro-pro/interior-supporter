// src/features/core/server/mail.ts (A · D-14) — 계정 안내 메일 발송 (외부 메일 API 를 fetch 로 직접 호출, 새 패키지 없음)
// 환경변수: MAIL_API_KEY(Resend API 키), MAIL_FROM(보내는 주소, 예: "인테리어 서포터 <no-reply@example.com>")
// 둘 중 하나라도 없으면 보내지 않고 'not_configured' — 화면이 임시 비밀번호를 디자이너에게 한 번 보여 준다.
// 비밀번호 원문은 로그에 남기지 않는다 (헌법 9장).
import 'server-only';
import { logger } from '@/shared/lib/logger';

export type MailResult = 'sent' | 'not_configured' | 'failed';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

const MAIL_ENDPOINT = 'https://api.resend.com/emails';

export function isMailConfigured(): boolean {
  return Boolean(process.env.MAIL_API_KEY && process.env.MAIL_FROM);
}

export async function sendMail(msg: MailMessage): Promise<MailResult> {
  const key = process.env.MAIL_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!key || !from) return 'not_configured';
  try {
    const res = await fetch(MAIL_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [msg.to], subject: msg.subject, text: msg.text }),
      cache: 'no-store',
    });
    if (!res.ok) {
      logger.warn('mail.send.failed', { status: res.status });
      return 'failed';
    }
    return 'sent';
  } catch {
    logger.warn('mail.send.error', {});
    return 'failed';
  }
}

/** D-14: 아이디·임시 비밀번호 안내 (ko/en) */
export function accountMail(opts: {
  locale: 'ko' | 'en';
  to: string;
  displayName: string;
  companyName: string;
  projectName: string;
  tempPassword: string;
  loginUrl: string;
  expiresHours: number;
}): MailMessage {
  if (opts.locale === 'en') {
    return {
      to: opts.to,
      subject: `[${opts.companyName}] Your account for ${opts.projectName}`,
      text: [
        `Hello ${opts.displayName},`,
        '',
        `${opts.companyName} created an account for you to follow "${opts.projectName}".`,
        '',
        `Sign in: ${opts.loginUrl}`,
        `ID (email): ${opts.to}`,
        `Temporary password: ${opts.tempPassword}`,
        '',
        `The temporary password expires in ${opts.expiresHours} hours. You'll set your own password the first time you sign in.`,
      ].join('\n'),
    };
  }
  return {
    to: opts.to,
    subject: `[${opts.companyName}] ${opts.projectName} 계정 안내`,
    text: [
      `${opts.displayName}님, 안녕하세요.`,
      '',
      `${opts.companyName}에서 "${opts.projectName}" 프로젝트를 함께 보실 수 있도록 계정을 만들었습니다.`,
      '',
      `로그인 주소: ${opts.loginUrl}`,
      `아이디(이메일): ${opts.to}`,
      `임시 비밀번호: ${opts.tempPassword}`,
      '',
      `임시 비밀번호는 ${opts.expiresHours}시간 동안 쓸 수 있습니다. 처음 로그인하면 새 비밀번호를 정하게 됩니다.`,
    ].join('\n'),
  };
}

/** 이미 계정이 있는 사람을 새 프로젝트에 배정했을 때 안내 */
export function assignedMail(opts: {
  locale: 'ko' | 'en';
  to: string;
  displayName: string;
  companyName: string;
  projectName: string;
  loginUrl: string;
}): MailMessage {
  if (opts.locale === 'en') {
    return {
      to: opts.to,
      subject: `[${opts.companyName}] You were added to ${opts.projectName}`,
      text: `Hello ${opts.displayName},\n\n${opts.companyName} added you to "${opts.projectName}". Sign in with your existing account: ${opts.loginUrl}`,
    };
  }
  return {
    to: opts.to,
    subject: `[${opts.companyName}] ${opts.projectName} 프로젝트에 추가되었습니다`,
    text: `${opts.displayName}님, 안녕하세요.\n\n${opts.companyName}에서 "${opts.projectName}" 프로젝트에 추가했습니다. 기존 계정으로 로그인하세요: ${opts.loginUrl}`,
  };
}

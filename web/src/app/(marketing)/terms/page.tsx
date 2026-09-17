import { messages } from "@/lib/messages";

export default function Page() {
  return (
    <main className="hx-page space-y-5">
      <p className="legal-banner">{messages.legalDraft}</p>
      <h1>이용약관</h1>
      <p>
        본 서비스는 인테리어 업체가 고객과 프로젝트 진행 정보를 공유하도록 돕는 플랫폼입니다.
        업체는 고객 개인정보를 수집·이용하는 개인정보처리자이며, 플랫폼 운영자는 업체의 위탁을
        받아 호스팅·저장·알림 발송 등 처리 업무를 수행합니다.
      </p>
      <h2 className="text-lg font-medium">처리 위탁</h2>
      <p>
        업체는 회원가입 및 서비스 이용을 통해 플랫폼 운영자에게 계정·프로젝트·현장 사진 등
        개인정보 처리를 위탁합니다. 운영자는 위탁 목적 범위에서만 처리하며, 하도급 처리
        (Vercel, Neon, Cloudflare R2, Resend)를 이용합니다. 상세는 개인정보처리방침을 따릅니다.
      </p>
      <h2 className="text-lg font-medium">책임</h2>
      <p>
        고객 확정 코드·승인·확정 지시의 효력은 업체와 고객 사이의 계약 관계에 따르며,
        플랫폼은 기록을 보존하는 도구를 제공할 뿐입니다.
      </p>
    </main>
  );
}

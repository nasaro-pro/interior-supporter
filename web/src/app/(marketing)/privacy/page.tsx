import { messages } from "@/lib/messages";

export default function Page() {
  return (
    <main className="hx-page space-y-5">
      <p className="legal-banner">{messages.legalDraft}</p>
      <h1>개인정보처리방침</h1>
      <p>
        플랫폼은 이름·이메일·연락처, 시공 현장 주소, 현장 사진, 접속 기록을 처리합니다.
        가입 시 국외 이전 동의를 다른 약관과 분리된 체크박스로 받습니다.
      </p>
      <h2 className="text-lg font-medium">국외 이전</h2>
      <div className="-mx-1 overflow-x-auto">
        <table className="hx-table min-w-[48rem]">
          <thead>
            <tr>
              <th>이전받는 자</th>
              <th>이전 국가</th>
              <th>이전 일시·방법</th>
              <th>이전 항목</th>
              <th>이용 목적</th>
              <th>보유 기간</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Vercel Inc.</td>
              <td>미국</td>
              <td>서비스 이용 시 암호화된 네트워크 전송</td>
              <td>계정·요청 로그·화면 데이터</td>
              <td>애플리케이션 호스팅</td>
              <td>서비스 이용 기간 및 로그 정책</td>
            </tr>
            <tr>
              <td>Neon Inc.</td>
              <td>미국</td>
              <td>서비스 이용 시 암호화된 데이터베이스 전송</td>
              <td>계정·프로젝트·감사 로그</td>
              <td>데이터 저장·조회</td>
              <td>이용 기간 및 파기 정책</td>
            </tr>
            <tr>
              <td>Cloudflare, Inc. (R2)</td>
              <td>글로벌</td>
              <td>파일 업로드 시 암호화된 객체 전송</td>
              <td>현장 사진·도면·첨부파일</td>
              <td>파일 저장</td>
              <td>이용 기간 및 파기 정책</td>
            </tr>
            <tr>
              <td>Resend, Inc.</td>
              <td>미국</td>
              <td>알림·인증 메일 발송 시 전송</td>
              <td>이메일 주소·알림 본문</td>
              <td>이메일 발송</td>
              <td>발송 로그 보관 기간</td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>
  );
}

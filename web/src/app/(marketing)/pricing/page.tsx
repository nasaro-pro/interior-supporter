import Link from "next/link";
import { FillBtn } from "@/components/marketing/fill-btn";
import { messages, planTierLabels } from "@/lib/messages";

const TIERS = ["free", "starter", "pro", "enterprise"] as const;

const ROWS: Array<{ label: string; values: [string, string, string, string] }> = [
  { label: "월 요금(제안)", values: ["0원", "79,000원", "179,000원", messages.planNegotiable] },
  { label: "진행 중 프로젝트", values: ["1", "10", messages.planUnlimited, messages.planUnlimited] },
  { label: "PM 계정 수", values: ["1", "2", "5", messages.planUnlimited] },
  { label: "저장공간", values: ["1GB", "20GB", "100GB", messages.planNegotiable] },
  {
    label: "자유 배치형 CMS 편집기",
    values: [messages.planTemplateOnly, messages.planIncluded, messages.planIncluded, messages.planIncluded],
  },
  {
    label: "업체 공통 템플릿 저장",
    values: [messages.planExcluded, messages.planIncluded, messages.planIncluded, messages.planIncluded],
  },
  {
    label: "Before & After 블록",
    values: [messages.planExcluded, messages.planIncluded, messages.planIncluded, messages.planIncluded],
  },
  {
    label: "자재 구매 진행 추적",
    values: [messages.planExcluded, messages.planIncluded, messages.planIncluded, messages.planIncluded],
  },
  {
    label: "승인 워크플로(디자인·자재)",
    values: [messages.planExcluded, messages.planExcluded, messages.planIncluded, messages.planIncluded],
  },
  {
    label: "감사로그 보관 기간",
    values: ["30일", "90일", "1년", messages.planUnlimited],
  },
  {
    label: "화이트라벨(커스텀 도메인·로고)",
    values: [messages.planExcluded, messages.planExcluded, messages.planExcluded, messages.planIncluded],
  },
];

export default function Page() {
  return (
    <main className="hx-page">
      <p className="hx-kicker">{messages.pricingTitle}</p>
      <h1>{messages.pricingTitle}</h1>
      <p className="mb-8 max-w-2xl">{messages.pricingNotice}</p>
      <div className="-mx-1 overflow-x-auto">
        <table className="hx-table min-w-[40rem]">
          <thead>
            <tr>
              <th>{messages.planFeature}</th>
              {TIERS.map((tier) => (
                <th key={tier}>{planTierLabels[tier]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.label}>
                <th className="font-normal">{row.label}</th>
                {row.values.map((value, i) => (
                  <td key={TIERS[i]}>{value}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-8">
        <FillBtn href="/signup">{messages.landingCta}</FillBtn>
      </div>
      <p className="hx-legal mt-6">{messages.pricingFree}</p>
    </main>
  );
}

// src/app/app/[company]/settings/portfolio/page.tsx (A · CR-PF-01) — PM-65 포트폴리오 관리
// 권한 단계에 따라 (lib/access.ts · 설정 › 구성원에서 업체관리자가 정함)
//  전체 관리(대표·관리자 포함): 공개 페이지 설정 + 사례 전체 (대표·순서·동의·공개)
//  사례 올리기: 자기 담당 프로젝트로 초안 사례 만들기·사진 정리·동의 기록 (공개는 전체 관리가)
//  없음: 안내 + 권한 요청 버튼
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { requireCompanyStaff } from '@/features/core';
import { Panel } from '@/features/core/components/summary-blocks';
import { AddWorkSheet } from '@/features/portfolio/components/manage/AddWorkSheet';
import { PortfolioSettingsForm } from '@/features/portfolio/components/manage/PortfolioSettingsForm';
import { PortfolioWorksTable } from '@/features/portfolio/components/manage/PortfolioWorksTable';
import { brandFontClass } from '@/features/portfolio/font';
import { PortfolioAccessRequest } from '@/features/portfolio/components/permission';
import { canEditWork } from '@/features/portfolio/lib/access';
import { loadPortfolioAccess } from '@/features/portfolio/server/access';
import { getPortfolioManage } from '@/features/portfolio/server/manage-queries';

export default async function PortfolioSettingsPage({
  params,
}: {
  params: Promise<{ company: string }>;
}) {
  const { company } = await params;
  const staff = await requireCompanyStaff(company);
  const [access, t] = await Promise.all([
    loadPortfolioAccess(staff.companyId),
    getTranslations('portfolio'),
  ]);
  if (!access) notFound();

  const request = access.isManager ? null : (
    <PortfolioAccessRequest
      companyId={staff.companyId}
      level={access.level}
      pending={access.pendingRequest}
    />
  );

  if (access.level === 'none') {
    return (
      <main data-screen-id="PM-65" className="flex flex-col gap-5">
        <Panel title={t('permission.noneTitle')}>
          <div className="flex flex-col gap-3" data-ui-key="portfolio-access-none">
            <p className="text-sm">{t('permission.noneBody')}</p>
            <ul className="text-muted-foreground text-meta list-disc pl-5">
              <li>{t('permission.worksDesc')}</li>
              <li>{t('permission.fullDesc')}</li>
            </ul>
            {request}
          </div>
        </Panel>
      </main>
    );
  }

  const full = access.level === 'full';
  const data = await getPortfolioManage(staff.companyId, (w) =>
    canEditWork(access.level, w, access.myProjectIds),
  );
  if (!data) notFound();
  const featuredCount = data.works.filter((w) => w.isFeatured).length;
  const addable = full ? data.projects : data.projects.filter((p) => access.myProjectIds.has(p.id));

  return (
    <main data-screen-id="PM-65" className="flex flex-col gap-5">
      {full ? (
        <Panel title={t('manage.pageSection')}>
          {/* 글꼴 견본이 실제 글꼴로 보이게 공개 페이지와 같은 글꼴 변수를 붙인다 */}
          <div className={brandFontClass}>
            <PortfolioSettingsForm
              companyId={staff.companyId}
              slug={data.slug}
              value={data.settings}
              featuredCount={featuredCount}
            />
          </div>
        </Panel>
      ) : (
        <Panel title={t('permission.worksTitle')}>
          <div className="flex flex-col gap-3">
            <p className="text-sm">{t('permission.worksBody')}</p>
            {request}
          </div>
        </Panel>
      )}
      <Panel
        title={t('manage.worksSection')}
        action={
          <AddWorkSheet companyId={staff.companyId} projects={addable} projectRequired={!full} />
        }
      >
        <PortfolioWorksTable
          companyId={staff.companyId}
          works={data.works}
          featuredLimit={data.settings.featuredLimit}
          full={full}
        />
      </Panel>
    </main>
  );
}

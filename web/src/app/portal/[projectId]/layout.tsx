import type { ReactNode } from "react";
import { requireProjectAccess } from "@/lib/authz/portal";
import { findCompanyById } from "@/modules/company";
import { findProjectById } from "@/modules/project";
import { FileImage } from "@/components/portal/file-image";
import { PortalNav } from "@/components/portal/portal-nav";
import { messages } from "@/lib/messages";

export default async function Layout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const ctx = await requireProjectAccess(projectId);
  const [company, project] = await Promise.all([
    findCompanyById(ctx, ctx.companyId),
    findProjectById(ctx, projectId),
  ]);
  const base = `/portal/${projectId}`;
  const tabs = [
    { href: `${base}/home`, label: messages.portalHome },
    { href: `${base}/design`, label: messages.designsTitle },
    { href: `${base}/materials`, label: messages.materialsTitle },
    { href: `${base}/photos`, label: messages.photosTitle },
    { href: `${base}/schedule`, label: messages.scheduleTitle },
    { href: `${base}/estimates`, label: messages.estimatesTitle },
    { href: `${base}/meetings`, label: messages.meetingsTitle },
    { href: `${base}/requests`, label: messages.requestsTitle },
  ];
  return (
    <div>
      <header className="project-subhead atelier-bar px-4 py-4 sm:sticky sm:top-[var(--header-h)] sm:z-20 sm:px-5">
        <div className="mx-auto flex max-w-5xl flex-col gap-4">
          <div className="flex items-center gap-3">
            {company?.brandLogoObjectId ? (
              <FileImage
                objectId={company.brandLogoObjectId}
                alt={company.name}
                className="h-9 w-9 object-cover"
              />
            ) : null}
            <div className="min-w-0">
              <p className="gold-label">{company?.name}</p>
              <p className="mt-1 text-[1.35rem] font-semibold leading-snug sm:text-[1.6rem]">
                {project?.title}
              </p>
            </div>
          </div>
          <PortalNav tabs={tabs} />
        </div>
      </header>
      {children}
    </div>
  );
}

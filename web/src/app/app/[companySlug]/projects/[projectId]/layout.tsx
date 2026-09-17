import Link from "next/link";
import { requireProjectInCompany } from "@/lib/authz";
import { findProjectById } from "@/modules/project";
import { messages } from "@/lib/messages";

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ companySlug: string; projectId: string }>;
}) {
  const { companySlug, projectId } = await params;
  const ctx = await requireProjectInCompany(companySlug, projectId);
  const project = await findProjectById(ctx, projectId);
  const base = `/app/${companySlug}/projects/${projectId}`;
  const tabs = [
    { href: `${base}/overview`, label: messages.overviewTitle },
    { href: `${base}/home-editor`, label: messages.homeEditorTitle },
    { href: `${base}/designs`, label: messages.designsTitle },
    { href: `${base}/materials`, label: messages.materialsTitle },
    { href: `${base}/requests`, label: messages.requestsTitle },
    { href: `${base}/photos`, label: messages.photosTitle },
    { href: `${base}/schedule`, label: messages.scheduleTitle },
    { href: `${base}/estimates`, label: messages.estimatesTitle },
    { href: `${base}/meetings`, label: messages.meetingsTitle },
    { href: `${base}/access`, label: messages.accessTitle },
    { href: `${base}/settings`, label: messages.projectSettingsTitle },
  ];
  return (
    <div>
      <div className="atelier-bar px-5 py-5 sm:px-6">
        <p className="gold-label">{project?.title}</p>
        <h1 className="mt-2 text-[1.6rem] leading-snug sm:text-[1.85rem]">
          {project?.title}
        </h1>
        <nav className="tab-scroll mt-4">
          {tabs.map((tab) => (
            <Link key={tab.href} href={tab.href} className="nav-btn">
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>
      {children}
    </div>
  );
}

import Link from "next/link";
import { requireCustomerSession } from "@/lib/authz/portal";
import { listMyProjects } from "@/modules/access";
import { formatSeoul } from "@/lib/datetime";
import { messages, processLabels } from "@/lib/messages";
import { VISUAL } from "@/lib/visuals";

export default async function Page() {
  const session = await requireCustomerSession();
  const rows = await listMyProjects(session.userId);
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 py-10">
      <div className="photo-banner">
        <img src={VISUAL.lounge} alt={messages.visualAltLounge} />
      </div>
      <div>
        <p className="gold-label">{messages.projectsTitle}</p>
        <h1 className="mt-2 text-[32px]">{messages.projectsTitle}</h1>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{messages.noItems}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map(({ access, project, company }) => (
            <li key={access.id}>
              <Link
                href={`/portal/${project.id}/home`}
                className="paper-card block"
              >
                <p className="text-xl font-semibold">{project.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{company.name}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {project.currentProcess
                    ? processLabels[project.currentProcess]
                    : messages.currentProcessLabel}
                  {" · "}
                  {formatSeoul(project.updatedAt)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

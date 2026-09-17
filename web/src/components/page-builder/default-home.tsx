import { FileImage } from "@/components/portal/file-image";
import { formatSeoul } from "@/lib/datetime";
import { messages, processLabels } from "@/lib/messages";

export function DefaultHome({
  title,
  currentProcess,
  nextTitle,
  nextAt,
  recent,
  photos,
}: {
  title: string;
  currentProcess: string | null;
  nextTitle: string | null;
  nextAt: Date | null;
  recent: Array<{ id: string; title: string; updatedAt: Date }>;
  photos: Array<{ id: string; storageObjectId: string }>;
}) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-5 py-10">
      <section>
        <p className="gold-label">{messages.currentProcessLabel}</p>
        <h1 className="mt-2 text-[40px] leading-tight">{title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {currentProcess ? processLabels[currentProcess as keyof typeof processLabels] : messages.noItems}
        </p>
      </section>
      <section className="grid gap-10 md:grid-cols-2">
        <div>
          <p className="gold-label">{messages.nextSchedule}</p>
          <h2 className="mt-2 text-2xl">{messages.nextSchedule}</h2>
          {nextTitle ? (
            <p className="mt-3 text-sm">
              {nextTitle} · {nextAt ? formatSeoul(nextAt) : ""}
            </p>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">{messages.noPublished}</p>
          )}
        </div>
        <div>
          <p className="gold-label">{messages.recentActivity}</p>
          <h2 className="mt-2 text-2xl">{messages.recentActivity}</h2>
          {recent.length === 0 && photos.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">{messages.noPublished}</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              {recent.map((row) => (
                <li key={row.id}>
                  {row.title} · {formatSeoul(row.updatedAt)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
      {photos.length > 0 ? (
        <section className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {photos.map((photo) => (
            <FileImage
              key={photo.id}
              objectId={photo.storageObjectId}
              alt=""
              className="h-40 w-full object-cover"
            />
          ))}
        </section>
      ) : null}
    </main>
  );
}

import { messages } from "@/lib/messages";

export function VerifyHint({ projectId }: { projectId: string }) {
  return (
    <p className="text-sm text-muted-foreground">
      {messages.verifyHint}{" "}
      <a className="text-link" href={`/portal/${projectId}/verify`}>
        {messages.verifyTitle}
      </a>
    </p>
  );
}

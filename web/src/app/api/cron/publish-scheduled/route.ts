import { withCronAuth } from "@/lib/cron";
import { runPublishScheduled } from "@/lib/cron-jobs";

export const GET = withCronAuth(async () => {
  const result = await runPublishScheduled();
  return Response.json(result);
});

export const POST = GET;

import { withCronAuth } from "@/lib/cron";
import { runNotificationRetry } from "@/lib/cron-jobs";

export const GET = withCronAuth(async () => {
  const result = await runNotificationRetry();
  return Response.json(result);
});

export const POST = GET;

import { withCronAuth } from "@/lib/cron";
import { runRetention } from "@/lib/cron-jobs";

export const GET = withCronAuth(async () => {
  const result = await runRetention();
  return Response.json(result);
});
export const POST = GET;

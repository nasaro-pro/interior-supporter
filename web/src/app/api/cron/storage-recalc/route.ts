import { withCronAuth } from "@/lib/cron";
import { runStorageRecalc } from "@/lib/cron-jobs";

export const GET = withCronAuth(async () => {
  const result = await runStorageRecalc();
  return Response.json(result);
});
export const POST = GET;

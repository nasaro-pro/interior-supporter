export function systemJob(name: string) {
  return { kind: "system" as const, job: name };
}

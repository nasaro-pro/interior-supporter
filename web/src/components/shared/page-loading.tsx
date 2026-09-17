export function PageLoading() {
  return (
    <main className="page-wrap flex flex-col gap-4" aria-busy="true">
      <div className="h-8 w-48 shimmer" />
      <div className="h-48 shimmer" />
      <div className="h-28 shimmer" />
    </main>
  );
}

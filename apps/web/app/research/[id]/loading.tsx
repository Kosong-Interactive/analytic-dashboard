export default function ResearchDetailLoading() {
  return (
    <div className="flex min-h-screen flex-col gap-5 bg-canvas px-4 py-6 sm:px-7" aria-label="Loading research evidence">
      <div className="h-16 animate-pulse rounded-[10px] bg-surface" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => <div key={index} className="h-28 animate-pulse rounded-[10px] bg-surface" />)}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="h-96 animate-pulse rounded-[10px] bg-surface xl:col-span-8" />
        <div className="h-96 animate-pulse rounded-[10px] bg-surface xl:col-span-4" />
      </div>
    </div>
  );
}

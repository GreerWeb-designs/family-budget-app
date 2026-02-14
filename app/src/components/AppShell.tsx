// AppShell.tsx (skeleton)
export default function AppShell({
  sidebar,
  topbar,
  children,
  rightPanel,
}: {
  sidebar: React.ReactNode;
  topbar: React.ReactNode;
  children: React.ReactNode;
  rightPanel?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-100">
      <div className="mx-auto flex max-w-350 gap-4 p-4">
        <aside className="w-64 shrink-0 rounded-2xl border border-zinc-200 bg-white shadow-sm">
          {sidebar}
        </aside>

        <main className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
            {topbar}
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
            {children}
          </div>
        </main>

        {rightPanel && (
          <aside className="hidden w-80 shrink-0 lg:block">
            <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
              {rightPanel}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

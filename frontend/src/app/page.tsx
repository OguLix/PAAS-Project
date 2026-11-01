import { DEPLOYMENT_STATUSES, DEPLOYMENT_STATUS_LABELS } from '@ogulix/shared';

/**
 * Scaffold landing page. It deliberately does not pretend to be a working
 * dashboard: no authentication, application list or deployment view exists yet.
 */
export default function HomePage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-10 px-6 py-16">
      <header className="flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">
          Scaffold milestone
        </p>
        <h1 className="text-3xl font-semibold">OguLix PaaS</h1>
        <p className="text-sm leading-relaxed text-slate-300">
          The repository structure, shared contracts and database schema exist. The dashboard, API
          and worker do not implement product features yet.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
          Agreed stack
        </h2>
        <ul className="grid grid-cols-2 gap-2 text-sm text-slate-300">
          <li>Next.js + TypeScript</li>
          <li>Express.js API</li>
          <li>Node.js worker</li>
          <li>MariaDB + Prisma</li>
          <li>Redis + BullMQ</li>
          <li>Docker Engine / BuildKit</li>
          <li>Traefik ingress</li>
          <li>Cloudflare Tunnel</li>
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
          Deployment statuses (shared contract)
        </h2>
        <div className="flex flex-wrap gap-2">
          {DEPLOYMENT_STATUSES.map((status) => (
            <span
              key={status}
              className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-200"
            >
              {DEPLOYMENT_STATUS_LABELS[status]}
            </span>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-800 pt-4 text-xs text-slate-500">
        Health check: <code className="text-slate-300">GET /api/v1/health</code>. See{' '}
        <code className="text-slate-300">docs/design/decisions.md</code> for locked decisions.
      </footer>
    </main>
  );
}

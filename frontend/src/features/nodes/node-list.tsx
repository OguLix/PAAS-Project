'use client';

import { useCallback, useEffect, useState } from 'react';
import type { RuntimeNodeResponse } from '@ogulix/shared';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { LoadingState } from '@/components/feedback/loading-state';
import { Card, CardContent } from '@/components/ui/card';
import { messageForError } from '@/lib/errors';
import { nodesApi } from '@/services/nodes.api';

export function NodeList() {
  const [nodes, setNodes] = useState<RuntimeNodeResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadNodes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setNodes(await nodesApi.list());
    } catch (requestError) {
      setError(messageForError(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNodes();
  }, [loadNodes]);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-2xl font-semibold text-ink">Runtime nodes</h1>
        <p className="mt-1 text-sm text-muted">
          Last-known capacity and status of registered runtime nodes. Private addresses are never
          exposed here.
        </p>
      </header>

      {loading ? <LoadingState label="Loading runtime nodes" /> : null}
      {!loading && error ? (
        <ErrorState title="Nodes could not be loaded" message={error} onRetry={loadNodes} />
      ) : null}
      {!loading && !error && nodes.length === 0 ? (
        <EmptyState
          title="No runtime nodes registered"
          description="Run the local database seed or register runtime nodes through controlled configuration."
        />
      ) : null}
      {!loading && !error && nodes.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {nodes.map((node) => (
            <Card key={node.id}>
              <CardContent className="flex flex-col gap-3 py-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-display font-semibold text-ink">{node.name}</h2>
                  <span className="rounded-full border border-line bg-subtle px-2.5 py-0.5 text-xs font-semibold text-ink">
                    {node.status}
                  </span>
                </div>
                <dl className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <dt className="text-muted">CPU capacity</dt>
                    <dd className="mt-0.5 font-mono text-sm text-ink">
                      {(node.capacityCpuMillicores / 1000).toFixed(1)} cores
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">Memory capacity</dt>
                    <dd className="mt-0.5 font-mono text-sm text-ink">
                      {node.capacityMemoryMb} MiB
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-muted">Last heartbeat</dt>
                    <dd className="mt-0.5 text-ink">
                      {node.lastHeartbeatAt
                        ? new Date(node.lastHeartbeatAt).toLocaleString()
                        : 'Never'}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}

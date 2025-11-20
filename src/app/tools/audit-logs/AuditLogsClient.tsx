'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Prisma } from '@prisma/client';

interface AuditLog {
  id: string;
  userId: string;
  userEmail: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  description: string;
  metadata: Prisma.JsonValue | null;
  ipAddress: string | null;
  createdAt: string;
}

export default function AuditLogsClient() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/moderator/audit-logs');
      const text = await response.text();
      if (!text) return;
      const data = JSON.parse(text);

      if (data.success) {
        setLogs(data.logs);
      } else {
        toast.error(data.error || 'Failed to fetch audit logs');
      }
    } catch (err) {
      toast.error('An error occurred while fetching audit logs');
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getActionBadgeColor = (action: string) => {
    if (action.includes('APPLIED') || action.includes('APPROVED') || action.includes('CREATED')) {
      return 'bg-accent text-accent-foreground';
    }
    if (action.includes('REJECTED') || action.includes('FAILED') || action.includes('DELETED')) {
      return 'bg-destructive/10 text-destructive';
    }
    if (action.includes('CHANGED') || action.includes('EDITED')) {
      return 'bg-secondary/50 text-secondary-foreground';
    }
    return 'bg-primary/10 text-primary';
  };

  const getResourceTypeBadgeColor = (type: string) => {
    const colors: Record<string, string> = {
      BULK_UPLOAD: 'bg-muted text-muted-foreground',
      COMMUNITY_SUBMISSION: 'bg-primary/10 text-primary',
      PERSON: 'bg-accent text-accent-foreground',
      USER: 'bg-muted text-muted-foreground',
      SYSTEM: 'bg-muted text-muted-foreground',
    };
    return colors[type] || 'bg-accent text-accent-foreground';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Audit Logs</h1>
          <p className="text-muted-foreground mt-2">Recent activity log (last 50 actions)</p>
        </div>
        <Button
          onClick={fetchLogs}
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {loading ? (
        <div className="bg-card rounded-lg border p-8 text-center">
          <div className="text-muted-foreground">Loading audit logs...</div>
        </div>
      ) : logs.length === 0 ? (
        <div className="bg-card rounded-lg border p-8 text-center">
          <div className="text-muted-foreground">No audit logs found</div>
        </div>
      ) : (
        <div className="bg-card rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Timestamp</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Action</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Resource</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Description</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">IP Address</th>
                </tr>
              </thead>
              <tbody className="bg-background divide-y divide-border">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-muted">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">{formatDate(log.createdAt)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm">
                        <div className="font-medium text-foreground">{log.userEmail || 'Unknown'}</div>
                        <div className="text-xs text-muted-foreground">{log.userId.substring(0, 12)}...</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${getActionBadgeColor(log.action)}`}>{log.action.replace(/_/g, ' ')}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <span className={`px-2 py-1 text-xs font-medium rounded inline-block ${getResourceTypeBadgeColor(log.resourceType)}`}>{log.resourceType}</span>
                        {log.resourceId && <span className="text-xs text-muted-foreground">ID: {log.resourceId.substring(0, 8)}...</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">
                      <div className="max-w-md">
                        {log.description}
                        {log.metadata && typeof log.metadata === 'object' && Object.keys(log.metadata as object).length > 0 ? (
                          <details className="mt-1 text-xs text-muted-foreground">
                            <summary className="cursor-pointer hover:text-foreground">View metadata</summary>
                            <pre className="mt-1 p-2 bg-muted rounded overflow-x-auto">{JSON.stringify(log.metadata, null, 2)}</pre>
                          </details>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{log.ipAddress || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}



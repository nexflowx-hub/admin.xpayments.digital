import { redirect } from 'next/navigation';
import { ControlPlaneShell } from '@/components/control-plane-shell';
import { OperationsConsole } from '@/components/operations-console';
import { apiData, asRecord, controlPlaneFetch, type ControlPlaneUser } from '@/lib/control-plane';

export const dynamic = 'force-dynamic';

export default async function OperationsPage() {
  const me = await controlPlaneFetch('/me');
  if (me.status === 401) redirect('/login');
  const row = asRecord(apiData(me.payload).user);
  const user: ControlPlaneUser = {
    id: String(row.id || ''), email: String(row.email || ''),
    name: String(row.name || 'Control Plane'), role: String(row.role || 'INTERNAL'),
    permissions: asRecord(row.permissions) as Record<string, boolean>
  };
  return <ControlPlaneShell active="operations" user={user}><OperationsConsole /></ControlPlaneShell>;
}

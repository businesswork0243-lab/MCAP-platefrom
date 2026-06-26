'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserPlus, Trash2 } from 'lucide-react';

const ROLES = ['admin', 'editor', 'writer', 'reviewer', 'analyst', 'viewer'];

const ROLE_COLORS: Record<string, any> = {
  owner: 'default', admin: 'default', editor: 'secondary',
  writer: 'secondary', reviewer: 'warning', analyst: 'outline', viewer: 'outline',
};

export default function TeamPage() {
  const queryClient = useQueryClient();
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('writer');

  const { data: membersData } = useQuery({
    queryKey: ['team-members'],
    queryFn: () => api.get('/team/members').then((r) => r.data),
  });
  const { data: invitesData } = useQuery({
    queryKey: ['team-invitations'],
    queryFn: () => api.get('/team/invitations').then((r) => r.data),
  });

  const members = membersData?.members ?? [];
  const invitations = invitesData?.invitations ?? [];

  const inviteMutation = useMutation({
    mutationFn: () => api.post('/team/invite', { email: inviteEmail, role: inviteRole }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-invitations'] });
      setShowInvite(false);
      setInviteEmail('');
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/team/members/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['team-members'] }),
  });

  const roleChangeMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      api.patch(`/team/members/${id}/role`, { role }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['team-members'] }),
  });

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Team</h1>
        <Button onClick={() => setShowInvite(true)}>
          <UserPlus className="w-4 h-4" /> Invite Member
        </Button>
      </div>

      {showInvite && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Invite Team Member</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-3">
              <Input className="flex-1" type="email" placeholder="colleague@company.com"
                value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
              <select
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}
              >
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => inviteMutation.mutate()} loading={inviteMutation.isPending} disabled={!inviteEmail}>
                Send Invite
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowInvite(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Members table */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Members ({members.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="divide-y">
            {members.map((m: any) => (
              <div key={m.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <span className="text-xs font-semibold text-primary">{m.name?.charAt(0).toUpperCase()}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium">{m.name}</p>
                    <p className="text-xs text-muted-foreground">{m.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <select
                    className="h-7 text-xs rounded border border-input bg-transparent px-2 focus-visible:outline-none"
                    value={m.role}
                    onChange={(e) => roleChangeMutation.mutate({ id: m.id, role: e.target.value })}
                    disabled={m.role === 'owner'}
                  >
                    {['owner', ...ROLES].map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                  {m.role !== 'owner' && (
                    <button onClick={() => removeMutation.mutate(m.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Pending invites */}
      {invitations.filter((i: any) => i.status === 'pending').length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Pending Invitations</CardTitle></CardHeader>
          <CardContent>
            <div className="divide-y">
              {invitations.filter((i: any) => i.status === 'pending').map((inv: any) => (
                <div key={inv.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">{inv.email}</p>
                    <p className="text-xs text-muted-foreground">Invited as {inv.role}</p>
                  </div>
                  <Badge variant="warning">Pending</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Role permissions table */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Role Permissions</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 text-muted-foreground font-medium">Feature</th>
                  {['Owner', 'Admin', 'Editor', 'Writer', 'Reviewer', 'Viewer'].map((r) => (
                    <th key={r} className="text-center py-2 px-2 text-muted-foreground font-medium">{r}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { feature: 'Generate', perms: [true, true, true, true, false, false] },
                  { feature: 'Edit', perms: [true, true, true, true, false, false] },
                  { feature: 'Approve', perms: [true, true, true, false, true, false] },
                  { feature: 'Publish', perms: [true, true, true, false, false, false] },
                  { feature: 'Brand Edit', perms: [true, true, false, false, false, false] },
                  { feature: 'Billing', perms: [true, true, false, false, false, false] },
                ].map(({ feature, perms }) => (
                  <tr key={feature} className="border-b last:border-0">
                    <td className="py-2 pr-4 text-muted-foreground">{feature}</td>
                    {perms.map((p, i) => (
                      <td key={i} className="text-center py-2 px-2">
                        {p ? <span className="text-green-600">✓</span> : <span className="text-muted-foreground">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

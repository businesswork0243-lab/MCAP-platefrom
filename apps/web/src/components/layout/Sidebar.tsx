'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth';
import {
  LayoutDashboard, PenSquare, FolderOpen, FileText,
  Palette, BarChart3, Settings, Users, LogOut, Sparkles
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/content/new', label: 'New Content', icon: PenSquare },
  { href: '/projects', label: 'Projects', icon: FolderOpen },
  { href: '/templates', label: 'Templates', icon: FileText },
  { href: '/brand', label: 'Brand Profiles', icon: Palette },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/team', label: 'Team', icon: Users },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();

  return (
    <aside className="w-60 shrink-0 h-screen border-r bg-card flex flex-col">
      {/* Logo */}
      <div className="h-14 flex items-center gap-2 px-4 border-b">
        <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <span className="font-bold text-base tracking-tight">MCAP</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                active
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="border-t p-3">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <span className="text-xs font-semibold text-primary">
              {user?.name?.charAt(0).toUpperCase() ?? 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.role}</p>
          </div>
          <button
            onClick={logout}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

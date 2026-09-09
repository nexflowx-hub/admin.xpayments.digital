import Link from 'next/link';
import {
  Activity,
  BadgeDollarSign,
  Boxes,
  Building2,
  ChevronRight,
  CircleDollarSign,
  Cpu,
  FileClock,
  LogOut,
  Network,
  ReceiptText,
  ShieldCheck,
  Store,
  UsersRound,
  WalletCards,
  Workflow
} from 'lucide-react';
import type { ControlPlaneUser } from '@/lib/control-plane';

const NAV = [
  { href: '/overview', label: 'Command Center', key: 'overview', icon: Activity },
  { href: '/merchants', label: 'Merchants', key: 'merchants', icon: Building2 },
  { href: '/stores', label: 'Stores', key: 'stores', icon: Store },
  { href: '/transactions', label: 'Transactions', key: 'transactions', icon: ReceiptText },
  { href: '/processing', label: 'Processing', key: 'processing', icon: Network },
  { href: '/gateways', label: 'Gateway Vaults', key: 'gateways', icon: ShieldCheck },
  { href: '/fees', label: 'Fees & Tiers', key: 'fees', icon: BadgeDollarSign },
  { href: '/payouts', label: 'Finance & Payouts', key: 'payouts', icon: WalletCards },
  { href: '/expert', label: 'XPay Expert', key: 'expert', icon: Workflow },
  { href: '/users', label: 'Actors & Access', key: 'users', icon: UsersRound },
  { href: '/audit', label: 'Audit & Security', key: 'audit', icon: FileClock }
];

export function ControlPlaneShell({
  active,
  user,
  children
}: {
  active: string;
  user: ControlPlaneUser;
  children: React.ReactNode;
}) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark"><span>X</span></div>
          <div>
            <strong>XPAYMENTS</strong>
            <small>Control Plane</small>
          </div>
        </div>

        <div className="environment-chip"><span className="status-dot" />PRODUCTION</div>

        <nav className="sidebar-nav" aria-label="Control Plane">
          {NAV.map((item) => {
            const Icon = item.icon;
            const selected = active === item.key;
            return (
              <Link href={item.href} key={item.key} className={selected ? 'nav-link active' : 'nav-link'}>
                <Icon size={18} />
                <span>{item.label}</span>
                {selected ? <ChevronRight className="nav-arrow" size={15} /> : null}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-system-card">
          <div className="system-icon"><Cpu size={18} /></div>
          <div><strong>Engine 3.1</strong><small>API · ONLINE</small></div>
          <span className="status-dot" />
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <div className="mobile-brand"><div className="brand-mark"><span>X</span></div><strong>XPAYMENTS</strong></div>
          <div className="topbar-context">
            <CircleDollarSign size={17} />
            <span>Internal Operations</span>
            <span className="topbar-separator">/</span>
            <span className="muted">Read-only foundation</span>
          </div>
          <div className="topbar-user">
            <div className="user-avatar">{initials(user.name)}</div>
            <div className="user-copy"><strong>{user.name}</strong><small>{user.role}</small></div>
            <form action="/api/session/logout" method="post">
              <button className="icon-button" type="submit" title="Terminar sessão" aria-label="Terminar sessão"><LogOut size={17} /></button>
            </form>
          </div>
        </header>

        <div className="mobile-nav">
          {NAV.map((item) => {
            const Icon = item.icon;
            return <Link key={item.key} href={item.href} className={active === item.key ? 'mobile-nav-link active' : 'mobile-nav-link'}><Icon size={15} />{item.label}</Link>;
          })}
        </div>

        <main className="content-area">{children}</main>
      </div>
    </div>
  );
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'CP';
}

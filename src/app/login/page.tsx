import { Activity, Database, ShieldCheck, Workflow } from 'lucide-react';
import { LoginForm } from './login-form';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return (
    <main className="login-page">
      <div className="login-ambient login-ambient-a" />
      <div className="login-ambient login-ambient-b" />

      <section className="login-brand-panel">
        <div className="brand-mark large"><span>X</span></div>
        <div className="eyebrow">XPAYMENTS · INTERNAL SYSTEM</div>
        <h1>Control Plane</h1>
        <p className="login-lead">Operações, processamento, finanças e infraestrutura Merchant numa única superfície administrativa.</p>

        <div className="login-capabilities">
          <div><Activity size={20} /><span><strong>Command Center</strong><small>Atividade e operação em tempo real</small></span></div>
          <div><Database size={20} /><span><strong>Merchant 360°</strong><small>Stores, wallets, transactions e payouts</small></span></div>
          <div><Workflow size={20} /><span><strong>Processing</strong><small>Providers, connections e Gateway Vaults</small></span></div>
          <div><ShieldCheck size={20} /><span><strong>RBAC & Audit</strong><small>Sessões revogáveis e trilho administrativo</small></span></div>
        </div>
      </section>

      <section className="login-card-wrap">
        <div className="login-card">
          <div className="login-card-heading">
            <span className="status-dot" />
            <span>Production Control Plane</span>
          </div>
          <h2>Acesso interno</h2>
          <p>Utilize as credenciais administrativas XPAYMENTS.</p>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}

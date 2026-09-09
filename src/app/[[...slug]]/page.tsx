import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  BadgeDollarSign,
  Building2,
  CircleAlert,
  CircleCheckBig,
  CreditCard,
  Database,
  Landmark,
  Network,
  ReceiptText,
  Search,
  ServerCog,
  ShieldCheck,
  Store,
  UsersRound,
  WalletCards,
  Workflow
} from 'lucide-react';
import { ControlPlaneShell } from '@/components/control-plane-shell';
import {
  apiData,
  asArray,
  asRecord,
  controlPlaneFetch,
  type ControlPlaneUser,
  type ControlPlaneResult
} from '@/lib/control-plane';

export const dynamic = 'force-dynamic';

type Row = Record<string, unknown>;
type SearchParams = Record<string, string | string[] | undefined>;

type Column = {
  label: string;
  render: (row: Row) => ReactNode;
  className?: string;
};

const SECTION_TITLES: Record<string, [string, string]> = {
  overview: ['Command Center', 'Visão consolidada da plataforma e dos motores operacionais.'],
  merchants: ['Merchants', 'Acompanhamento 360° de contas, atividade, processing e XPay Expert.'],
  stores: ['Stores', 'Estado operacional, routing, processing profiles, fees e volume.'],
  transactions: ['Transactions', 'Pesquisa global cross-Merchant sobre atividade transacional.'],
  processing: ['Processing', 'Provider Accounts e Provider Connections da infraestrutura de pagamentos.'],
  gateways: ['Gateway Vaults', 'Inventário seguro dos cofres lógicos. Credenciais nunca são devolvidas pelo Control Plane.'],
  fees: ['Fees & Tiers', 'Configuração vigente por Store e base para evolução de tiers e overrides.'],
  payouts: ['Finance & Payouts', 'Pedidos de payout, estados operacionais e referências financeiras.'],
  expert: ['XPay Expert', 'Contratações, pagamentos e progresso das estruturas XPay.Expert.'],
  users: ['Actors & Access', 'Utilizadores internos, roles, permissões e sessões ativas.'],
  audit: ['Audit & Security', 'Trilho administrativo de login, configuração e operações internas.']
};

export default async function ControlPlanePage({
  params,
  searchParams
}: {
  params: Promise<{ slug?: string[] }>;
  searchParams: Promise<SearchParams>;
}) {
  const { slug = [] } = await params;
  const query = await searchParams;
  const section = slug[0] || 'overview';

  if (!SECTION_TITLES[section]) redirect('/overview');

  const me = await load('/me');
  const userRow = asRecord(apiData(me.payload).user);
  const user: ControlPlaneUser = {
    id: str(userRow.id),
    email: str(userRow.email),
    name: str(userRow.name) || 'Control Plane',
    role: str(userRow.role) || 'INTERNAL',
    permissions: asRecord(userRow.permissions) as Record<string, boolean>
  };

  let content: ReactNode;
  if (section === 'merchants' && slug[1]) {
    content = await renderMerchantDetail(slug[1]);
  } else {
    content = await renderSection(section, query);
  }

  return <ControlPlaneShell active={section} user={user}>{content}</ControlPlaneShell>;
}

async function load(path: string): Promise<ControlPlaneResult> {
  const result = await controlPlaneFetch(path);
  if (result.status === 401) redirect('/login');
  return result;
}

async function renderSection(section: string, query: SearchParams) {
  const [title, subtitle] = SECTION_TITLES[section];
  const q = param(query.q);

  if (section === 'overview') {
    const result = await load('/overview');
    if (!result.ok) return <SectionError title={title} status={result.status} />;
    const data = apiData(result.payload);
    const platform = asRecord(data.platform);
    const wallets = asArray(data.wallets);
    const storeStatus = asArray(data.storeStatus);
    const connections = asArray(data.providerConnections);
    const expert = asArray(data.expert);

    const totalStores = number(platform.stores);
    const activeStores = number(platform.active_stores);
    const providerConnections = number(platform.provider_connections);
    const activeProviderConnections = number(platform.active_provider_connections);

    return (
      <>
        <PageHeading title={title} subtitle={subtitle} badge="LIVE DATA" />
        <div className="metric-grid">
          <MetricCard icon={<Building2 />} label="Merchants" value={formatNumber(platform.merchants)} detail={`${formatNumber(platform.active_merchants)} ativos`} />
          <MetricCard icon={<Store />} label="Stores" value={formatNumber(totalStores)} detail={`${formatNumber(activeStores)} ativas`} tone="blue" />
          <MetricCard icon={<ReceiptText />} label="Transactions" value={formatNumber(platform.transactions)} detail={formatMoney(platform.gross_amount_eur, 'EUR') + ' volume EUR'} tone="violet" />
          <MetricCard icon={<Network />} label="Provider Connections" value={formatNumber(providerConnections)} detail={`${formatNumber(activeProviderConnections)} ativas`} tone="green" />
          <MetricCard icon={<ShieldCheck />} label="Gateway Vaults" value={formatNumber(platform.gateway_vaults)} detail="credenciais redigidas" />
          <MetricCard icon={<WalletCards />} label="Payout Requests" value={formatNumber(platform.open_payout_requests)} detail="em aberto" tone="amber" />
          <MetricCard icon={<Workflow />} label="XPay Expert" value={formatNumber(platform.open_expert_orders)} detail="orders em aberto" tone="violet" />
          <MetricCard icon={<ServerCog />} label="Provider Accounts" value={formatNumber(platform.provider_accounts)} detail="contas configuradas" tone="blue" />
        </div>

        <div className="dashboard-grid two-one">
          <Panel title="Wallet exposure" subtitle="Saldos agregados por moeda" icon={<WalletCards size={18} />}>
            <div className="wallet-grid">
              {wallets.map((wallet, index) => (
                <div className="wallet-card" key={`${str(wallet.currency)}-${index}`}>
                  <div><span>{str(wallet.currency)}</span><small>{str(wallet.currency) === 'USDT' ? 'Crypto' : 'Fiat'}</small></div>
                  <strong>{formatMoney(wallet.balance, str(wallet.currency) || 'EUR')}</strong>
                  <div className="wallet-lines"><span>Available <b>{formatMoney(wallet.available, str(wallet.currency) || 'EUR')}</b></span><span>Reserved <b>{formatMoney(wallet.reserved, str(wallet.currency) || 'EUR')}</b></span><span>Hold <b>{formatMoney(wallet.reconciliation_hold, str(wallet.currency) || 'EUR')}</b></span></div>
                </div>
              ))}
              {!wallets.length ? <EmptyState text="Sem wallets agregadas." /> : null}
            </div>
          </Panel>

          <Panel title="Store health" subtitle="Distribuição por estado" icon={<Store size={18} />}>
            <StatusBreakdown rows={storeStatus} total={totalStores} labelKey="status" />
          </Panel>
        </div>

        <div className="dashboard-grid half-half">
          <Panel title="Processing modes" subtitle="Provider Connections por modo / estado" icon={<Network size={18} />}>
            <div className="stack-list">
              {connections.map((row, index) => <CompactStat key={index} label={`${str(row.mode) || 'UNSET'} · ${str(row.status) || 'unknown'}`} value={number(row.count)} />)}
              {!connections.length ? <EmptyState text="Sem Provider Connections." /> : null}
            </div>
          </Panel>
          <Panel title="XPay Expert pipeline" subtitle="Orders por fase / pagamento" icon={<Workflow size={18} />}>
            <div className="stack-list">
              {expert.map((row, index) => <CompactStat key={index} label={`${str(row.status)} · ${str(row.payment_status)}`} value={number(row.count)} />)}
              {!expert.length ? <EmptyState text="Sem orders XPay.Expert." /> : null}
            </div>
          </Panel>
        </div>
      </>
    );
  }

  if (section === 'merchants') {
    const result = await load(`/merchants?limit=100${q ? `&search=${encodeURIComponent(q)}` : ''}`);
    const data = apiData(result.payload);
    const rows = asArray(data.merchants);
    return <><PageHeading title={title} subtitle={subtitle} badge={`${formatNumber(data.total)} TOTAL`} /><SearchBox placeholder="Nome, email, empresa ou Merchant ID" value={q} /><DataPanel rows={rows} empty="Nenhum Merchant encontrado." columns={[
      { label: 'Merchant', render: (r) => <EntityLink href={`/merchants/${str(r.id)}`} primary={str(r.name)} secondary={str(r.email)} /> },
      { label: 'Company', render: (r) => str(r.company) || '—' },
      { label: 'Tier', render: (r) => <Pill value={str(r.tier)} /> },
      { label: 'Status', render: (r) => <Pill value={str(r.status)} /> },
      { label: 'Stores', render: (r) => <StrongNumber value={r.active_stores} suffix={` / ${formatNumber(r.stores)}`} /> },
      { label: 'Transactions', render: (r) => formatNumber(r.transactions), className: 'numeric' },
      { label: 'Volume EUR', render: (r) => formatMoney(r.volume_eur, 'EUR'), className: 'numeric' },
      { label: 'Processing', render: (r) => `${formatNumber(r.active_provider_connections)} active` },
      { label: 'Expert', render: (r) => formatNumber(r.expert_orders), className: 'numeric' }
    ]} /></>;
  }

  if (section === 'stores') {
    const result = await load(`/stores?limit=150${q ? `&search=${encodeURIComponent(q)}` : ''}`);
    const rows = asArray(apiData(result.payload).stores);
    return <><PageHeading title={title} subtitle={subtitle} badge={`${rows.length} LOADED`} /><SearchBox placeholder="Store, código ou Merchant" value={q} /><DataPanel rows={rows} empty="Nenhuma Store encontrada." columns={[
      { label: 'Store', render: (r) => <EntityLink href={`/merchants/${str(r.merchant_id)}`} primary={str(r.name)} secondary={str(r.store_code)} /> },
      { label: 'Merchant', render: (r) => str(r.merchant_name) },
      { label: 'Currency', render: (r) => <Pill value={str(r.currency)} /> },
      { label: 'Status', render: (r) => <Pill value={str(r.status)} /> },
      { label: 'Activation', render: (r) => str(r.activation_state) || '—' },
      { label: 'Processing', render: (r) => <span>{str(r.provider_alias) || '—'}<small className="cell-sub">{str(r.provider_mode)}</small></span> },
      { label: 'Fee', render: (r) => formatFee(r) },
      { label: 'Tx', render: (r) => formatNumber(r.transactions), className: 'numeric' },
      { label: 'Volume EUR', render: (r) => formatMoney(r.volume_eur, 'EUR'), className: 'numeric' }
    ]} /></>;
  }

  if (section === 'transactions') {
    const result = await load(`/transactions?limit=150${q ? `&search=${encodeURIComponent(q)}` : ''}`);
    const rows = asArray(apiData(result.payload).transactions);
    return <><PageHeading title={title} subtitle={subtitle} badge={`${rows.length} RECENT`} /><SearchBox placeholder="Reference, customer email ou provider payment ID" value={q} /><DataPanel rows={rows} empty="Nenhuma Transaction encontrada." columns={[
      { label: 'Reference', render: (r) => <span className="mono">{str(r.reference)}</span> },
      { label: 'Merchant / Store', render: (r) => <EntityLink href={`/merchants/${str(r.merchant_id)}`} primary={str(r.merchant_name)} secondary={str(r.store_code) || str(r.store_name)} /> },
      { label: 'Amount', render: (r) => <strong>{formatMoney(r.amount, str(r.currency) || 'EUR')}</strong>, className: 'numeric' },
      { label: 'EUR', render: (r) => formatMoney(r.amount_eur, 'EUR'), className: 'numeric' },
      { label: 'Status', render: (r) => <Pill value={str(r.status)} /> },
      { label: 'Method', render: (r) => str(r.method) || '—' },
      { label: 'Gateway', render: (r) => str(r.gateway) || '—' },
      { label: 'Provider ID', render: (r) => <span className="mono compact">{str(r.provider_payment_id) || '—'}</span> },
      { label: 'Created', render: (r) => formatDate(r.created_at) }
    ]} /></>;
  }

  if (section === 'processing') {
    const [accountsResult, connectionsResult] = await Promise.all([
      load('/processing/provider-accounts'),
      load('/processing/provider-connections')
    ]);
    const accounts = asArray(apiData(accountsResult.payload).providerAccounts);
    const connections = asArray(apiData(connectionsResult.payload).providerConnections);
    return <><PageHeading title={title} subtitle={subtitle} badge="INFRASTRUCTURE" />
      <Panel title="Provider Accounts" subtitle={`${accounts.length} physical / logical provider accounts`} icon={<ServerCog size={18} />}>
        <DataTable rows={accounts} columns={[
          { label: 'Provider', render: (r) => <strong>{str(r.provider)}</strong> },
          { label: 'External Account', render: (r) => <span className="mono compact">{str(r.external_account_id)}</span> },
          { label: 'Environment', render: (r) => <Pill value={str(r.environment)} /> },
          { label: 'Country', render: (r) => str(r.country) || '—' },
          { label: 'Currency', render: (r) => str(r.default_currency) || '—' },
          { label: 'Status', render: (r) => <Pill value={str(r.status)} /> },
          { label: 'Connections', render: (r) => <StrongNumber value={r.active_connections} suffix={` / ${formatNumber(r.connections)}`} /> }
        ]} />
      </Panel>
      <div className="section-spacer" />
      <Panel title="Provider Connections" subtitle={`${connections.length} routing connections`} icon={<Network size={18} />}>
        <DataTable rows={connections} columns={[
          { label: 'Alias', render: (r) => <span><strong>{str(r.alias) || '—'}</strong><small className="cell-sub">{str(r.provider)}</small></span> },
          { label: 'Merchant', render: (r) => <EntityLink href={`/merchants/${str(r.merchant_id)}`} primary={str(r.merchant_name)} secondary={str(r.store_code)} /> },
          { label: 'Mode', render: (r) => <Pill value={str(r.mode)} /> },
          { label: 'Credential', render: (r) => str(r.credential_mode) || '—' },
          { label: 'Capture', render: (r) => str(r.capture_policy) || '—' },
          { label: 'Status', render: (r) => <Pill value={str(r.status)} /> },
          { label: 'Shadow', render: (r) => boolLabel(r.shadow_mode) },
          { label: 'Ledger', render: (r) => boolLabel(r.ledger_enabled) }
        ]} />
      </Panel>
    </>;
  }

  if (section === 'gateways') {
    const result = await load('/processing/vaults');
    const data = apiData(result.payload);
    const rows = asArray(data.gatewayVaults);
    return <><PageHeading title={title} subtitle={subtitle} badge={`${rows.length} VAULTS`} />
      <div className="security-banner"><ShieldCheck size={19} /><div><strong>Credential redaction enforced</strong><span>A API administrativa devolve apenas nomes de campos e metadata segura — nunca secrets, keys ou webhook secrets.</span></div></div>
      <DataPanel rows={rows} empty="Nenhum GatewayVault encontrado." columns={[
        { label: 'Provider', render: (r) => <strong>{str(r.provider)}</strong> },
        { label: 'Merchant', render: (r) => <EntityLink href={`/merchants/${str(r.merchant_id)}`} primary={str(r.merchant_name)} secondary={str(r.store_code) || 'Merchant-level'} /> },
        { label: 'Store', render: (r) => str(r.store_name) || 'Merchant level' },
        { label: 'Active', render: (r) => <Pill value={truthy(r.is_active) ? 'ACTIVE' : 'INACTIVE'} /> },
        { label: 'Configured', render: (r) => truthy(r.credentials_configured) ? <span className="yes">Yes</span> : <span className="no">No</span> },
        { label: 'Credential fields', render: (r) => <span className="field-list">{asTextArray(r.credential_fields).slice(0, 5).join(' · ') || '—'}</span> },
        { label: 'Created', render: (r) => formatDate(r.created_at) }
      ]} />
    </>;
  }

  if (section === 'fees') {
    const result = await load('/fees');
    const rows = asArray(apiData(result.payload).feeConfigs);
    return <><PageHeading title={title} subtitle={subtitle} badge={`${rows.length} CONFIGS`} />
      <div className="info-banner"><BadgeDollarSign size={19} /><div><strong>Fee engine already modeled per Store</strong><span>Esta V1 apresenta a configuração vigente. Edição versionada e tiers serão a próxima camada write-enabled.</span></div></div>
      <DataPanel rows={rows} empty="Nenhuma configuração de fee." columns={[
        { label: 'Merchant / Store', render: (r) => <EntityLink href={`/merchants/${str(r.merchant_id)}`} primary={str(r.merchant_name)} secondary={str(r.store_code)} /> },
        { label: 'Currency', render: (r) => <Pill value={str(r.currency)} /> },
        { label: 'Basis', render: (r) => str(r.fee_basis) },
        { label: 'Percent', render: (r) => `${(number(r.fee_percent_bps) / 100).toFixed(2)}%`, className: 'numeric' },
        { label: 'Fixed', render: (r) => formatMinor(r.fee_fixed_minor, str(r.currency)), className: 'numeric' },
        { label: 'Min / Max', render: (r) => `${formatMinor(r.min_fee_minor, str(r.currency))} / ${r.max_fee_minor == null ? '—' : formatMinor(r.max_fee_minor, str(r.currency))}` },
        { label: 'Active', render: (r) => <Pill value={truthy(r.active) ? 'ACTIVE' : 'INACTIVE'} /> },
        { label: 'Effective', render: (r) => formatDate(r.effective_from) }
      ]} />
    </>;
  }

  if (section === 'payouts') {
    const result = await load('/payouts?limit=150');
    const rows = asArray(apiData(result.payload).payoutRequests);
    return <><PageHeading title={title} subtitle={subtitle} badge={`${rows.length} REQUESTS`} /><DataPanel rows={rows} empty="Nenhum payout request." columns={[
      { label: 'Request', render: (r) => <span className="mono">{str(r.request_code)}</span> },
      { label: 'Merchant / Store', render: (r) => <EntityLink href={`/merchants/${str(r.merchant_id)}`} primary={str(r.merchant_name)} secondary={str(r.store_code)} /> },
      { label: 'Amount', render: (r) => <strong>{formatMoney(r.requested_amount, str(r.currency))}</strong>, className: 'numeric' },
      { label: 'Status', render: (r) => <Pill value={str(r.status)} /> },
      { label: 'External Ref', render: (r) => str(r.external_reference) || '—' },
      { label: 'Requested', render: (r) => formatDate(r.requested_at || r.created_at) },
      { label: 'Confirmed', render: (r) => formatDate(r.confirmed_at) }
    ]} /></>;
  }

  if (section === 'expert') {
    const result = await load(`/expert/orders?limit=150${q ? `&search=${encodeURIComponent(q)}` : ''}`);
    const rows = asArray(apiData(result.payload).orders);
    return <><PageHeading title={title} subtitle={subtitle} badge={`${rows.length} ORDERS`} /><SearchBox placeholder="Order, Merchant, email ou serviço" value={q} /><DataPanel rows={rows} empty="Nenhuma contratação XPay.Expert." columns={[
      { label: 'Order', render: (r) => <span><strong className="mono">{str(r.order_code)}</strong><small className="cell-sub">{str(r.offering_name)}</small></span> },
      { label: 'Merchant', render: (r) => <EntityLink href={`/merchants/${str(r.merchant_id)}`} primary={str(r.merchant_name)} secondary={str(r.merchant_email)} /> },
      { label: 'Payment', render: (r) => <span><Pill value={str(r.payment_status)} /><small className="cell-sub">{formatMoney(r.payment_amount, str(r.payment_currency))}</small></span> },
      { label: 'Workflow', render: (r) => <span><Pill value={str(r.status)} /><small className="cell-sub">{str(r.current_step_label) || str(r.current_step)}</small></span> },
      { label: 'Progress', render: (r) => <Progress value={number(r.progress)} /> },
      { label: 'Requirements', render: (r) => `${formatNumber(r.approved_requirements)} / ${formatNumber(r.requirements)}` },
      { label: 'Docs / Proofs', render: (r) => `${formatNumber(r.documents)} / ${formatNumber(r.payment_proofs)}` },
      { label: 'Owner', render: (r) => str(r.assigned_to) || 'Unassigned' },
      { label: 'Created', render: (r) => formatDate(r.created_at) }
    ]} /></>;
  }

  if (section === 'users') {
    const result = await load('/users');
    const rows = asArray(apiData(result.payload).users);
    return <><PageHeading title={title} subtitle={subtitle} badge={`${rows.length} ACTORS`} /><DataPanel rows={rows} empty="Nenhum utilizador interno." columns={[
      { label: 'Actor', render: (r) => <span><strong>{str(r.name)}</strong><small className="cell-sub">{str(r.email)}</small></span> },
      { label: 'Role', render: (r) => <Pill value={str(r.role)} /> },
      { label: 'Status', render: (r) => <Pill value={str(r.status)} /> },
      { label: 'Active sessions', render: (r) => formatNumber(r.active_sessions), className: 'numeric' },
      { label: 'Last login', render: (r) => formatDate(r.last_login_at) },
      { label: 'Created', render: (r) => formatDate(r.created_at) }
    ]} /></>;
  }

  const result = await load('/audit?limit=200');
  const rows = asArray(apiData(result.payload).audit);
  return <><PageHeading title={title} subtitle={subtitle} badge={`${rows.length} EVENTS`} /><DataPanel rows={rows} empty="Audit log vazio." columns={[
    { label: 'Action', render: (r) => <strong className="mono compact">{str(r.action)}</strong> },
    { label: 'Actor', render: (r) => <span>{str(r.actor_name) || 'System'}<small className="cell-sub">{str(r.actor_email) || str(r.actor_role)}</small></span> },
    { label: 'Entity', render: (r) => <span>{str(r.entity_type)}<small className="cell-sub mono compact">{str(r.entity_id)}</small></span> },
    { label: 'IP', render: (r) => <span className="mono compact">{str(r.ip_address) || '—'}</span> },
    { label: 'Created', render: (r) => formatDate(r.created_at) }
  ]} /></>;
}

async function renderMerchantDetail(id: string) {
  const result = await load(`/merchants/${encodeURIComponent(id)}`);
  if (!result.ok) return <SectionError title="Merchant 360°" status={result.status} />;
  const data = apiData(result.payload);
  const merchant = asRecord(data.merchant);
  const wallets = asArray(data.wallets);
  const stores = asArray(data.stores);
  const connections = asArray(data.providerConnections);
  const payouts = asArray(data.payouts);
  const expertOrders = asArray(data.expertOrders);
  const transactions = asArray(data.recentTransactions);

  return <>
    <div className="back-row"><Link href="/merchants"><ArrowLeft size={16} />Voltar a Merchants</Link></div>
    <PageHeading title={str(merchant.name) || 'Merchant'} subtitle={`${str(merchant.company) || 'Merchant account'} · ${str(merchant.email)}`} badge="MERCHANT 360°" />
    <div className="metric-grid merchant-metrics">
      <MetricCard icon={<Building2 />} label="Tier" value={str(merchant.tier) || '—'} detail={`Status ${str(merchant.status)}`} />
      <MetricCard icon={<ShieldCheck />} label="Risk score" value={formatNumber(merchant.risk_score)} detail={`KYC ${str(merchant.kyc_status) || '—'}`} tone="amber" />
      <MetricCard icon={<Store />} label="Stores" value={String(stores.length)} detail={`${stores.filter((r) => str(r.status) === 'active').length} ativas`} tone="blue" />
      <MetricCard icon={<Network />} label="Connections" value={String(connections.length)} detail={`${connections.filter((r) => str(r.status) === 'active').length} ativas`} tone="green" />
    </div>

    <Panel title="Wallets" subtitle="Posição financeira do Merchant" icon={<WalletCards size={18} />}>
      <DataTable rows={wallets} columns={[
        { label: 'Wallet', render: (r) => <span><strong>{str(r.label)}</strong><small className="cell-sub">{str(r.type)}</small></span> },
        { label: 'Currency', render: (r) => <Pill value={str(r.currency)} /> },
        { label: 'Balance', render: (r) => formatMoney(r.balance, str(r.currency)), className: 'numeric' },
        { label: 'Available', render: (r) => <strong>{formatMoney(r.available, str(r.currency))}</strong>, className: 'numeric' },
        { label: 'Reserved', render: (r) => formatMoney(r.reserved, str(r.currency)), className: 'numeric' },
        { label: 'Recon hold', render: (r) => formatMoney(r.reconciliation_hold, str(r.currency)), className: 'numeric' }
      ]} />
    </Panel>
    <div className="section-spacer" />
    <Panel title="Stores & processing" subtitle="Store processing profile e fee vigente" icon={<Store size={18} />}>
      <DataTable rows={stores} columns={[
        { label: 'Store', render: (r) => <span><strong>{str(r.name)}</strong><small className="cell-sub">{str(r.store_code)}</small></span> },
        { label: 'Currency', render: (r) => <Pill value={str(r.currency)} /> },
        { label: 'Status', render: (r) => <Pill value={str(r.status)} /> },
        { label: 'Activation', render: (r) => str(r.activation_state) || '—' },
        { label: 'Provider', render: (r) => <span>{str(r.provider_alias) || '—'}<small className="cell-sub">{str(r.provider_mode)}</small></span> },
        { label: 'Shadow / Ledger', render: (r) => `${boolLabel(r.shadow_mode)} / ${boolLabel(r.ledger_enabled)}` },
        { label: 'Fee', render: (r) => formatFee(r) }
      ]} />
    </Panel>
    <div className="section-spacer" />
    <div className="dashboard-grid half-half">
      <Panel title="Recent transactions" subtitle="Últimas 50" icon={<CreditCard size={18} />}>
        <DataTable rows={transactions} compact columns={[
          { label: 'Reference', render: (r) => <span className="mono compact">{str(r.reference)}</span> },
          { label: 'Amount', render: (r) => formatMoney(r.amount, str(r.currency)), className: 'numeric' },
          { label: 'Status', render: (r) => <Pill value={str(r.status)} /> },
          { label: 'Date', render: (r) => formatDate(r.created_at) }
        ]} />
      </Panel>
      <Panel title="XPay Expert" subtitle="Contratações deste Merchant" icon={<Workflow size={18} />}>
        <DataTable rows={expertOrders} compact columns={[
          { label: 'Order', render: (r) => <span><strong className="mono compact">{str(r.order_code)}</strong><small className="cell-sub">{str(r.offering_name)}</small></span> },
          { label: 'Payment', render: (r) => <Pill value={str(r.payment_status)} /> },
          { label: 'Status', render: (r) => <Pill value={str(r.status)} /> },
          { label: 'Progress', render: (r) => <Progress value={number(r.progress)} /> }
        ]} />
      </Panel>
    </div>
    <div className="section-spacer" />
    <Panel title="Payout requests" subtitle={`${payouts.length} requests associados`} icon={<Landmark size={18} />}>
      <DataTable rows={payouts} columns={[
        { label: 'Request', render: (r) => <span className="mono compact">{str(r.request_code)}</span> },
        { label: 'Amount', render: (r) => formatMoney(r.requested_amount, str(r.currency)), className: 'numeric' },
        { label: 'Status', render: (r) => <Pill value={str(r.status)} /> },
        { label: 'External ref', render: (r) => str(r.external_reference) || '—' },
        { label: 'Created', render: (r) => formatDate(r.created_at) }
      ]} />
    </Panel>
  </>;
}

function PageHeading({ title, subtitle, badge }: { title: string; subtitle: string; badge?: string }) {
  return <div className="page-heading"><div><div className="eyebrow">XPAYMENTS CONTROL PLANE</div><h1>{title}</h1><p>{subtitle}</p></div>{badge ? <div className="page-badge"><span className="status-dot" />{badge}</div> : null}</div>;
}

function MetricCard({ icon, label, value, detail, tone = 'cyan' }: { icon: ReactNode; label: string; value: string; detail: string; tone?: string }) {
  return <div className={`metric-card tone-${tone}`}><div className="metric-icon">{icon}</div><div className="metric-copy"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div><ArrowUpRight className="metric-arrow" size={16} /></div>;
}

function Panel({ title, subtitle, icon, children }: { title: string; subtitle?: string; icon?: ReactNode; children: ReactNode }) {
  return <section className="panel"><header className="panel-header"><div className="panel-title">{icon ? <span className="panel-icon">{icon}</span> : null}<div><h2>{title}</h2>{subtitle ? <p>{subtitle}</p> : null}</div></div></header><div className="panel-body">{children}</div></section>;
}

function DataPanel({ rows, columns, empty }: { rows: Row[]; columns: Column[]; empty: string }) {
  return <Panel title="Live records" subtitle={`${rows.length} registos carregados`} icon={<Database size={18} />}><DataTable rows={rows} columns={columns} empty={empty} /></Panel>;
}

function DataTable({ rows, columns, empty = 'Sem dados.', compact = false }: { rows: Row[]; columns: Column[]; empty?: string; compact?: boolean }) {
  if (!rows.length) return <EmptyState text={empty} />;
  return <div className={compact ? 'table-wrap compact-table' : 'table-wrap'}><table><thead><tr>{columns.map((column, index) => <th key={index} className={column.className}>{column.label}</th>)}</tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={str(row.id) || str(row.order_code) || String(rowIndex)}>{columns.map((column, index) => <td key={index} className={column.className}>{column.render(row)}</td>)}</tr>)}</tbody></table></div>;
}

function SearchBox({ placeholder, value }: { placeholder: string; value: string }) {
  return <form className="search-box" method="get"><Search size={17} /><input name="q" defaultValue={value} placeholder={placeholder} /><button type="submit">Pesquisar</button>{value ? <Link href="?">Limpar</Link> : null}</form>;
}

function EntityLink({ href, primary, secondary }: { href: string; primary: string; secondary?: string }) {
  return <Link href={href} className="entity-link"><span><strong>{primary || '—'}</strong>{secondary ? <small>{secondary}</small> : null}</span><ArrowUpRight size={14} /></Link>;
}

function Pill({ value }: { value: string }) {
  const normalized = value || 'UNSET';
  const tone = statusTone(normalized);
  return <span className={`pill pill-${tone}`}>{normalized}</span>;
}

function Progress({ value }: { value: number }) {
  const safe = Math.max(0, Math.min(100, value));
  return <div className="progress-cell"><div className="progress-track"><span style={{ width: `${safe}%` }} /></div><small>{safe}%</small></div>;
}

function StatusBreakdown({ rows, total, labelKey }: { rows: Row[]; total: number; labelKey: string }) {
  return <div className="status-breakdown">{rows.map((row, index) => { const count = number(row.count); const pct = total ? Math.round(count / total * 100) : 0; return <div key={index} className="status-row"><div><Pill value={str(row[labelKey])} /><strong>{count}</strong></div><div className="progress-track"><span style={{ width: `${pct}%` }} /></div><small>{pct}% do total</small></div>; })}</div>;
}

function CompactStat({ label, value }: { label: string; value: number }) {
  return <div className="compact-stat"><span>{label}</span><strong>{formatNumber(value)}</strong></div>;
}

function StrongNumber({ value, suffix = '' }: { value: unknown; suffix?: string }) {
  return <strong>{formatNumber(value)}<span className="muted-weight">{suffix}</span></strong>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="empty-state"><CircleAlert size={20} /><span>{text}</span></div>;
}

function SectionError({ title, status }: { title: string; status: number }) {
  return <><PageHeading title={title} subtitle="Não foi possível carregar esta área." badge={`HTTP ${status}`} /><div className="error-panel"><CircleAlert size={24} /><div><strong>Control Plane read error</strong><span>A API respondeu com HTTP {status}. Nenhuma mutação foi executada.</span></div></div></>;
}

function boolLabel(value: unknown) {
  return truthy(value) ? 'YES' : 'NO';
}

function truthy(value: unknown) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function statusTone(value: string) {
  const v = value.toUpperCase();
  if (['ACTIVE', 'SUCCEEDED', 'SUCCESS', 'PAID', 'CONFIRMED', 'COMPLETED', 'ONLINE'].some((x) => v.includes(x))) return 'green';
  if (['FAILED', 'REJECTED', 'CANCELLED', 'INACTIVE', 'BLOCKED'].some((x) => v.includes(x))) return 'red';
  if (['PENDING', 'OPEN', 'REVIEW', 'IN_PROGRESS', 'PROCESSING'].some((x) => v.includes(x))) return 'amber';
  if (['TEST', 'SANDBOX', 'SHADOW'].some((x) => v.includes(x))) return 'violet';
  return 'blue';
}

function formatFee(row: Row) {
  if (row.fee_percent_bps == null && row.fee_fixed_minor == null) return '—';
  return `${(number(row.fee_percent_bps) / 100).toFixed(2)}% + ${formatMinor(row.fee_fixed_minor, str(row.currency) || 'EUR')}`;
}

function formatMinor(value: unknown, currency: string) {
  return formatMoney(number(value) / 100, currency || 'EUR');
}

function formatMoney(value: unknown, currency = 'EUR') {
  const amount = number(value);
  try {
    return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: currency === 'USDT' ? 'USD' : currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount).replace('US$', currency === 'USDT' ? 'USDT ' : 'US$');
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function formatNumber(value: unknown) {
  return new Intl.NumberFormat('pt-PT').format(number(value));
}

function formatDate(value: unknown) {
  const raw = str(value);
  if (!raw) return '—';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat('pt-PT', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date);
}

function number(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function str(value: unknown) {
  return value == null ? '' : String(value);
}

function param(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || '' : value || '';
}

function asTextArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

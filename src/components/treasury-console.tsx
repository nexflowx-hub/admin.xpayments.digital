'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ControlPlaneUser } from '@/lib/control-plane';
import styles from './treasury-console.module.css';

type Row = Record<string, any>;

type Data = {
  merchants: Row[];
  stores: Row[];
  physical: Row[];
  accounting: Row[];
  releases: Row[];
  movements: Row[];
};

async function api(path: string, method = 'GET', body?: unknown) {
  const res = await fetch(`/api/control-plane${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store'
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload?.error?.message || `HTTP ${res.status}`);
  return payload?.data ?? payload;
}

const money = (value: unknown, currency = 'BRL') => {
  const amount = Number(value || 0);
  try {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
};

const key = () => `cp_treasury_${crypto.randomUUID()}`;
const roleOf = (wallet: Row) => String(wallet.walletRole || wallet.wallet_role || '').toUpperCase();
const currencyOf = (wallet: Row) => String(wallet.currency || '').toUpperCase();
const metadataOf = (wallet: Row): Record<string, any> => wallet?.metadata && typeof wallet.metadata === 'object' ? wallet.metadata : {};

export function TreasuryConsole({ user }: { user: ControlPlaneUser }) {
  const [data, setData] = useState<Data>({ merchants: [], stores: [], physical: [], accounting: [], releases: [], movements: [] });
  const [merchantId, setMerchantId] = useState('');
  const [storeId, setStoreId] = useState('');
  const [currency, setCurrency] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [form, setForm] = useState({
    sourceWalletId: '', destinationWalletId: '', sourceCurrency: 'EUR',
    sourceAmount: '', creditAmount: '', fxRate: '', fxCost: '0',
    payoutStatementId: '', reference: '', notes: '', idempotencyKey: key()
  });

  const canWrite = user.role === 'SUPER_ADMIN' || user.role === 'OPERATIONS' || user.role === 'FINANCE' || user.permissions?.['treasury.write'] === true || user.permissions?.['*'] === true;

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const params = new URLSearchParams();
      if (merchantId) params.set('merchantId', merchantId);
      if (storeId) params.set('storeId', storeId);
      if (currency) params.set('currency', currency);
      if (status) params.set('status', status);
      const walletParams = new URLSearchParams();
      if (merchantId) walletParams.set('merchantId', merchantId);
      if (currency) walletParams.set('currency', currency);
      const movementParams = new URLSearchParams();
      if (merchantId) movementParams.set('merchantId', merchantId);
      movementParams.set('limit', '100');

      const [m, s, p, a, r, mv] = await Promise.all([
        api('/merchants?limit=200'),
        api('/stores?limit=500'),
        api(`/treasury/wallets?${walletParams.toString()}`),
        api(`/treasury/accounting-wallets?${walletParams.toString()}`),
        api(`/treasury/releases?${params.toString()}`),
        api(`/treasury/movements?${movementParams.toString()}`)
      ]);

      setData({
        merchants: m.merchants || [],
        stores: s.stores || [],
        physical: p.wallets || [],
        accounting: a.wallets || [],
        releases: r.releases || [],
        movements: mv.movements || []
      });
    } catch (error) {
      setNotice({ ok: false, text: error instanceof Error ? error.message : 'Falha ao carregar Treasury.' });
    } finally {
      setBusy(false);
    }
  }, [merchantId, storeId, currency, status]);

  useEffect(() => { void refresh(); }, [refresh]);

  const merchantStores = useMemo(() => data.stores.filter((s) => !merchantId || String(s.merchant_id || s.merchantId) === merchantId), [data.stores, merchantId]);
  const physicalForMerchant = useMemo(() => data.physical.filter((w) => !merchantId || String(w.merchantId || w.merchant_id) === merchantId), [data.physical, merchantId]);
  const accountingForMerchant = useMemo(() => data.accounting.filter((w) => !merchantId || String(w.merchantId || w.merchant_id) === merchantId), [data.accounting, merchantId]);
  const walletBrl = merchantId ? physicalForMerchant.find((w) => String(w.code).toUpperCase() === 'WALLET-BRL') : undefined;
  const blockedForMerchant = useMemo(
    () => merchantId ? physicalForMerchant.filter((w) => roleOf(w) === 'BLOCKED') : [],
    [merchantId, physicalForMerchant]
  );
  const awaiting = data.releases.filter((r) => r.operationalStatus === 'awaiting_admin');

  const preferredDestination = (targetMerchantId: string, targetCurrency: string) => {
    const wallets = data.physical.filter((w) => String(w.merchantId || w.merchant_id) === targetMerchantId);
    const currencyUpper = String(targetCurrency || '').toUpperCase();
    const blocked = wallets.find((w) =>
      roleOf(w) === 'BLOCKED' &&
      currencyOf(w) === currencyUpper &&
      metadataOf(w).defaultPayoutDestination === true
    );
    if (blocked) return blocked;
    return wallets.find((w) => String(w.code).toUpperCase() === 'WALLET-BRL');
  };

  useEffect(() => {
    if (!merchantId) return;
    const preferred = preferredDestination(merchantId, form.sourceCurrency);
    if (preferred && form.destinationWalletId !== String(preferred.id)) {
      setForm((old) => ({ ...old, destinationWalletId: String(preferred.id) }));
    }
  }, [merchantId, form.sourceCurrency, form.destinationWalletId, data.physical]);

  const useRelease = (release: Row) => {
    const targetMerchantId = String(release.merchantId || '');
    const releaseCurrency = String(release.currency || 'EUR').toUpperCase();
    const source = data.accounting.find((w) =>
      String(w.merchantId || w.merchant_id) === targetMerchantId &&
      currencyOf(w) === releaseCurrency
    );
    const destination = preferredDestination(targetMerchantId, releaseCurrency);
    setMerchantId(targetMerchantId);
    setStoreId(String(release.storeId || ''));
    setForm((old) => ({
      ...old,
      sourceWalletId: source ? String(source.id) : '',
      destinationWalletId: destination ? String(destination.id) : '',
      sourceCurrency: releaseCurrency,
      sourceAmount: String(release.amount || ''),
      reference: `SETTLEMENT-${String(release.releaseDate || '').replaceAll('-', '')}`,
      idempotencyKey: key()
    }));
  };

  const confirmSettlement = async () => {
    if (!canWrite) return;
    setBusy(true); setNotice(null);
    try {
      const result = await api('/treasury/settlements/confirm', 'POST', {
        merchantId,
        sourceWalletId: form.sourceWalletId,
        destinationWalletId: form.destinationWalletId,
        sourceCurrency: form.sourceCurrency,
        sourceAmount: Number(form.sourceAmount),
        creditAmount: Number(form.creditAmount),
        fxRate: form.fxRate ? Number(form.fxRate) : undefined,
        fxCost: Number(form.fxCost || 0),
        payoutStatementId: form.payoutStatementId || undefined,
        reference: form.reference || undefined,
        notes: form.notes || undefined,
        idempotencyKey: form.idempotencyKey
      });
      setNotice({ ok: true, text: result.idempotent ? 'Operação já existia; nenhum valor foi duplicado.' : 'Settlement confirmado e Treasury Wallet atualizada.' });
      setForm((old) => ({ ...old, sourceAmount: '', creditAmount: '', fxRate: '', fxCost: '0', payoutStatementId: '', notes: '', idempotencyKey: key() }));
      await refresh();
    } catch (error) {
      setNotice({ ok: false, text: error instanceof Error ? error.message : 'Falha ao confirmar settlement.' });
    } finally {
      setBusy(false);
    }
  };

  return <div className={styles.wrap}>
    <div className={styles.hero}>
      <div><h1>Treasury & Settlements</h1><p>Visão global por Merchant e Store. Wallets contabilísticas permanecem no Finance Core; Wallet-BRL/USDT são contas físicas de settlement e Wallet-Block retém fundos por moeda. Conversão e custos são aprovados manualmente.</p></div>
      <span className={styles.chip}>MANUAL SETTLEMENT</span>
    </div>

    <div className={styles.filters}>
      <Field label="Merchant"><select value={merchantId} onChange={(e) => { setMerchantId(e.target.value); setStoreId(''); }}><option value="">Todos os Merchants</option>{data.merchants.map((m) => <option key={m.id} value={m.id}>{m.name} · {m.email}</option>)}</select></Field>
      <Field label="Store"><select value={storeId} onChange={(e) => setStoreId(e.target.value)}><option value="">Todas as Stores</option>{merchantStores.map((s) => <option key={s.id} value={s.id}>{s.store_code} · {s.name}</option>)}</select></Field>
      <Field label="Moeda"><select value={currency} onChange={(e) => setCurrency(e.target.value)}><option value="">Todas</option>{['EUR','BRL','GBP','PLN','USD','USDT'].map((c) => <option key={c}>{c}</option>)}</select></Field>
      <Field label="Estado"><select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Todos</option><option value="awaiting_admin">Aguarda validação</option><option value="provider_pending">Provider pending</option><option value="overdue_unconfirmed">Vencida / não confirmada</option><option value="expected">Prevista</option></select></Field>
    </div>

    {notice ? <div className={`${styles.notice} ${notice.ok ? styles.ok : styles.bad}`}>{notice.text}</div> : null}

    <div className={styles.cards}>
      <div className={`${styles.card} ${styles.physical}`}><small>Wallet-BRL física</small><strong>{walletBrl ? money(walletBrl.balance, 'BRL') : '—'}</strong><span className={styles.muted}>{walletBrl ? `${walletBrl.merchantName} · PagarPIX` : 'Selecione um Merchant'}</span></div>
      <div className={styles.card}><small>Wallet-Block</small><strong>{blockedForMerchant.length}</strong><span className={styles.muted}>{blockedForMerchant.length ? blockedForMerchant.map((w) => `${w.currency}: ${money(w.balance, w.currency)}`).join(' · ') : 'Sem saldos bloqueados / selecione um Merchant'}</span></div>
      <div className={styles.card}><small>Pendências para ação</small><strong>{awaiting.length}</strong><span className={styles.muted}>Provider confirmado, aguarda operador</span></div>
      <div className={styles.card}><small>Wallets contabilísticas</small><strong>{accountingForMerchant.length}</strong><span className={styles.muted}>Nunca somadas entre moedas</span></div>
      <div className={styles.card}><small>Treasury movements</small><strong>{data.movements.length}</strong><span className={styles.muted}>Últimos 100 movimentos</span></div>
    </div>

    <div className={styles.grid}>
      <section className={styles.panel}>
        <div className={styles.toolbar}><h2>Liberações e pendências</h2><button className={styles.secondary} disabled={busy} onClick={() => void refresh()}>Atualizar</button></div>
        <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Merchant</th><th>Store</th><th>Data</th><th>Valor</th><th>Provider</th><th>Operação</th><th /></tr></thead><tbody>{data.releases.map((r, i) => <tr key={`${r.merchantId}-${r.storeId}-${r.releaseDate}-${r.currency}-${i}`}><td>{r.merchantName}</td><td>{r.storeCode || '—'}</td><td>{String(r.releaseDate || '—').slice(0,10)}</td><td className={styles.mono}>{money(r.amount, r.currency)}</td><td>{r.providerStatus}</td><td><span className={`${styles.status} ${styles[r.operationalStatus] || ''}`}>{r.operationalStatus}</span></td><td><button className={styles.secondary} onClick={() => useRelease(r)}>Usar</button></td></tr>)}</tbody></table></div>
      </section>

      <section className={`${styles.panel} ${styles.physical}`}>
        <h2>Confirmar settlement manual</h2>
        <div className={styles.form}>
          <Field label="Wallet contabilística origem"><select value={form.sourceWalletId} onChange={(e) => { const w = accountingForMerchant.find((x) => String(x.id) === e.target.value); setForm({ ...form, sourceWalletId: e.target.value, sourceCurrency: w ? String(w.currency).toUpperCase() : form.sourceCurrency }); }}><option value="">Selecionar</option>{accountingForMerchant.map((w) => <option key={w.id} value={w.id}>{w.currency} · disponível {money(w.available, w.currency)}</option>)}</select></Field>
          <Field label="Treasury Wallet destino"><select value={form.destinationWalletId} onChange={(e) => setForm({ ...form, destinationWalletId: e.target.value })}><option value="">Selecionar</option>{physicalForMerchant.map((w) => <option key={w.id} value={w.id}>{w.code} · {w.currency} · {money(w.balance, w.currency)}</option>)}</select></Field>
          <div className={styles.row}><Field label={`Valor origem (${form.sourceCurrency})`}><input inputMode="decimal" value={form.sourceAmount} onChange={(e) => setForm({ ...form, sourceAmount: e.target.value })} /></Field><Field label="Crédito destino"><input inputMode="decimal" value={form.creditAmount} onChange={(e) => setForm({ ...form, creditAmount: e.target.value })} /></Field></div>
          <div className={styles.row}><Field label="FX aplicado (manual)"><input inputMode="decimal" value={form.fxRate} onChange={(e) => setForm({ ...form, fxRate: e.target.value })} /></Field><Field label="Custos FX / movimento"><input inputMode="decimal" value={form.fxCost} onChange={(e) => setForm({ ...form, fxCost: e.target.value })} /></Field></div>
          <Field label="Payout Statement ID (opcional)"><input className={styles.mono} value={form.payoutStatementId} onChange={(e) => setForm({ ...form, payoutStatementId: e.target.value })} /></Field>
          <Field label="Referência"><input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></Field>
          <Field label="Notas internas"><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          <Field label="Idempotency key"><input className={styles.mono} value={form.idempotencyKey} readOnly /></Field>
          <button className={styles.button} disabled={busy || !canWrite || !merchantId || !form.sourceWalletId || !form.destinationWalletId || !Number(form.sourceAmount) || !Number(form.creditAmount)} onClick={() => void confirmSettlement()}>{canWrite ? 'CONFIRMAR SETTLEMENT' : 'SEM PERMISSÃO DE ESCRITA'}</button>
          <small className={styles.muted}>A confirmação debita a Wallet contabilística e credita a Treasury Wallet escolhida na mesma transação. Para Merchants com política de bloqueio, a Wallet-Block da mesma moeda é pré-selecionada. Nenhum FX automático é executado.</small>
        </div>
      </section>
    </div>

    <section className={styles.panel}>
      <h2>Movimentos Treasury recentes</h2>
      <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Data</th><th>Merchant</th><th>Wallet</th><th>Origem</th><th>Crédito</th><th>FX</th><th>Referência</th><th>Operador</th></tr></thead><tbody>{data.movements.map((m) => <tr key={m.id}><td>{String(m.created_at || '').slice(0,19).replace('T',' ')}</td><td>{m.merchant_name}</td><td>{m.treasury_wallet_code}</td><td>{m.source_amount ? money(m.source_amount, m.source_currency) : '—'}</td><td>{money(m.amount, m.currency)}</td><td>{m.fx_rate || '—'}</td><td>{m.reference || '—'}</td><td>{m.confirmed_by || '—'}</td></tr>)}</tbody></table></div>
    </section>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className={styles.field}><label>{label}</label>{children}</div>;
}

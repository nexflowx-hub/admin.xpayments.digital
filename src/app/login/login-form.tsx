'use client';

import { FormEvent, useState } from 'react';
import { ArrowRight, KeyRound, Loader2, LockKeyhole, Mail } from 'lucide-react';

export function LoginForm() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);

    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/session/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: String(form.get('email') || ''),
        password: String(form.get('password') || '')
      })
    }).catch(() => null);

    if (!response) {
      setError('Não foi possível contactar o Control Plane.');
      setLoading(false);
      return;
    }

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(String(payload.message || 'Credenciais inválidas.'));
      setLoading(false);
      return;
    }

    window.location.assign('/overview');
  }

  return (
    <form className="login-form" onSubmit={submit}>
      <label className="field">
        <span>Email interno</span>
        <div className="input-shell">
          <Mail size={17} />
          <input name="email" type="email" autoComplete="username" placeholder="admin@xpayments.digital" required />
        </div>
      </label>

      <label className="field">
        <span>Password</span>
        <div className="input-shell">
          <KeyRound size={17} />
          <input name="password" type="password" autoComplete="current-password" placeholder="••••••••••••" required />
        </div>
      </label>

      {error ? <div className="login-error" role="alert"><LockKeyhole size={16} />{error}</div> : null}

      <button className="primary-button login-button" type="submit" disabled={loading}>
        {loading ? <Loader2 className="spin" size={18} /> : <LockKeyhole size={18} />}
        {loading ? 'A validar sessão…' : 'Entrar no Control Plane'}
        {!loading ? <ArrowRight size={18} /> : null}
      </button>

      <p className="login-footnote">Sessões internas revogáveis · cookie HttpOnly · RBAC server-side</p>
    </form>
  );
}

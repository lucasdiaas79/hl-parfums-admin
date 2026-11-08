'use client';

import { useState } from 'react';
import { numberToEmail, supabase } from '@/lib/supabase';

export default function LoginPage() {
  const [num, setNum] = useState('');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (num.replace(/\D/g, '').length < 10) return setErr('Digite o número com DDD, sem o +55.');
    setBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email: numberToEmail(num), password: pass });
    if (error || !data.user) {
      setBusy(false);
      return setErr('Número ou senha incorretos.');
    }
    const { data: adm } = await supabase.from('admins').select('user_id').eq('user_id', data.user.id).maybeSingle();
    if (!adm) {
      await supabase.auth.signOut();
      setBusy(false);
      return setErr('Este acesso não tem permissão para o painel.');
    }
    // O AuthProvider redireciona para as ofertas.
  };

  return (
    <div className="login">
      <div className="login-art">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/hl-mark.png" alt="HL Parfums" style={{ height: 56, width: 'auto' }} />
          <span className="serif" style={{ fontSize: 24, letterSpacing: 7 }}>PARFUMS</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <span style={{ fontSize: 12, letterSpacing: 3, color: 'var(--gold)', fontWeight: 500 }}>PAINEL ADMINISTRATIVO</span>
          <h1>
            Seu catálogo, <em>sob controle</em>.
          </h1>
          <p style={{ margin: 0, color: '#b9ae9c', maxWidth: 440 }}>Cadastre ofertas, ajuste preços e marque esgotados. Tudo aparece na loja em até 1 minuto.</p>
        </div>
        <span style={{ fontSize: 12, color: '#8c8273' }}>Acesso restrito</span>
      </div>
      <div className="login-form">
        <form onSubmit={submit} noValidate>
          <div>
            <h2 className="serif" style={{ margin: '0 0 6px', fontWeight: 500, fontSize: 40 }}>Entrar</h2>
            <p style={{ margin: 0, color: 'var(--mute)' }}>Use o número cadastrado e a sua senha.</p>
          </div>
          <label className="label">
            Número
            <input className="field" type="tel" inputMode="numeric" autoComplete="username" placeholder="79999999999" value={num} onChange={(e) => setNum(e.target.value)} />
          </label>
          <label className="label">
            Senha
            <input className="field" type="password" autoComplete="current-password" value={pass} onChange={(e) => setPass(e.target.value)} />
          </label>
          {err && <div className="notice err" role="alert">{err}</div>}
          <button className="btn btn-ink" type="submit" disabled={busy} style={{ height: 54 }}>
            {busy ? 'Entrando…' : 'ENTRAR'}
          </button>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--mute)', textAlign: 'center' }}>Esqueceu a senha? Fale com o responsável pelo sistema.</p>
        </form>
      </div>
    </div>
  );
}

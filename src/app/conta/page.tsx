'use client';

import { useState } from 'react';
import { Shell } from '@/components/Shell';
import { useAuth } from '@/components/Auth';
import { emailToNumber, supabase } from '@/lib/supabase';

export default function AccountPage() {
  const { session } = useAuth();
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (p1.length < 8) return setMsg({ ok: false, text: 'A senha precisa ter pelo menos 8 caracteres.' });
    if (p1 !== p2) return setMsg({ ok: false, text: 'As senhas não conferem.' });
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: p1 });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: 'Não foi possível trocar a senha. Entre de novo e tente outra vez.' });
    setP1('');
    setP2('');
    setMsg({ ok: true, text: 'Senha alterada.' });
  };

  return (
    <Shell>
      <div className="page-head">
        <div>
          <h1>Minha conta</h1>
          <p>Acesso: {emailToNumber(session?.user.email)}</p>
        </div>
      </div>
      <form className="card" style={{ maxWidth: 460 }} onSubmit={submit}>
        <h2 style={{ margin: 0, fontSize: 17 }}>Trocar senha</h2>
        <label className="label">
          Nova senha
          <input className="field" type="password" autoComplete="new-password" value={p1} onChange={(e) => setP1(e.target.value)} />
        </label>
        <label className="label">
          Repita a nova senha
          <input className="field" type="password" autoComplete="new-password" value={p2} onChange={(e) => setP2(e.target.value)} />
        </label>
        {msg && <div className={`notice ${msg.ok ? 'ok' : 'err'}`} role="status">{msg.text}</div>}
        <button className="btn btn-ink" disabled={busy} type="submit">{busy ? 'Salvando…' : 'Salvar nova senha'}</button>
      </form>
    </Shell>
  );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { RequireAdmin, useAuth } from './Auth';
import { emailToNumber, STORE_URL } from '@/lib/supabase';

const NAV = [
  { href: '/', label: 'Ofertas' },
  { href: '/nova', label: 'Nova oferta' },
  { href: '/lixeira', label: 'Lixeira' },
  { href: '/conta', label: 'Minha conta' },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { session, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  return (
    <RequireAdmin>
      <div className="shell">
        <header className="topbar">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/hl-mark.png" alt="HL Parfums" />
          <button aria-label="Abrir menu" onClick={() => setOpen(true)}>
            <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M4 8h16M4 16h16" /></svg>
          </button>
        </header>
        <aside className={`side${open ? ' open' : ''}`}>
          <div className="side-brand" style={{ justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/hl-mark.png" alt="HL Parfums" />
              <span>PARFUMS</span>
            </span>
            {open && (
              <button aria-label="Fechar menu" onClick={() => setOpen(false)} style={{ background: 'none', border: 0, color: '#f5f1ea', fontSize: 26, cursor: 'pointer' }}>×</button>
            )}
          </div>
          <nav aria-label="Painel">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} aria-current={(n.href === '/' ? pathname === '/' : pathname.startsWith(n.href)) ? 'page' : undefined}>
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="side-foot">
            <a href={STORE_URL} target="_blank" rel="noopener noreferrer">Ver loja ↗</a>
            <div style={{ borderTop: '1px solid #2a251f', paddingTop: 14, color: '#8c8273' }}>
              {emailToNumber(session?.user.email)} · <button onClick={signOut}>Sair</button>
            </div>
          </div>
        </aside>
        <main className="main">{children}</main>
      </div>
    </RequireAdmin>
  );
}

export function Toast({ text, action, onAction, onClose }: { text: string; action?: string; onAction?: () => void; onClose: () => void }) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const t = setTimeout(() => closeRef.current(), 6000);
    return () => clearTimeout(t);
  }, [text]);
  return (
    <div className="toast" role="status">
      <span>{text}</span>
      {action && <button onClick={onAction}>{action}</button>}
    </div>
  );
}

export function Confirm({ title, body, confirm, danger, onCancel, onConfirm, busy }: { title: string; body: React.ReactNode; confirm: string; danger?: boolean; onCancel: () => void; onConfirm: () => void; busy?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [onCancel]);
  return (
    <div className="veil" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="cf-title">
        <h2 id="cf-title">{title}</h2>
        <p>{body}</p>
        <div className="row">
          <button className="btn" onClick={onCancel} autoFocus>Cancelar</button>
          <button className={`btn ${danger ? 'btn-danger' : 'btn-ink'}`} onClick={onConfirm} disabled={busy}>{busy ? 'Aguarde…' : confirm}</button>
        </div>
      </div>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Confirm, Shell, Toast } from '@/components/Shell';
import { listOffers, moveToTrash, parsePrice, priceInput, restoreFromTrash, updateOffer, type Offer } from '@/lib/data';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function PriceCell({ offer, onSaved, onError }: { offer: Offer; onSaved: (v: number) => void; onError: (m: string) => void }) {
  const [val, setVal] = useState(priceInput(offer.price));
  const [saving, setSaving] = useState(false);
  useEffect(() => setVal(priceInput(offer.price)), [offer.price]);
  const commit = async () => {
    const n = parsePrice(val);
    if (n === null) {
      setVal(priceInput(offer.price));
      if (val.trim()) onError('Preço inválido. Use, por exemplo, 249,90.');
      return;
    }
    if (n === offer.price) return setVal(priceInput(n));
    setSaving(true);
    try {
      await updateOffer(offer.id, { price: n });
      onSaved(n);
    } catch {
      setVal(priceInput(offer.price));
      onError('Não foi possível salvar o preço. Tente de novo.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <label className={`price-edit${saving ? ' saving' : ''}`}>
      <span>R$</span>
      <input
        aria-label={`Preço de ${offer.name}`}
        inputMode="decimal"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
    </label>
  );
}

export default function OffersPage() {
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [loadErr, setLoadErr] = useState('');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [brand, setBrand] = useState('');
  const [status, setStatus] = useState('');
  const [limit, setLimit] = useState(50);
  const [pending, setPending] = useState<Offer | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ text: string; undo?: Offer } | null>(null);

  const load = useCallback(async () => {
    try {
      setOffers(await listOffers());
    } catch {
      setLoadErr('Não foi possível carregar as ofertas. Verifique a conexão e recarregue a página.');
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const patchLocal = (id: string, p: Partial<Offer>) => setOffers((cur) => cur && cur.map((o) => (o.id === id ? { ...o, ...p } : o)));

  const toggle = async (o: Offer) => {
    const next = o.status === 'active' ? 'sold_out' : 'active';
    if (o.status === 'hidden' && o.price === null) return setToast({ text: 'Defina o preço antes de mostrar este perfume na loja.' });
    patchLocal(o.id, { status: next });
    try {
      await updateOffer(o.id, { status: next });
      setToast({ text: next === 'sold_out' ? `${o.name} marcado como esgotado.` : `${o.name} disponível de novo.` });
    } catch {
      patchLocal(o.id, { status: o.status });
      setToast({ text: 'Não foi possível alterar o status.' });
    }
  };

  const confirmDelete = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      await moveToTrash(pending.id);
      setOffers((cur) => cur && cur.filter((o) => o.id !== pending.id));
      setToast({ text: `${pending.name} foi para a Lixeira.`, undo: pending });
    } catch {
      setToast({ text: 'Não foi possível excluir. Tente de novo.' });
    } finally {
      setBusy(false);
      setPending(null);
    }
  };

  const undo = async () => {
    const o = toast?.undo;
    if (!o) return;
    setToast(null);
    try {
      await restoreFromTrash(o.id);
      await load();
      setToast({ text: `${o.name} restaurado.` });
    } catch {
      setToast({ text: 'Não foi possível restaurar. Use a Lixeira.' });
    }
  };

  const cats = useMemo(() => [...new Set((offers || []).map((o) => o.category))].sort(), [offers]);
  const brands = useMemo(() => [...new Set((offers || []).map((o) => o.brand))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [offers]);
  const filtered = useMemo(() => {
    let l = offers || [];
    if (q) {
      const t = norm(q);
      l = l.filter((o) => norm(`${o.name} ${o.brand}`).includes(t));
    }
    if (cat) l = l.filter((o) => o.category === cat);
    if (brand) l = l.filter((o) => o.brand === brand);
    if (status) l = l.filter((o) => o.status === status);
    return l;
  }, [offers, q, cat, brand, status]);

  const counts = useMemo(() => {
    const c = { active: 0, sold_out: 0, hidden: 0 };
    (offers || []).forEach((o) => {
      if (o.status in c) c[o.status as keyof typeof c]++;
    });
    return c;
  }, [offers]);

  return (
    <Shell>
      <div className="page-head">
        <div>
          <h1>Ofertas</h1>
          {offers && (
            <p>
              <b>{counts.active}</b> disponíveis · <b>{counts.sold_out}</b> esgotados{counts.hidden ? <> · <b>{counts.hidden}</b> ocultos</> : null}
            </p>
          )}
        </div>
        <div className="head-actions">
          <Link href="/nova" className="btn btn-gold">+ Nova oferta</Link>
        </div>
      </div>

      <div className="filters">
        <label className="search">
          <span className="sr-only">Buscar oferta</span>
          <input className="field" type="search" placeholder="Buscar por nome ou marca" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <select className="field" aria-label="Categoria" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">Todas as categorias</option>
          {cats.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select className="field" aria-label="Marca" value={brand} onChange={(e) => setBrand(e.target.value)}>
          <option value="">Todas as marcas</option>
          {brands.map((b) => <option key={b}>{b}</option>)}
        </select>
        <select className="field" aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todos os status</option>
          <option value="active">Disponível</option>
          <option value="sold_out">Esgotado</option>
          <option value="hidden">Oculto</option>
        </select>
      </div>

      {loadErr && <div className="notice err">{loadErr}</div>}

      <div className="table">
        <div className="tr head">
          <span>Perfume</span><span>Categoria</span><span>Gênero</span><span>Preço</span><span>Status na loja</span><span style={{ textAlign: 'right' }}>Ações</span>
        </div>
        {!offers && !loadErr && <div className="empty">Carregando ofertas…</div>}
        {offers && filtered.length === 0 && <div className="empty">Nenhuma oferta encontrada.</div>}
        {filtered.slice(0, limit).map((o) => (
          <div className="tr" key={o.id}>
            <div className="prod c-prod">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={o.image || '/hl-mark.png'} alt="" loading="lazy" />
              <div style={{ minWidth: 0 }}>
                <b>{o.name}</b>
                <small>{o.brand}</small>
              </div>
            </div>
            <span className="c-cat">{o.category}</span>
            <span className="c-gen">{o.gender}</span>
            <div className="c-price">
              <PriceCell offer={o} onSaved={(v) => { patchLocal(o.id, { price: v }); setToast({ text: `Preço de ${o.name} atualizado.` }); }} onError={(m) => setToast({ text: m })} />
            </div>
            <div className="c-status">
              {o.status === 'active' && <button className="pill ok" onClick={() => toggle(o)} title="Clique para marcar como esgotado"><i />Disponível</button>}
              {o.status === 'sold_out' && <button className="pill warn" onClick={() => toggle(o)} title="Clique para marcar como disponível"><i />Esgotado</button>}
              {o.status === 'hidden' && <button className="pill muted" onClick={() => toggle(o)} title="Oculto da loja">Oculto</button>}
            </div>
            <div className="actions c-actions">
              <Link className="icon-btn" href={`/editar/${o.id}`} aria-label={`Editar ${o.name}`}>
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z" /></svg>
              </Link>
              <button className="icon-btn danger" onClick={() => setPending(o)} aria-label={`Excluir ${o.name}`}>
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13" /></svg>
              </button>
            </div>
          </div>
        ))}
        {offers && (
          <div className="table-foot">
            <span>Mostrando {Math.min(limit, filtered.length)} de {filtered.length} · o preço é salvo ao sair do campo ou com Enter</span>
            {filtered.length > limit && <button className="btn btn-sm" onClick={() => setLimit((l) => l + 50)}>Mostrar mais</button>}
          </div>
        )}
      </div>

      <Link href="/nova" className="btn btn-gold fab">+ Nova oferta</Link>

      {pending && (
        <Confirm
          title={`Excluir ${pending.name}?`}
          body={<>Ele sai da loja na hora e vai para a <b>Lixeira</b>. Você pode restaurar em até 30 dias; depois disso é apagado de vez.</>}
          confirm="Mover para a Lixeira"
          danger
          busy={busy}
          onCancel={() => setPending(null)}
          onConfirm={confirmDelete}
        />
      )}
      {toast && <Toast text={toast.text} action={toast.undo ? 'Desfazer' : undefined} onAction={undo} onClose={() => setToast(null)} />}
    </Shell>
  );
}

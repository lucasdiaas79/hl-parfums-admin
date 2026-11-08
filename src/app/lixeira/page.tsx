'use client';

import { useCallback, useEffect, useState } from 'react';
import { Confirm, Shell, Toast } from '@/components/Shell';
import { deleteForever, formatPrice, listOffers, restoreFromTrash, type Offer } from '@/lib/data';

function daysLeft(trashedAt: string | null) {
  if (!trashedAt) return 30;
  const passed = (Date.now() - new Date(trashedAt).getTime()) / 86400000;
  return Math.max(0, Math.ceil(30 - passed));
}

export default function TrashPage() {
  const [items, setItems] = useState<Offer[] | null>(null);
  const [toast, setToast] = useState('');
  const [pending, setPending] = useState<Offer | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => listOffers(true).then(setItems).catch(() => setToast('Não foi possível carregar a Lixeira.')), []);
  useEffect(() => {
    load();
  }, [load]);

  const restore = async (o: Offer) => {
    try {
      await restoreFromTrash(o.id);
      setItems((l) => l && l.filter((x) => x.id !== o.id));
      setToast(`${o.name} voltou para a loja.`);
    } catch {
      setToast('Não foi possível restaurar.');
    }
  };

  const destroy = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      await deleteForever(pending.id);
      setItems((l) => l && l.filter((x) => x.id !== pending.id));
      setToast(`${pending.name} apagado de vez.`);
    } catch {
      setToast('Não foi possível apagar.');
    } finally {
      setBusy(false);
      setPending(null);
    }
  };

  return (
    <Shell>
      <div className="page-head">
        <div>
          <h1>Lixeira</h1>
          <p>Ofertas excluídas ficam aqui por 30 dias e depois são apagadas automaticamente.</p>
        </div>
      </div>
      <div className="table">
        {!items && <div className="empty">Carregando…</div>}
        {items && items.length === 0 && <div className="empty">A Lixeira está vazia.</div>}
        {items?.map((o) => (
          <div className="tr" key={o.id} style={{ gridTemplateColumns: '2.4fr 1fr 1fr 1.6fr' }}>
            <div className="prod c-prod">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={o.image || '/hl-mark.png'} alt="" />
              <div style={{ minWidth: 0 }}>
                <b>{o.name}</b>
                <small>{o.brand}</small>
              </div>
            </div>
            <span className="c-price">{formatPrice(o.price)}</span>
            <span className="c-status" style={{ fontSize: 13, color: 'var(--mute)' }}>{daysLeft(o.trashed_at)} dias restantes</span>
            <div className="actions c-actions">
              <button className="btn btn-sm" onClick={() => restore(o)}>Restaurar</button>
              <button className="btn btn-sm" style={{ color: 'var(--danger)' }} onClick={() => setPending(o)}>Apagar agora</button>
            </div>
          </div>
        ))}
      </div>
      {pending && (
        <Confirm
          title={`Apagar ${pending.name} de vez?`}
          body="Essa ação não pode ser desfeita."
          confirm="Apagar definitivamente"
          danger
          busy={busy}
          onCancel={() => setPending(null)}
          onConfirm={destroy}
        />
      )}
      {toast && <Toast text={toast} onClose={() => setToast('')} />}
    </Shell>
  );
}

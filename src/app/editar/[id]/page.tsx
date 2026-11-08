'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { Shell } from '@/components/Shell';
import { OfferForm } from '@/components/OfferForm';
import { getOffer, type Offer } from '@/lib/data';

export default function EditOfferPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [offer, setOffer] = useState<Offer | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    getOffer(id).then(setOffer).catch(() => setErr(true));
  }, [id]);
  return (
    <Shell>
      {err && (
        <div className="card">
          <b>Oferta não encontrada.</b>
          <Link href="/">Voltar para as ofertas</Link>
        </div>
      )}
      {!err && !offer && <div className="empty">Carregando…</div>}
      {offer && <OfferForm offer={offer} />}
    </Shell>
  );
}

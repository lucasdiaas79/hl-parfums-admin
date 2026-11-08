'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createOffer,
  formatPrice,
  generateDescription,
  listBrands,
  listCategories,
  listOffers,
  parsePrice,
  priceInput,
  saveOffer,
  type Brand,
  type Category,
  type Gender,
  type Offer,
} from '@/lib/data';
import { processPhoto } from '@/lib/photo';
import { STORE_URL } from '@/lib/supabase';

const GENDERS: Gender[] = ['Feminino', 'Masculino', 'Unissex'];
type PhotoState = 'idle' | 'processing' | 'done' | 'error';

export function OfferForm({ offer }: { offer?: Offer }) {
  const router = useRouter();
  const editing = !!offer;
  const [brands, setBrands] = useState<Brand[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [names, setNames] = useState<{ id: string; name: string }[]>([]);

  const [photoState, setPhotoState] = useState<PhotoState>(offer?.image ? 'done' : 'idle');
  const [original, setOriginal] = useState<string>('');
  const [finalUrl, setFinalUrl] = useState<string>(offer?.image || '');
  const [finalBlob, setFinalBlob] = useState<Blob | null>(null);
  const [photoNote, setPhotoNote] = useState('');
  const [over, setOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(offer?.name || '');
  const [brand, setBrand] = useState(offer?.brand || '');
  const [price, setPrice] = useState(priceInput(offer?.price ?? null));
  const [gender, setGender] = useState<Gender | ''>(offer?.gender || '');
  const [catId, setCatId] = useState(offer?.category_id || '');
  const [desc, setDesc] = useState(offer?.description || '');

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState<{ id: string } | null>(null);

  useEffect(() => {
    listBrands().then(setBrands).catch(() => {});
    listCategories().then(setCats).catch(() => {});
    listOffers().then((l) => setNames(l.map((o) => ({ id: o.id, name: o.name })))).catch(() => {});
  }, []);

  const handleFile = async (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return setPhotoNote('Envie um arquivo de imagem (JPG, PNG, WebP ou foto do celular).');
    if (original) URL.revokeObjectURL(original);
    setOriginal(URL.createObjectURL(file));
    setPhotoState('processing');
    setPhotoNote('');
    try {
      const r = await processPhoto(file);
      setFinalUrl(r.url);
      setFinalBlob(r.blob);
      setPhotoState('done');
      setPhotoNote(r.method === 'recorte' ? 'Fundo removido e preto aplicado · enquadramento 3:4' : 'A foto já tinha fundo escuro · enquadrada no padrão 3:4');
    } catch (e) {
      setPhotoState('error');
      setPhotoNote(e instanceof Error ? e.message : 'Não foi possível tratar a foto. Tente outra imagem.');
    }
  };

  const category = cats.find((c) => c.id === catId);
  const priceNum = parsePrice(price);
  const dup = useMemo(() => {
    const n = name.trim().toLowerCase();
    if (n.length < 3) return null;
    return names.find((x) => x.name.toLowerCase() === n && x.id !== offer?.id) || null;
  }, [name, names, offer?.id]);

  const ok1 = photoState === 'done';
  const ok2 = !!name.trim() && !!brand.trim() && priceNum !== null && !!gender;
  const ok3 = !!catId;
  const ok4 = desc.trim().length >= 20;
  const missing = [
    !ok1 && 'foto',
    !name.trim() && 'nome',
    !brand.trim() && 'marca',
    priceNum === null && 'preço',
    !gender && 'gênero',
    !ok3 && 'categoria',
    !ok4 && 'descrição',
  ].filter(Boolean) as string[];

  const submit = async () => {
    if (missing.length || saving) return;
    setSaving(true);
    setErr('');
    try {
      const input = { name, brandName: brand, price: priceNum!, gender: gender as Gender, categoryId: catId, description: desc, photo: finalBlob };
      if (editing) {
        await saveOffer(offer!.id, input, brands);
        setDone({ id: offer!.id });
      } else {
        const id = await createOffer(input, brands);
        setDone({ id });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      setErr(`Não foi possível salvar. ${msg.includes('JWT') || msg.includes('permission') ? 'Sua sessão expirou: entre de novo.' : 'Verifique a conexão e tente outra vez.'}`);
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setPhotoState('idle'); setOriginal(''); setFinalUrl(''); setFinalBlob(null); setPhotoNote('');
    setName(''); setBrand(''); setPrice(''); setGender(''); setCatId(''); setDesc(''); setDone(null); setErr('');
    window.scrollTo(0, 0);
  };

  const Dot = ({ ok, n }: { ok: boolean; n: number }) => <span className={`dot${ok ? ' done' : ''}`} aria-hidden="true">{ok ? '✓' : n}</span>;

  return (
    <>
      <div className="page-head">
        <div>
          <Link href="/" className="back">‹ Ofertas</Link>
          <h1 style={{ marginTop: 6 }}>{editing ? 'Editar oferta' : 'Nova oferta'}</h1>
        </div>
      </div>

      <div className="form-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* 1. Foto */}
          <section className="card">
            <div className="step-title">
              <Dot ok={ok1} n={1} />
              <h2>Foto do perfume</h2>
              <span className="hint">O sistema remove o fundo e aplica o fundo preto da loja.</span>
            </div>
            <div className="cols-2">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span className="cap">Foto enviada</span>
                {original ? (
                  <div className="photo-box src">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={original} alt="Foto original enviada" />
                  </div>
                ) : (
                  <label
                    className={`drop${over ? ' over' : ''}`}
                    onDragOver={(e) => { e.preventDefault(); setOver(true); }}
                    onDragLeave={() => setOver(false)}
                    onDrop={(e) => { e.preventDefault(); setOver(false); handleFile(e.dataTransfer.files?.[0]); }}
                  >
                    <svg aria-hidden="true" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#8a6a32" strokeWidth="1.5" strokeLinecap="round"><path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></svg>
                    <b style={{ fontSize: 14 }}>{editing ? 'Trocar a foto' : 'Arraste a foto ou toque para escolher'}</b>
                    <small style={{ color: 'var(--mute)' }}>JPG, PNG, WebP ou câmera do celular</small>
                    <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={(e) => handleFile(e.target.files?.[0])} />
                  </label>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span className="cap">Como fica na loja</span>
                <div className="photo-box out">
                  {photoState === 'processing' && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                      <span className="spinner" />
                      Removendo o fundo e aplicando o preto…
                    </div>
                  )}
                  {photoState === 'done' && finalUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={finalUrl} alt="Foto tratada com fundo preto" style={{ height: '100%', width: 'auto' }} />
                  )}
                  {photoState === 'idle' && <span style={{ color: '#6f675c' }}>Aguardando foto</span>}
                  {photoState === 'error' && <span>Não deu certo com essa foto.</span>}
                </div>
              </div>
            </div>
            {(photoNote || original || editing) && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                {photoNote && <span className={`notice ${photoState === 'error' ? 'warn' : 'ok'}`}>{photoNote}</span>}
                {(original || editing) && photoState !== 'processing' && (
                  <button className="btn btn-sm" style={{ marginLeft: 'auto' }} onClick={() => { setOriginal(''); setPhotoNote(''); if (!editing) { setPhotoState('idle'); setFinalUrl(''); setFinalBlob(null); } setTimeout(() => fileRef.current?.click(), 0); }}>
                    Trocar foto
                  </button>
                )}
              </div>
            )}
          </section>

          {/* 2. Nome, marca, preço, gênero */}
          <section className="card">
            <div className="step-title">
              <Dot ok={ok2} n={2} />
              <h2>Nome, marca e preço</h2>
            </div>
            <div className="cols-3">
              <label className="label">
                Nome do perfume
                <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Khamrah" />
              </label>
              <label className="label">
                Marca
                <input className="field" value={brand} onChange={(e) => setBrand(e.target.value)} list="hl-brands" placeholder="Ex.: Lattafa" />
                <datalist id="hl-brands">{brands.map((b) => <option key={b.id} value={b.name} />)}</datalist>
              </label>
              <label className="label">
                Preço (R$)
                <input className="field" value={price} onChange={(e) => setPrice(e.target.value)} onBlur={() => priceNum !== null && setPrice(priceInput(priceNum))} inputMode="decimal" placeholder="0,00" style={{ fontWeight: 600 }} />
              </label>
            </div>
            {brand.trim() && brands.length > 0 && !brands.some((b) => b.name.toLowerCase() === brand.trim().toLowerCase()) && (
              <span className="notice warn">Marca nova: “{brand.trim()}” será cadastrada ao salvar.</span>
            )}
            {dup && <span className="notice warn">Já existe “{dup.name}” no catálogo. Confira se não é duplicado.</span>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>Gênero</span>
              <div className="seg">
                {GENDERS.map((g) => (
                  <button key={g} type="button" aria-pressed={gender === g} onClick={() => setGender(g)}>{g}</button>
                ))}
              </div>
            </div>
          </section>

          {/* 3. Categoria */}
          <section className="card">
            <div className="step-title">
              <Dot ok={ok3} n={3} />
              <h2>Categoria</h2>
            </div>
            <div className="cats">
              {cats.map((c) => (
                <button key={c.id} type="button" aria-pressed={catId === c.id} onClick={() => setCatId(c.id)}>
                  <b>{c.name}</b>
                  <small>{catId === c.id ? 'Selecionada' : c.coming_soon ? 'Ainda “em breve” na loja' : 'Ativa na loja'}</small>
                </button>
              ))}
            </div>
          </section>

          {/* 4. Descrição */}
          <section className="card">
            <div className="step-title">
              <Dot ok={ok4} n={4} />
              <h2>Descrição</h2>
              <button type="button" className="btn btn-sm" style={{ marginLeft: 'auto', borderColor: 'var(--gold)', background: 'var(--gold-soft)', color: '#6b4f1e', fontWeight: 600 }} onClick={() => setDesc(generateDescription(name, brand, gender, category?.name || ''))}>
                ✦ Gerar descrição
              </button>
            </div>
            <label className="label">
              <span className="sr-only">Descrição</span>
              <textarea className="field" rows={4} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Toque em Gerar descrição ou escreva aqui." />
            </label>
          </section>
        </div>

        {/* Prévia */}
        <aside className="preview">
          <div className="card" style={{ padding: 18, gap: 12 }}>
            <span className="cap">Prévia do card na loja</span>
            <div className="pv-img">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {finalUrl && <img src={finalUrl} alt="" />}
              <span className="pv-tag">{gender || 'Gênero'}</span>
            </div>
            <span style={{ fontSize: 11, letterSpacing: 2.4, textTransform: 'uppercase', color: 'var(--bronze)' }}>{brand.trim() || 'Marca'}</span>
            <span className="serif" style={{ fontSize: 26, lineHeight: 1.05, marginTop: -6 }}>{name.trim() || 'Nome do perfume'}</span>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #eee7da', paddingTop: 10 }}>
              <span>{formatPrice(priceNum)}</span>
              <span style={{ fontSize: 11, letterSpacing: 2 }}>SABER MAIS —</span>
            </div>
          </div>
          {missing.length > 0 && <p style={{ margin: 0, fontSize: 13, color: 'var(--mute)' }}>Para {editing ? 'salvar' : 'publicar'}, falta: <b style={{ color: 'var(--ink)' }}>{missing.join(', ')}</b></p>}
          {err && <div className="notice err" role="alert">{err}</div>}
          <button className="btn btn-ink" style={{ height: 54 }} disabled={missing.length > 0 || saving} onClick={submit}>
            {saving ? 'Salvando…' : editing ? 'SALVAR ALTERAÇÕES' : 'PUBLICAR NA LOJA'}
          </button>
        </aside>
      </div>

      <div className="sticky-bar sticky-bar-mobile-only">
        <button className="btn btn-ink" disabled={missing.length > 0 || saving} onClick={submit}>
          {saving ? 'Salvando…' : missing.length ? `Falta: ${missing[0]}` : editing ? 'SALVAR' : 'PUBLICAR'}
        </button>
      </div>

      {done && (
        <div className="veil">
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="ok-title" style={{ width: 'min(540px, 100%)', flexDirection: 'row', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {finalUrl && <img src={finalUrl} alt="" style={{ width: 140, height: 186, objectFit: 'cover', borderRadius: 12, background: '#000' }} />}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minWidth: 220 }}>
              <span style={{ fontSize: 12, letterSpacing: 2, color: 'var(--ok)', fontWeight: 700 }}>✓ {editing ? 'ALTERAÇÕES SALVAS' : 'OFERTA PUBLICADA'}</span>
              <h2 id="ok-title">{name}</h2>
              <span style={{ fontSize: 14 }}>{brand} · {category?.name} · {formatPrice(priceNum)}</span>
              <span style={{ fontSize: 13, color: 'var(--mute)' }}>Aparece na loja em até 1 minuto.</span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                <button className="btn btn-ink btn-sm" onClick={() => router.push('/')}>Ver na lista</button>
                {!editing && <button className="btn btn-sm" onClick={reset}>Criar outra</button>}
                <a className="btn btn-sm" href={STORE_URL} target="_blank" rel="noopener noreferrer">Abrir loja ↗</a>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

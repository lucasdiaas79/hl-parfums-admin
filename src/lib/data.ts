import { supabase, SUPABASE_URL } from './supabase';

export type Status = 'active' | 'sold_out' | 'hidden' | 'trashed';
export type Gender = 'Feminino' | 'Masculino' | 'Unissex';

export type Offer = {
  id: string;
  slug: string;
  name: string;
  brand_id: string;
  category_id: string;
  gender: Gender;
  price: number | null;
  description: string;
  status: Status;
  featured: boolean;
  trashed_at: string | null;
  updated_at: string;
  brand: string;
  category: string;
  image: string;
};
export type Brand = { id: string; name: string; slug: string };
export type Category = { id: string; name: string; slug: string; coming_soon: boolean };

const SELECT =
  'id,slug,name,brand_id,category_id,gender,price,description,status,featured,trashed_at,updated_at,brands(name),categories(name),product_images(path,position)';

type Row = Omit<Offer, 'brand' | 'category' | 'image'> & {
  brands: { name: string } | null;
  categories: { name: string } | null;
  product_images: { path: string; position: number }[];
};

export function imageUrl(path?: string) {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  if (!path.includes('/')) return `/fotos/${path}`; // fotos do catálogo inicial (cópia no próprio painel)
  return `${SUPABASE_URL}/storage/v1/object/public/fotos/${path}`;
}

function toOffer(r: Row): Offer {
  const img = [...(r.product_images || [])].sort((a, b) => a.position - b.position)[0];
  return {
    ...r,
    price: r.price === null ? null : Number(r.price),
    brand: r.brands?.name || '',
    category: r.categories?.name || '',
    image: imageUrl(img?.path),
  };
}

export async function listOffers(trash = false): Promise<Offer[]> {
  let q = supabase.from('products').select(SELECT).order('position', { ascending: true }).order('created_at', { ascending: false });
  q = trash ? q.eq('status', 'trashed') : q.neq('status', 'trashed');
  const { data, error } = await q;
  if (error) throw error;
  return (data as unknown as Row[]).map(toOffer);
}

export async function getOffer(id: string): Promise<Offer> {
  const { data, error } = await supabase.from('products').select(SELECT).eq('id', id).single();
  if (error) throw error;
  return toOffer(data as unknown as Row);
}

export async function listBrands(): Promise<Brand[]> {
  const { data, error } = await supabase.from('brands').select('id,name,slug').order('name');
  if (error) throw error;
  return data as Brand[];
}

export async function listCategories(): Promise<Category[]> {
  const { data, error } = await supabase.from('categories').select('id,name,slug,coming_soon').order('position');
  if (error) throw error;
  return data as Category[];
}

export async function updateOffer(id: string, patch: Partial<Pick<Offer, 'price' | 'status' | 'name' | 'description' | 'gender' | 'brand_id' | 'category_id' | 'featured' | 'trashed_at'>>) {
  const { error } = await supabase.from('products').update(patch).eq('id', id);
  if (error) throw error;
}

export const moveToTrash = (id: string) => updateOffer(id, { status: 'trashed', trashed_at: new Date().toISOString() });
export const restoreFromTrash = (id: string) => updateOffer(id, { status: 'active', trashed_at: null });

export async function deleteForever(id: string) {
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) throw error;
}

export function slugify(s: string) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function ensureBrand(name: string, brands: Brand[]): Promise<string> {
  const found = brands.find((b) => b.name.toLowerCase() === name.trim().toLowerCase());
  if (found) return found.id;
  const { data, error } = await supabase
    .from('brands')
    .insert({ name: name.trim(), slug: slugify(name) })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function uploadPhoto(blob: Blob, base: string): Promise<string> {
  const path = `uploads/${slugify(base) || 'perfume'}-${Date.now().toString(36)}.webp`;
  const { error } = await supabase.storage.from('fotos').upload(path, blob, { contentType: 'image/webp', upsert: false });
  if (error) throw error;
  return path;
}

async function uniqueSlug(base: string) {
  const root = slugify(base) || 'perfume';
  const { data } = await supabase.from('products').select('slug').like('slug', `${root}%`);
  const taken = new Set((data || []).map((r: { slug: string }) => r.slug));
  if (!taken.has(root)) return root;
  let i = 2;
  while (taken.has(`${root}-${i}`)) i++;
  return `${root}-${i}`;
}

export type OfferInput = {
  name: string;
  brandName: string;
  price: number;
  gender: Gender;
  categoryId: string;
  description: string;
  photo?: Blob | null;
};

export async function createOffer(input: OfferInput, brands: Brand[]): Promise<string> {
  const brand_id = await ensureBrand(input.brandName, brands);
  const slug = await uniqueSlug(`${input.name} ${input.brandName}`);
  const { data, error } = await supabase
    .from('products')
    .insert({
      slug,
      name: input.name.trim(),
      brand_id,
      category_id: input.categoryId,
      gender: input.gender,
      price: input.price,
      description: input.description.trim(),
      status: 'active',
      position: -Math.floor(Date.now() / 1000), // novos aparecem primeiro
    })
    .select('id')
    .single();
  if (error) throw error;
  if (input.photo) {
    const path = await uploadPhoto(input.photo, slug);
    const { error: e2 } = await supabase.from('product_images').insert({ product_id: data.id, path, position: 0 });
    if (e2) throw e2;
  }
  return data.id as string;
}

export async function saveOffer(id: string, input: OfferInput, brands: Brand[]) {
  const brand_id = await ensureBrand(input.brandName, brands);
  await updateOffer(id, {
    name: input.name.trim(),
    brand_id,
    category_id: input.categoryId,
    gender: input.gender,
    price: input.price,
    description: input.description.trim(),
  });
  if (input.photo) {
    const path = await uploadPhoto(input.photo, input.name);
    const { error: e1 } = await supabase.from('product_images').delete().eq('product_id', id);
    if (e1) throw e1;
    const { error: e2 } = await supabase.from('product_images').insert({ product_id: id, path, position: 0 });
    if (e2) throw e2;
  }
}

export function parsePrice(v: string): number | null {
  const n = parseFloat(v.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
  return isNaN(n) || n <= 0 ? null : Math.round(n * 100) / 100;
}

export function formatPrice(v: number | null) {
  if (v === null) return '—';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function priceInput(v: number | null) {
  return v === null ? '' : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function generateDescription(name: string, brand: string, gender: Gender | '', category: string) {
  const g = gender === 'Feminino' ? 'feminino' : gender === 'Masculino' ? 'masculino' : 'unissex';
  const arab = category === 'Árabes' ? ', com a assinatura marcante da perfumaria árabe' : '';
  const n = name.trim() || 'Este perfume';
  const b = brand.trim();
  return `${n} é um perfume ${g}${b ? ` da ${b}` : ''}${arab}. Uma fragrância de presença, para quem gosta de ser lembrado. Para saber notas, fixação e projeção, fale com a nossa consultora pelo WhatsApp.`;
}

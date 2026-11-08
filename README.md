# HL Parfums — Painel administrativo

Painel de gestão do catálogo da HL Parfums (loja: repositório `hl-parfums`). Os dois apps são independentes e usam o mesmo banco no Supabase.

## Funções
- Login pelo número (sem +55) e senha — internamente `NUMERO@hlparfums.app` no Supabase Auth
- Ofertas: busca, filtros, preço editável na linha, Disponível/Esgotado, excluir → Lixeira (com Desfazer)
- Nova oferta: foto (fundo removido no navegador e trocado por preto, 675×900 WebP) → nome, marca, preço, gênero → categoria → descrição (gerar automática)
- Editar oferta, Lixeira (restaurar / apagar de vez; limpeza automática após 30 dias), trocar senha

## Publicar na Vercel
Add New → Project → importar `lucasdiaas79/hl-parfums-admin` → Next.js → Deploy. Depois, Settings → Domains para o domínio do painel.

Variável recomendada: `NEXT_PUBLIC_STORE_URL` = endereço final da loja (botão "Ver loja"). As demais têm padrão (`.env.example`).

## Acesso
Para criar um novo administrador: Supabase → Authentication → Users → Add user (e-mail `NUMERO@hlparfums.app`, Auto confirm) e inserir o `user_id` na tabela `public.admins`.

O banco (migrações e regras) fica no repositório da loja, pasta `supabase/`.

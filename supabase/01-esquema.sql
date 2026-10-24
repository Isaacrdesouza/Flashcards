-- =============================================================
-- Flash Cards · Esquema do banco no Supabase (PostgreSQL)
-- Como usar: Supabase → SQL Editor → New query → cole tudo → Run.
-- Pode rodar de novo sem problema (usa "if not exists").
--
-- Ideia geral
--   • Cada linha pertence a um usuário (user_id). As regras de segurança
--     (RLS) garantem que cada pessoa só lê e grava os próprios dados.
--   • Os ids são os mesmos que o site já gera (texto), para a importação
--     do backup e a sincronização entre aparelhos usarem o mesmo id.
--   • "apagado" + "atualizado_em" permitem sincronizar PC e tablet:
--     nada é apagado de verdade na hora; a versão mais recente vence.
--   • Imagens ficam no Storage (bucket "imagens"), na pasta do usuário.
-- =============================================================

-- ---------- Função que atualiza "atualizado_em" a cada alteração ----------
create or replace function public.marcar_atualizacao()
returns trigger language plpgsql as $$
begin
  new.atualizado_em := now();
  return new;
end $$;

-- ---------- Matérias ----------
create table if not exists public.materias (
  id             text primary key,
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome           text not null,
  cor            text not null default '#5aa9ff',
  dias           smallint[] not null default '{}',       -- 0 = domingo … 6 = sábado
  prova          date,                                   -- data da prova (opcional)
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  apagado        boolean not null default false
);

-- ---------- Assuntos (2º nível) ----------
create table if not exists public.assuntos (
  id             text primary key,
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  materia_id     text not null,
  nome           text not null,
  atualizado_em  timestamptz not null default now(),
  apagado        boolean not null default false
);

-- ---------- Frentes (3º nível) ----------
create table if not exists public.frentes (
  id             text primary key,
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  assunto_id     text not null,
  nome           text not null,
  atualizado_em  timestamptz not null default now(),
  apagado        boolean not null default false
);

-- ---------- Cartões ----------
create table if not exists public.cartoes (
  id             text primary key,
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  materia_id     text not null,
  assunto_id     text not null,
  frente_id      text not null,
  tipo           text not null default 'basico' check (tipo in ('basico', 'lacuna', 'imagem')),
  frente         text not null default '',               -- pergunta / frase / instrução
  verso          text not null default '',               -- resposta / observação
  imagem         jsonb,                                  -- { id, alt, sobreposicoes: [...] }
  imagem_verso   jsonb,                                  -- { id, alt } imagem anexada à resposta
  suspenso       boolean not null default false,
  corrigido_em   timestamptz,                            -- acertou depois de errar (sai da lista de errados)
  rep            jsonb not null default '{}'::jsonb,     -- agendamento (estado, intervalo, vencimento…)
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  apagado        boolean not null default false
);

-- ---------- Histórico de respostas (só cresce: uma linha por resposta) ----------
create table if not exists public.revisoes (
  id             text primary key,
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  cartao_id      text not null,
  materia_id     text,
  data           date not null,                          -- dia da resposta
  ts             timestamptz not null,                   -- momento exato
  resposta       smallint not null check (resposta between 1 and 4),
  novo           boolean not null default false
);

-- ---------- Plano semanal ----------
create table if not exists public.planos (
  id             text primary key,
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  semana         date not null,                          -- segunda-feira da semana
  assunto_id     text not null,
  frente_id      text,
  dia            smallint check (dia between 0 and 6),   -- vazio = qualquer dia
  feito          boolean not null default false,
  atualizado_em  timestamptz not null default now(),
  apagado        boolean not null default false
);

-- ---------- Lixeira (itens excluídos, restauráveis por 30 dias) ----------
create table if not exists public.lixeira (
  id             text primary key,
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tipo           text not null,                          -- materia | assunto | grupo | cartao | cartoes
  nome           text not null,
  origem         text not null default '',
  excluido_em    timestamptz not null default now(),
  dados          jsonb not null,                         -- tudo o que foi excluído junto
  atualizado_em  timestamptz not null default now(),
  apagado        boolean not null default false
);

-- ---------- Ajustes do usuário (uma linha por pessoa) ----------
create table if not exists public.ajustes (
  user_id        uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  config         jsonb not null default '{}'::jsonb,     -- tema, meta, novos por dia…
  livre_por_dia  jsonb not null default '{}'::jsonb,     -- respostas da revisão livre por dia
  atualizado_em  timestamptz not null default now()
);

-- ---------- Índices (buscas por usuário e sincronização por data) ----------
create index if not exists materias_sync  on public.materias (user_id, atualizado_em);
create index if not exists assuntos_sync  on public.assuntos (user_id, atualizado_em);
create index if not exists frentes_sync   on public.frentes  (user_id, atualizado_em);
create index if not exists cartoes_sync   on public.cartoes  (user_id, atualizado_em);
create index if not exists cartoes_frente on public.cartoes  (user_id, frente_id);
create index if not exists revisoes_dia   on public.revisoes (user_id, data);
create index if not exists revisoes_card  on public.revisoes (user_id, cartao_id);
create index if not exists planos_semana  on public.planos   (user_id, semana);
create index if not exists lixeira_sync   on public.lixeira  (user_id, atualizado_em);

-- ---------- Gatilhos de "atualizado_em" ----------
do $$
declare t text;
begin
  foreach t in array array['materias', 'assuntos', 'frentes', 'cartoes', 'planos', 'lixeira', 'ajustes'] loop
    execute format('drop trigger if exists %I_atualizado on public.%I', t, t);
    execute format('create trigger %I_atualizado before update on public.%I
                    for each row execute function public.marcar_atualizacao()', t, t);
  end loop;
end $$;

-- ---------- Segurança: cada usuário só acessa as próprias linhas (RLS) ----------
do $$
declare t text;
begin
  foreach t in array array['materias', 'assuntos', 'frentes', 'cartoes', 'revisoes', 'planos', 'lixeira', 'ajustes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "dono le" on public.%I', t);
    execute format('drop policy if exists "dono cria" on public.%I', t);
    execute format('drop policy if exists "dono altera" on public.%I', t);
    execute format('drop policy if exists "dono apaga" on public.%I', t);
    execute format('create policy "dono le" on public.%I for select to authenticated using (user_id = auth.uid())', t);
    execute format('create policy "dono cria" on public.%I for insert to authenticated with check (user_id = auth.uid())', t);
    execute format('create policy "dono altera" on public.%I for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format('create policy "dono apaga" on public.%I for delete to authenticated using (user_id = auth.uid())', t);
  end loop;
end $$;

-- ---------- Imagens: bucket privado, cada usuário só na própria pasta ----------
-- Caminho dos arquivos: <id do usuário>/<id da imagem>
insert into storage.buckets (id, name, public)
values ('imagens', 'imagens', false)
on conflict (id) do nothing;

drop policy if exists "imagens dono le" on storage.objects;
drop policy if exists "imagens dono cria" on storage.objects;
drop policy if exists "imagens dono altera" on storage.objects;
drop policy if exists "imagens dono apaga" on storage.objects;

create policy "imagens dono le" on storage.objects for select to authenticated
  using (bucket_id = 'imagens' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "imagens dono cria" on storage.objects for insert to authenticated
  with check (bucket_id = 'imagens' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "imagens dono altera" on storage.objects for update to authenticated
  using (bucket_id = 'imagens' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "imagens dono apaga" on storage.objects for delete to authenticated
  using (bucket_id = 'imagens' and (storage.foldername(name))[1] = auth.uid()::text);

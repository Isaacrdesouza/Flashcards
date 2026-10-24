/* =============================================================
   nuvem.js — Conta e sincronização com o Supabase
   O site continua guardando tudo no navegador (abre rápido e funciona
   sem internet). Com a conta conectada, as mudanças vão para o banco
   na nuvem e as feitas em outro aparelho são trazidas para cá.

   Como a sincronização funciona
   1. Descobre o que mudou aqui desde a última vez (compara uma "impressão
      digital" de cada linha com a guardada na última sincronização).
   2. Traz da nuvem o que mudou lá desde a última vez. Se a mesma linha
      também mudou aqui, vale a versão daqui (ela será enviada em seguida).
   3. Envia as mudanças daqui (novas, alteradas e excluídas).
   4. Sincroniza as imagens (envia as que faltam lá, baixa as que faltam aqui).

   Chave pública (publishable): pode ficar no site. A segurança está nas
   regras do banco (cada usuário só acessa as próprias linhas).
   NUNCA coloque aqui a chave secreta (secret / service_role).
   ============================================================= */
'use strict';

const Nuvem = (() => {
  const URL_PROJETO = 'https://ueblukjqatjnpnctfulw.supabase.co';
  const CHAVE_PUBLICA = 'sb_publishable_UXPa04MH_YnVNj3z_dBlXw_9CHyYWeT';
  const BUCKET = 'imagens';
  const LOTE = 500;          // linhas por envio
  const PAGINA = 1000;       // linhas por leitura

  let cli = null;
  let usuario = null;
  let situacao = 'desconectado'; // desconectado | sincronizando | ok | offline | erro | indisponivel
  let ultimoErro = '';
  let ultimaSync = null;
  let rodando = false, pendente = false, timer = null;
  let gravandoDaNuvem = false;   // evita sincronizar de novo por causa do próprio salvamento
  let appAberto = false;         // os dados da conta já foram carregados e o site está na tela
  let saindo = false;            // saída pedida neste aparelho (não é preciso recarregar sozinho)
  const ouvintes = [];
  // Termina quando a primeira sincronização deste acesso acabar (com sucesso ou não)
  let avisarPrimeira;
  const primeira = new Promise(r => { avisarPrimeira = r; });

  /* ---------- Situação (para a tela de conta e o indicador do menu) ---------- */
  const status = () => ({ situacao, usuario, ultimoErro, ultimaSync, conectado: !!usuario });
  const aoMudar = fn => {
    ouvintes.push(fn);
    fn(status());
    return () => { const i = ouvintes.indexOf(fn); if (i >= 0) ouvintes.splice(i, 1); };
  };
  function definir(s, erro = '') {
    situacao = s; ultimoErro = erro;
    ouvintes.forEach(fn => { try { fn(status()); } catch (e) { console.error(e); } });
  }

  /* ---------- Utilidades ---------- */
  const iso = ms => (ms ? new Date(ms).toISOString() : null);
  const ms = texto => (texto ? new Date(texto).getTime() : null);
  /** JSON com as chaves em ordem (o banco devolve campos JSON em outra ordem) */
  function estavel(v) {
    if (Array.isArray(v)) return '[' + v.map(estavel).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => JSON.stringify(k) + ':' + estavel(v[k])).join(',') + '}';
    return JSON.stringify(v ?? null);
  }
  /** Impressão digital curta de um objeto (cyrb53), igual para o mesmo conteúdo */
  function hash(obj) {
    const str = estavel(obj);
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  }
  const pedacos = (lista, n) => Array.from({ length: Math.ceil(lista.length / n) }, (_, i) => lista.slice(i * n, i * n + n));

  /* ---------- Memória da sincronização (por usuário, neste aparelho) ---------- */
  const chaveMeta = () => `flashcards-sync-${usuario.id}`;
  function lerMeta() {
    try { return { puxadoAte: null, h: {}, imgs: {}, ...JSON.parse(localStorage.getItem(chaveMeta()) || '{}') }; }
    catch { return { puxadoAte: null, h: {}, imgs: {} }; }
  }
  function gravarMeta(meta) {
    try { localStorage.setItem(chaveMeta(), JSON.stringify(meta)); } catch (e) { console.error(e); }
  }

  /* =========================================================
     COMO CADA TABELA VIRA LINHA DO BANCO (e volta)
     ========================================================= */
  const TABELAS = [
    {
      nome: 'materias',
      lista: d => d.materias,
      paraLinha: m => ({ id: m.id, nome: m.nome, cor: m.cor, dias: m.dias || [], prova: m.prova || null, criado_em: iso(m.criadoEm) }),
      deLinha: r => ({ id: r.id, nome: r.nome, cor: r.cor, dias: r.dias || [], prova: r.prova || null, criadoEm: ms(r.criado_em) }),
      aplicar: (d, obj) => trocar(d.materias, obj),
      remover: (d, id) => { d.materias = d.materias.filter(x => x.id !== id); },
    },
    {
      nome: 'assuntos',
      lista: d => d.assuntos,
      paraLinha: a => ({ id: a.id, materia_id: a.materiaId, nome: a.nome }),
      deLinha: r => ({ id: r.id, materiaId: r.materia_id, nome: r.nome }),
      aplicar: (d, obj) => trocar(d.assuntos, obj),
      remover: (d, id) => { d.assuntos = d.assuntos.filter(x => x.id !== id); },
    },
    {
      nome: 'frentes',
      lista: d => d.grupos,
      paraLinha: g => ({ id: g.id, assunto_id: g.assuntoId, nome: g.nome }),
      deLinha: r => ({ id: r.id, assuntoId: r.assunto_id, nome: r.nome }),
      aplicar: (d, obj) => trocar(d.grupos, obj),
      remover: (d, id) => { d.grupos = d.grupos.filter(x => x.id !== id); },
    },
    {
      nome: 'cartoes',
      lista: d => d.cartoes,
      paraLinha: c => ({
        id: c.id, materia_id: c.materiaId, assunto_id: c.assuntoId, frente_id: c.grupoId,
        tipo: c.tipo || 'basico', frente: c.frente || '', verso: c.verso || '',
        imagem: c.imagem || null, imagem_verso: c.imagemVerso || null,
        suspenso: !!c.suspenso, corrigido_em: iso(c.corrigidoEm), rep: c.rep || {}, criado_em: iso(c.criadoEm),
      }),
      deLinha: r => {
        const c = {
          id: r.id, materiaId: r.materia_id, assuntoId: r.assunto_id, grupoId: r.frente_id,
          tipo: r.tipo, frente: r.frente, verso: r.verso, imagem: r.imagem || null, imagemVerso: r.imagem_verso || null,
          criadoEm: ms(r.criado_em), rep: { ...Repeticao.novo(), ...(r.rep || {}) },
        };
        if (r.suspenso) c.suspenso = true;
        if (r.corrigido_em) c.corrigidoEm = ms(r.corrigido_em);
        return c;
      },
      aplicar: (d, obj) => trocar(d.cartoes, obj),
      remover: (d, id) => { d.cartoes = d.cartoes.filter(x => x.id !== id); },
    },
    {
      nome: 'planos',
      lista: d => Object.entries(d.planos).flatMap(([semana, itens]) => itens.map(i => ({ ...i, semana }))),
      paraLinha: i => ({ id: i.id, semana: i.semana, assunto_id: i.assuntoId, frente_id: i.grupoId || null, dia: i.dia ?? null, feito: !!i.feito }),
      deLinha: r => ({ id: r.id, semana: r.semana, assuntoId: r.assunto_id, grupoId: r.frente_id || null, dia: r.dia ?? null, feito: !!r.feito }),
      aplicar: (d, obj) => {
        removerPlano(d, obj.id);
        const { semana, ...item } = obj;
        (d.planos[semana] = d.planos[semana] || []).push(item);
      },
      remover: (d, id) => removerPlano(d, id),
    },
    {
      nome: 'lixeira',
      lista: d => d.lixeira,
      paraLinha: x => ({ id: x.id, tipo: x.tipo, nome: x.nome, origem: x.origem || '', excluido_em: iso(x.excluidoEm), dados: x.dados }),
      deLinha: r => ({ id: r.id, tipo: r.tipo, nome: r.nome, origem: r.origem || '', excluidoEm: ms(r.excluido_em), dados: r.dados }),
      aplicar: (d, obj) => trocar(d.lixeira, obj),
      remover: (d, id) => { d.lixeira = d.lixeira.filter(x => x.id !== id); },
    },
    {
      // Histórico: só cresce. Uma resposta desfeita ("Anterior") é apagada de verdade.
      nome: 'revisoes', semApagado: true,
      lista: d => d.historico,
      paraLinha: r => ({ id: r.id, cartao_id: r.cartaoId, materia_id: r.materiaId || null, data: r.data, ts: iso(r.ts), resposta: r.resposta, novo: !!r.novo }),
      deLinha: r => ({ id: r.id, data: r.data, ts: ms(r.ts), cartaoId: r.cartao_id, materiaId: r.materia_id, resposta: r.resposta, novo: !!r.novo }),
      aplicar: (d, obj) => { if (!d.historico.some(x => x.id === obj.id)) d.historico.push(obj); },
      remover: (d, id) => { d.historico = d.historico.filter(x => x.id !== id); },
    },
  ];

  function trocar(lista, obj) {
    const i = lista.findIndex(x => x.id === obj.id);
    if (i >= 0) lista[i] = obj; else lista.push(obj);
  }
  function removerPlano(d, id) {
    for (const semana of Object.keys(d.planos)) d.planos[semana] = d.planos[semana].filter(x => x.id !== id);
  }

  /** Ajustes que valem para todos os aparelhos (tema e último backup são de cada aparelho) */
  const ajustesLinha = d => {
    const { ultimoBackup, tema, ...config } = d.config;
    return { config, livre_por_dia: d.livrePorDia || {} };
  };

  /** Respostas antigas não tinham id: cria um id fixo (cartão + horário) */
  function garantirIdsHistorico(d) {
    let mudou = false;
    d.historico.forEach(r => { if (!r.id) { r.id = `${r.cartaoId}_${r.ts}`; mudou = true; } });
    return mudou;
  }

  /* =========================================================
     SINCRONIZAR
     ========================================================= */
  function agendar(espera = 2500) {
    if (!usuario || !cli || !appAberto) return;
    clearTimeout(timer);
    timer = setTimeout(sincronizar, espera);
  }

  /** Lê todas as linhas de uma tabela alteradas desde `desde` (em páginas) */
  async function lerTudo(tabela, desde, campo = 'atualizado_em', colunas = '*') {
    const linhas = [];
    for (let de = 0; ; de += PAGINA) {
      let q = cli.from(tabela).select(colunas).order(campo, { ascending: true }).range(de, de + PAGINA - 1);
      if (desde) q = q.gte(campo, desde);
      const { data, error } = await q;
      if (error) throw error;
      linhas.push(...data);
      if (data.length < PAGINA) return linhas;
    }
  }

  async function sincronizar() {
    if (!usuario || !cli || !appAberto) return;
    if (rodando) { pendente = true; return; }
    if (!navigator.onLine) { definir('offline'); avisarPrimeira(); return; }
    rodando = true;
    definir('sincronizando');
    try {
      const d = Estado.bruto();
      const meta = lerMeta();
      let mudouLocal = garantirIdsHistorico(d);
      const primeiraVez = !meta.jaSincronizou;

      // ---- 1. O que mudou aqui desde a última sincronização ----
      const sujos = {};
      for (const t of TABELAS) {
        const antes = meta.h[t.nome] || {};
        sujos[t.nome] = new Set(t.lista(d).filter(o => antes[o.id] !== hash(t.paraLinha(o))).map(o => o.id));
      }
      const ajustesSujos = meta.hAjustes !== hash(ajustesLinha(d));
      // Excluídos aqui e ainda não enviados: não podem "voltar" com o que vem da nuvem
      const excluidosAqui = {};
      for (const t of TABELAS) {
        const presentes = new Set(t.lista(d).map(o => o.id));
        excluidosAqui[t.nome] = new Set(Object.keys(meta.h[t.nome] || {}).filter(id => !presentes.has(id)));
      }

      // ---- 2. Trazer o que mudou na nuvem ----
      // Volta 2 s no tempo para não perder gravações feitas no mesmo instante por outro aparelho
      const desde = meta.puxadoAte ? new Date(ms(meta.puxadoAte) - 2000).toISOString() : null;
      let puxadoAte = meta.puxadoAte;
      for (const t of TABELAS) {
        const h = (meta.h[t.nome] = meta.h[t.nome] || {});
        let linhas;
        if (t.semApagado) {
          // Histórico não tem data de alteração: compara a lista de ids e baixa só os que faltam aqui
          const ids = await lerTudo(t.nome, null, 'id', 'id');
          const aqui = new Set(d.historico.map(r => r.id));
          const faltam = ids.map(x => x.id).filter(id => !aqui.has(id) && !(id in h));
          linhas = [];
          for (const parte of pedacos(faltam, 200)) {
            const { data, error } = await cli.from(t.nome).select('*').in('id', parte);
            if (error) throw error;
            linhas.push(...data);
          }
        } else {
          linhas = await lerTudo(t.nome, desde);
        }
        for (const r of linhas) {
          if (r.atualizado_em && (!puxadoAte || r.atualizado_em > puxadoAte)) puxadoAte = r.atualizado_em;
          if (sujos[t.nome].has(r.id) || excluidosAqui[t.nome].has(r.id)) continue; // mudou aqui também: vale a versão daqui
          if (r.apagado) {
            if (t.lista(d).some(o => o.id === r.id)) { t.remover(d, r.id); mudouLocal = true; }
            delete h[r.id];
          } else {
            const obj = t.deLinha(r);
            const novoHash = hash(t.paraLinha(obj));
            if (h[r.id] !== novoHash || !t.lista(d).some(o => o.id === r.id)) { t.aplicar(d, obj); mudouLocal = true; }
            h[r.id] = novoHash;
          }
        }
      }
      // Ajustes: na primeira sincronização deste aparelho, valem os da nuvem (se existirem)
      {
        const { data, error } = await cli.from('ajustes').select('*').maybeSingle();
        if (error) throw error;
        if (data && (primeiraVez || !ajustesSujos) && hash({ config: data.config, livre_por_dia: data.livre_por_dia }) !== meta.hAjustes) {
          const { ultimoBackup, tema } = d.config;
          d.config = { ...d.config, ...data.config, ultimoBackup, tema };
          d.livrePorDia = { ...(data.livre_por_dia || {}) };
          meta.hAjustes = hash(ajustesLinha(d));
          mudouLocal = true;
        }
      }

      // ---- 3. Enviar o que mudou aqui ----
      for (const t of TABELAS) {
        const h = meta.h[t.nome];
        const atuais = t.lista(d);
        const idsAtuais = new Set(atuais.map(o => o.id));
        const enviar = atuais.filter(o => h[o.id] !== hash(t.paraLinha(o)));
        for (const parte of pedacos(enviar, LOTE)) {
          const linhas = parte.map(o => (t.semApagado ? t.paraLinha(o) : { ...t.paraLinha(o), apagado: false }));
          const { error } = await cli.from(t.nome).upsert(linhas, { onConflict: 'id' });
          if (error) throw error;
          parte.forEach(o => { h[o.id] = hash(t.paraLinha(o)); });
        }
        // Excluídos aqui: marca como apagado lá (o histórico é apagado de verdade)
        const removidos = Object.keys(h).filter(id => !idsAtuais.has(id));
        for (const parte of pedacos(removidos, 200)) {
          const q = t.semApagado ? cli.from(t.nome).delete().in('id', parte) : cli.from(t.nome).update({ apagado: true }).in('id', parte);
          const { error } = await q;
          if (error) throw error;
          parte.forEach(id => { delete h[id]; });
        }
      }
      if (meta.hAjustes !== hash(ajustesLinha(d))) {
        const { error } = await cli.from('ajustes').upsert({ user_id: usuario.id, ...ajustesLinha(d) }, { onConflict: 'user_id' });
        if (error) throw error;
        meta.hAjustes = hash(ajustesLinha(d));
      }

      // ---- 4. Imagens ----
      if (await sincronizarImagens(d, meta)) mudouLocal = true;

      // Só usa horários do servidor (o relógio deste aparelho pode estar adiantado ou atrasado)
      meta.puxadoAte = puxadoAte || null;
      meta.jaSincronizou = true;
      gravarMeta(meta);
      if (mudouLocal) {
        gravandoDaNuvem = true;
        await Estado.salvar();
        gravandoDaNuvem = false;
        // Redesenha a página para mostrar o que chegou (menos no meio de uma sessão de estudo)
        if (!document.body.classList.contains('modo-estudo') && !document.querySelector('dialog[open]')) Rotas.recarregar();
      }
      ultimaSync = Date.now();
      definir('ok');
    } catch (erro) {
      console.error('Sincronização:', erro);
      definir(navigator.onLine ? 'erro' : 'offline', explicarErro(erro));
    } finally {
      rodando = false;
      avisarPrimeira();
      if (pendente) { pendente = false; agendar(1000); }
    }
  }

  /** Envia imagens que ainda não estão na nuvem e baixa as que faltam aqui */
  async function sincronizarImagens(d, meta) {
    const usadas = new Set();
    const juntar = c => { if (c.imagem?.id) usadas.add(c.imagem.id); if (c.imagemVerso?.id) usadas.add(c.imagemVerso.id); };
    d.cartoes.forEach(juntar);
    d.lixeira.forEach(x => (x.dados?.cartoes || []).forEach(juntar));
    const bucket = cli.storage.from(BUCKET);
    const caminho = id => `${usuario.id}/${id}`;
    let baixou = false;
    for (const id of usadas) {
      if (meta.imgs[id]) continue;
      const local = await Banco.lerImagem(id);
      if (local) {
        const blob = await (await fetch(local)).blob();
        const { error } = await bucket.upload(caminho(id), blob, { upsert: true, contentType: blob.type || 'image/webp' });
        if (error) throw error;
        meta.imgs[id] = true;
      } else {
        const { data, error } = await bucket.download(caminho(id));
        if (error || !data) continue;   // ainda não chegou de outro aparelho: tenta na próxima
        await Banco.salvarImagem(id, await blobParaDataUrl(data));
        meta.imgs[id] = true;
        baixou = true;
      }
    }
    // Imagens que nenhum cartão usa mais (ex.: lixeira esvaziada): apaga da nuvem
    const sobrando = Object.keys(meta.imgs).filter(id => !usadas.has(id));
    for (const parte of pedacos(sobrando, 100)) {
      const { error } = await bucket.remove(parte.map(caminho));
      if (error) throw error;
      parte.forEach(id => { delete meta.imgs[id]; });
    }
    return baixou;
  }

  const blobParaDataUrl = blob => new Promise((ok, falha) => {
    const leitor = new FileReader();
    leitor.onload = () => ok(leitor.result);
    leitor.onerror = falha;
    leitor.readAsDataURL(blob);
  });

  function explicarErro(e) {
    const msg = String(e?.message || e || '');
    if (/does not exist|PGRST205|schema cache|relation/i.test(msg)) return 'As tabelas não foram encontradas no Supabase. Rode o arquivo supabase/01-esquema.sql no SQL Editor.';
    if (/Bucket not found/i.test(msg)) return 'O espaço de imagens não existe. Rode de novo o 01-esquema.sql no SQL Editor.';
    if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) return 'Sem conexão com a nuvem. As mudanças ficam guardadas aqui e são enviadas depois.';
    if (/JWT|token|not authorized|permission|row-level security/i.test(msg)) return 'Sessão expirada ou sem permissão. Saia e entre de novo na conta.';
    return msg || 'Erro desconhecido ao sincronizar.';
  }

  /* =========================================================
     CONTA (entrar, criar, recuperar senha, sair)
     ========================================================= */
  const CHAVE_SESSAO = 'flashcards-auth';
  /** Endereço para onde os links do e-mail voltam (só funciona com o site publicado em http/https) */
  const voltarPara = () => (/^https?:$/.test(location.protocol) ? location.origin + location.pathname : undefined);
  const exigirCliente = () => { if (!cli) throw new Error('Não foi possível carregar a conexão com a nuvem. Recarregue a página.'); };

  async function entrar(email, senha) {
    exigirCliente();
    const { data, error } = await cli.auth.signInWithPassword({ email, password: senha });
    if (error) throw new Error(traduzirAuth(error.message));
    usuario = data.user;
    return data.user;
  }

  /** Cria a conta. Devolve { usuario } quando já entra direto, ou { precisaConfirmar: true } */
  async function criarConta(email, senha) {
    exigirCliente();
    const { data, error } = await cli.auth.signUp({ email, password: senha, options: { emailRedirectTo: voltarPara() } });
    if (error) throw new Error(traduzirAuth(error.message));
    // O Supabase não avisa que o e-mail já existe (por segurança): devolve um usuário sem identidades
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      throw new Error('Este e-mail já tem conta. Use "Entrar" ou "Esqueci a senha".');
    }
    if (data.session) { usuario = data.user; return { usuario: data.user }; }
    return { precisaConfirmar: true };
  }

  async function reenviarConfirmacao(email) {
    exigirCliente();
    const { error } = await cli.auth.resend({ type: 'signup', email, options: { emailRedirectTo: voltarPara() } });
    if (error) throw new Error(traduzirAuth(error.message));
  }

  async function recuperarSenha(email) {
    exigirCliente();
    const { error } = await cli.auth.resetPasswordForEmail(email, { redirectTo: voltarPara() });
    if (error) throw new Error(traduzirAuth(error.message));
  }

  /** Entra com o código de 6 dígitos do e-mail de "Esqueci a senha" */
  async function entrarComCodigo(email, codigo) {
    exigirCliente();
    const { data, error } = await cli.auth.verifyOtp({ email, token: codigo, type: 'recovery' });
    if (error) throw new Error(traduzirAuth(error.message));
    usuario = data.user;
    return data.user;
  }

  async function trocarSenha(nova) {
    exigirCliente();
    const { data, error } = await cli.auth.updateUser({ password: nova });
    if (error) throw new Error(traduzirAuth(error.message));
    if (data.user) usuario = data.user;
  }

  /** Sai da conta. Antes tenta enviar o que ainda não foi para a nuvem. */
  async function sair({ apagarDesteAparelho = false } = {}) {
    clearTimeout(timer);
    if (usuario && navigator.onLine) { try { await sincronizar(); } catch (e) { console.error(e); } }
    const uid = usuario?.id;
    saindo = true;
    try {
      const { error } = await cli.auth.signOut({ scope: 'local' });
      if (error) throw error;
    } catch (e) {
      // Sem internet o Supabase não consegue avisar o servidor: esquece a sessão só neste aparelho
      console.warn(e);
      try { localStorage.removeItem(CHAVE_SESSAO); } catch { /* ignorado */ }
    }
    if (apagarDesteAparelho && uid) {
      try { localStorage.removeItem(`flashcards-sync-${uid}`); } catch { /* ignorado */ }
      await Banco.limparTudo();
      try { indexedDB.deleteDatabase(`estudos-flashcards-${uid}`); } catch { /* ignorado */ }
    }
    usuario = null;
    definir('desconectado');
  }

  /** Esta conta já sincronizou neste navegador antes? */
  const jaSincronizouAqui = uid => { try { return !!JSON.parse(localStorage.getItem(`flashcards-sync-${uid}`) || '{}').jaSincronizou; } catch { return false; } };
  /** Esquece a memória da sincronização (usado quando o banco local da conta começa vazio) */
  const esquecerSincronizacao = uid => { try { localStorage.removeItem(`flashcards-sync-${uid}`); } catch { /* ignorado */ } };

  function traduzirAuth(m) {
    if (/Invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos.';
    if (/Email not confirmed/i.test(m)) return 'Você ainda não confirmou o e-mail. Abra o link que enviamos e tente de novo.';
    if (/already registered|already exists/i.test(m)) return 'Este e-mail já tem conta. Use "Entrar" ou "Esqueci a senha".';
    if (/should be different|same.*password/i.test(m)) return 'A senha nova precisa ser diferente da atual.';
    if (/Password should be|at least|weak/i.test(m)) return 'A senha precisa ter pelo menos 6 caracteres.';
    if (/invalid.*email|email.*invalid|valid email/i.test(m)) return 'Este e-mail não parece válido.';
    if (/expired|invalid.*(otp|token)|token.*invalid/i.test(m)) return 'Código inválido ou expirado. Peça um novo e-mail.';
    if (/rate limit|too many|security purposes|only request this after/i.test(m)) return 'Muitas tentativas seguidas. Espere um minuto e tente de novo.';
    if (/signups? not allowed|disabled/i.test(m)) return 'A criação de contas está desligada no momento.';
    if (/Failed to fetch|NetworkError|Load failed|fetch/i.test(m)) return 'Sem conexão com a internet. Verifique a rede e tente de novo.';
    return m;
  }

  /* =========================================================
     INÍCIO
     ========================================================= */

  /** Lê a volta de um link do e-mail (#access_token=…&type=… ou #error=…) e limpa o endereço */
  function lerRetornoDoEmail() {
    const bruto = location.hash.replace(/^#/, '') + '&' + location.search.replace(/^\?/, '');
    if (!/(^|&)(access_token|error_description)=/.test(bruto)) return null;
    const p = Object.fromEntries(new URLSearchParams(bruto));
    history.replaceState(null, '', location.pathname + '#/inicio');
    return p;
  }

  /** Sessão salva neste aparelho (para abrir o site sem internet) */
  function sessaoGuardada() {
    try { return JSON.parse(localStorage.getItem(CHAVE_SESSAO) || 'null'); } catch { return null; }
  }

  const comPrazo = (promessa, ms) => Promise.race([promessa, new Promise((_, falha) => setTimeout(() => falha(new Error('tempo esgotado')), ms))]);

  /**
   * Prepara a conexão e descobre se há alguém conectado.
   * Devolve { usuario, novaSenha, aviso }: novaSenha = veio do link "Esqueci a senha".
   */
  async function iniciar() {
    const resultado = { usuario: null, novaSenha: false, aviso: '' };
    if (!window.supabase || !window.supabase.createClient) {
      definir('indisponivel', 'Biblioteca do Supabase não carregou.');
      resultado.aviso = 'Não foi possível carregar a conexão com a nuvem. Recarregue a página.';
      return resultado;
    }
    cli = window.supabase.createClient(URL_PROJETO, CHAVE_PUBLICA, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: CHAVE_SESSAO },
    });

    // Voltou de um link do e-mail (confirmação de conta ou nova senha)?
    const retorno = lerRetornoDoEmail();
    if (retorno?.access_token) {
      try {
        const { data, error } = await cli.auth.setSession({ access_token: retorno.access_token, refresh_token: retorno.refresh_token });
        if (error) throw error;
        usuario = data.user;
        resultado.novaSenha = retorno.type === 'recovery';
        if (retorno.type === 'signup') resultado.aviso = 'E-mail confirmado! Bem-vindo.';
      } catch (e) {
        console.error(e);
        resultado.aviso = 'O link do e-mail expirou ou já foi usado. Entre com sua senha ou peça um novo link.';
      }
    } else if (retorno?.error_description) {
      resultado.aviso = /expired|invalid/i.test(retorno.error_description)
        ? 'O link do e-mail expirou ou já foi usado. Peça um novo.'
        : retorno.error_description.replace(/\+/g, ' ');
    }

    if (!usuario) {
      try {
        const { data } = await comPrazo(cli.auth.getSession(), 8000);
        usuario = data.session?.user || null;
      } catch (e) { console.warn(e); }
      // Sem internet a sessão não pode ser renovada agora, mas continua válida neste aparelho
      if (!usuario) usuario = sessaoGuardada()?.user || null;
    }

    cli.auth.onAuthStateChange((evento, sessao) => {
      const novo = sessao?.user || null;
      if (!appAberto) return;
      if (evento === 'SIGNED_OUT' && !saindo) { voltarParaEntrada(); return; }  // saiu em outra aba ou a sessão foi encerrada
      if (novo && usuario && novo.id !== usuario.id) { voltarParaEntrada(); return; }  // outra conta entrou em outra aba
      if (novo) usuario = novo;
      if (evento === 'SIGNED_IN' || evento === 'TOKEN_REFRESHED') agendar(500);
    });

    resultado.usuario = usuario;
    definir(usuario ? 'ok' : 'desconectado');
    return resultado;
  }

  /** Recarrega o site, que abre na tela de entrada */
  function voltarParaEntrada() {
    history.replaceState(null, '', location.pathname + '#/inicio');
    location.reload();
  }

  /** Liga a sincronização automática (chamado depois que os dados da conta foram carregados) */
  function comecar() {
    if (!cli || !usuario || appAberto) { avisarPrimeira(); return; }
    appAberto = true;
    // Sincroniza: ao alterar algo, ao voltar a internet, ao voltar para a aba e a cada minuto
    Estado.aoSalvar(() => { if (!gravandoDaNuvem) agendar(2500); });
    window.addEventListener('online', () => agendar(0));
    window.addEventListener('offline', () => usuario && definir('offline'));
    document.addEventListener('visibilitychange', () => { if (!document.hidden) agendar(500); });
    setInterval(() => agendar(0), 60000);
    definir(navigator.onLine ? 'ok' : 'offline');
    agendar(300);
  }

  return {
    iniciar, comecar, status, aoMudar, primeiraSincronizacao: () => primeira,
    entrar, criarConta, reenviarConfirmacao, recuperarSenha, entrarComCodigo, trocarSenha, sair, voltarParaEntrada,
    jaSincronizouAqui, esquecerSincronizacao,
    sincronizarAgora: () => sincronizar(),
  };
})();

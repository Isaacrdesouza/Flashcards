/* =============================================================
   estado.js — Modelo de dados e todas as operações sobre ele
   Toda leitura/escrita de matérias, assuntos, cartões, histórico e
   planos passa por aqui. Depois de cada alteração chamamos salvar().

   Estrutura dos dados:
   {
     versao, config: { nomeNivel3, novosPorDia, animacoes, ultimoBackup, tema ('escuro'|'claro'|'sistema') },
     materias: [{ id, nome, cor, dias:[0..6], prova:'AAAA-MM-DD'|null, criadoEm }],
     assuntos: [{ id, materiaId, nome }],
     grupos:   [{ id, assuntoId, nome }]          ← 3º nível: "Frente" (nome configurável)
     cartoes:  [{ id, materiaId, assuntoId, grupoId (obrigatório), tipo ('basico'|'lacuna'|'imagem'), frente, verso,
                  imagem: { id, alt, sobreposicoes:[{id,x,y,l,a,texto}] } | null,
                  criadoEm, rep: {...ver repeticao.js} }],
     historico:[{ data, ts, cartaoId, materiaId, resposta, novo }],
     planos:   { 'AAAA-MM-DD (segunda)': [{ id, assuntoId, grupoId, dia, feito }] }
   }
   ============================================================= */
'use strict';

const Estado = (() => {
  const VERSAO = 1;
  const CONFIG_PADRAO = { nomeNivel3: 'Assunto', novosPorDia: 20, animacoes: true, ultimoBackup: null, modeloPastas: false, tema: 'escuro', metaDiaria: 0, livreContaMeta: true };
  /** Nome da frente criada automaticamente para guardar cartões antigos sem frente */
  const NOME_FRENTE_GERAL = 'Geral';

  let d = estadoVazio();

  function estadoVazio() {
    return {
      versao: VERSAO, config: { ...CONFIG_PADRAO },
      materias: [], assuntos: [], grupos: [], cartoes: [], historico: [], planos: {},
      lixeira: [],      // itens excluídos (restauráveis por 30 dias)
      livrePorDia: {},  // respostas da revisão livre por dia (para a meta)
    };
  }

  /** Garante que um objeto carregado tenha todos os campos esperados */
  function normalizar(e) {
    const base = estadoVazio();
    if (!e || typeof e !== 'object') return base;
    const r = { ...base, ...e, config: { ...base.config, ...(e.config || {}) } };
    for (const chave of ['materias', 'assuntos', 'grupos', 'cartoes', 'historico', 'lixeira']) {
      if (!Array.isArray(r[chave])) r[chave] = [];
    }
    if (!r.planos || typeof r.planos !== 'object') r.planos = {};
    if (!r.livrePorDia || typeof r.livrePorDia !== 'object') r.livrePorDia = {};
    r.cartoes.forEach(c => { c.rep = { ...Repeticao.novo(), ...(c.rep || {}) }; });
    r.materias.forEach(m => { if (!Array.isArray(m.dias)) m.dias = []; });
    migrarParaFrentes(r);
    return r;
  }

  /**
   * Modelo de pastas em 3 níveis (na tela: Matéria → Frente → Assunto; no código: materia → assunto → grupo).
   * Todo cartão fica dentro de um grupo (3º nível). Cartões antigos sem grupo vão para um grupo "Geral".
   * Devolve true se algo foi alterado (para gravar a mudança).
   */
  function migrarParaFrentes(r) {
    let mudou = false;
    // Troca o antigo nome padrão "Tópico" por "Frente" uma única vez
    if (!r.config.modeloPastas) {
      if (!r.config.nomeNivel3 || r.config.nomeNivel3 === 'Tópico') r.config.nomeNivel3 = 'Frente';
      r.config.modeloPastas = true;
      mudou = true;
    }
    // Ordem das pastas invertida: Matéria → Frente → Assunto. O 2º nível passa a se chamar
    // "Frente" e o 3º (antes "Frente") passa a "Assunto". Nomes personalizados são mantidos.
    if (!r.config.niveisInvertidos) {
      if (!r.config.nomeNivel3 || r.config.nomeNivel3 === 'Frente') r.config.nomeNivel3 = 'Assunto';
      r.config.niveisInvertidos = true;
      mudou = true;
    }
    const idsGrupos = new Set(r.grupos.map(g => g.id));
    const geralPorAssunto = {};
    for (const c of r.cartoes) {
      if (c.grupoId && idsGrupos.has(c.grupoId)) continue;
      let g = geralPorAssunto[c.assuntoId] ||
        r.grupos.find(x => x.assuntoId === c.assuntoId && x.nome === NOME_FRENTE_GERAL);
      if (!g) {
        g = { id: Util.gerarId(), assuntoId: c.assuntoId, nome: NOME_FRENTE_GERAL };
        r.grupos.push(g);
        idsGrupos.add(g.id);
      }
      geralPorAssunto[c.assuntoId] = g;
      c.grupoId = g.id;
      mudou = true;
    }
    r._migrado = mudou;
    return mudou;
  }

  /* ---------- Carregar e salvar ---------- */

  async function carregar() {
    d = normalizar(await Banco.lerEstado());
    const migrado = d._migrado;
    delete d._migrado;
    const limpou = limparLixeiraAntiga();
    if (migrado || limpou) await salvar();
  }

  // Fila de gravação: garante que os salvamentos aconteçam em ordem
  let filaSalvar = Promise.resolve();
  // Quem quer saber que os dados mudaram (ex.: a sincronização com a nuvem)
  const ouvintes = [];
  const aoSalvar = fn => ouvintes.push(fn);
  function salvar() {
    filaSalvar = filaSalvar
      .then(() => Banco.salvarEstado(d))
      .then(() => ouvintes.forEach(fn => { try { fn(); } catch (e) { console.error(e); } }))
      .catch(erro => {
        console.error(erro);
        Util.aviso('Não foi possível salvar. Faça um backup em Ajustes.', 'erro');
      });
    return filaSalvar;
  }

  /* ---------- Configurações ---------- */
  const config = () => d.config;
  function atualizarConfig(campos) { Object.assign(d.config, campos); salvar(); }

  /* ---------- Matérias ---------- */
  const materias = () => [...d.materias].sort(Util.porNome);
  const materia = id => d.materias.find(m => m.id === id);

  function criarMateria({ nome, cor, dias, prova }) {
    const m = { id: Util.gerarId(), nome, cor, dias: dias || [], prova: prova || null, criadoEm: Date.now() };
    d.materias.push(m);
    salvar();
    return m;
  }
  /** Atualiza a matéria. Se a data da prova mudou, reagenda o que passaria dela. Devolve quantos cartões mudaram. */
  function atualizarMateria(id, campos) {
    const m = materia(id);
    if (!m) return 0;
    const provaMudou = 'prova' in campos && campos.prova !== m.prova;
    Object.assign(m, campos);
    salvar();
    return provaMudou ? ajustarParaProva(id) : 0;
  }
  /** Exclui a matéria (vai para a lixeira com assuntos, frentes, cartões e planos) */
  function excluirMateria(id) {
    const m = materia(id);
    if (!m) return null;
    const pacote = { materias: [m], assuntos: [], grupos: [], cartoes: [], planos: [] };
    d.assuntos.filter(a => a.materiaId === id).forEach(a => juntar(pacote, tirarAssunto(a.id)));
    d.materias = d.materias.filter(x => x.id !== id);
    return paraLixeira('materia', m.nome, '', pacote);
  }

  /* ---------- Assuntos (2º nível) ---------- */
  const assuntosDe = materiaId => d.assuntos.filter(a => a.materiaId === materiaId).sort(Util.porNome);
  const assunto = id => d.assuntos.find(a => a.id === id);

  function criarAssunto(materiaId, nome) {
    const a = { id: Util.gerarId(), materiaId, nome };
    d.assuntos.push(a);
    salvar();
    return a;
  }
  function renomearAssunto(id, nome) { const a = assunto(id); if (a) { a.nome = nome; salvar(); } }
  /** Exclui o assunto com suas frentes e cartões (vai para a lixeira) */
  function excluirAssunto(id) {
    const a = assunto(id);
    if (!a) return null;
    const origem = (materia(a.materiaId) || {}).nome || '';
    return paraLixeira('assunto', a.nome, origem, tirarAssunto(id));
  }

  /** Tira o assunto (e o que há dentro) dos dados e devolve tudo num pacote */
  function tirarAssunto(id) {
    const a = assunto(id);
    const pacote = { assuntos: a ? [a] : [], grupos: d.grupos.filter(g => g.assuntoId === id), cartoes: tirarCartoes(c => c.assuntoId === id), planos: tirarPlanos(i => i.assuntoId === id) };
    d.grupos = d.grupos.filter(g => g.assuntoId !== id);
    d.assuntos = d.assuntos.filter(x => x.id !== id);
    return pacote;
  }

  /* ---------- Grupos (3º nível, nome livre: "Aula", "Capítulo"…) ---------- */
  const gruposDe = assuntoId => d.grupos.filter(g => g.assuntoId === assuntoId).sort(Util.porNome);
  const grupo = id => d.grupos.find(g => g.id === id);

  function criarGrupo(assuntoId, nome) {
    const g = { id: Util.gerarId(), assuntoId, nome };
    d.grupos.push(g);
    salvar();
    return g;
  }
  function renomearGrupo(id, nome) { const g = grupo(id); if (g) { g.nome = nome; salvar(); } }
  /** Exclui a frente com seus cartões (vai para a lixeira) */
  function excluirGrupo(id) {
    const g = grupo(id);
    if (!g) return null;
    const a = assunto(g.assuntoId);
    const origem = [a && (materia(a.materiaId) || {}).nome, a && a.nome].filter(Boolean).join(' › ');
    const pacote = { grupos: [g], cartoes: tirarCartoes(c => c.grupoId === id), planos: tirarPlanos(i => i.grupoId === id) };
    d.grupos = d.grupos.filter(x => x.id !== id);
    return paraLixeira('grupo', g.nome, origem, pacote);
  }

  /* ---------- Cartões ---------- */
  const cartao = id => d.cartoes.find(c => c.id === id);
  const totalCartoes = () => d.cartoes.length;

  /**
   * Lista cartões que atendem ao filtro.
   * filtro: { materiaId, materiaIds:[], assuntoId, grupoId, itensPlano:[{assuntoId, grupoId}] }
   */
  function cartoes(filtro = {}) {
    return d.cartoes.filter(c =>
      (!filtro.materiaId || c.materiaId === filtro.materiaId) &&
      (!filtro.materiaIds || filtro.materiaIds.includes(c.materiaId)) &&
      (!filtro.assuntoId || c.assuntoId === filtro.assuntoId) &&
      (!filtro.grupoId || c.grupoId === filtro.grupoId) &&
      (!filtro.ids || filtro.ids.includes(c.id)) &&
      (!filtro.itensPlano || filtro.itensPlano.some(i =>
        i.assuntoId === c.assuntoId && (!i.grupoId || i.grupoId === c.grupoId)))
    );
  }

  /** Cria um cartão. dados: { materiaId, assuntoId, grupoId, frente, verso, imagem } */
  function criarCartao(dados, gravar = true) {
    const c = {
      id: Util.gerarId(),
      materiaId: dados.materiaId,
      assuntoId: dados.assuntoId,
      grupoId: dados.grupoId || null,
      // 'basico' = frente e verso · 'lacuna' = ocultar palavra ({{palavra}} na frente) · 'imagem' = áreas ocultas
      tipo: ['lacuna', 'imagem'].includes(dados.tipo) ? dados.tipo : 'basico',
      frente: dados.frente || '',
      verso: dados.verso || '',
      imagem: dados.imagem || null,
      imagemVerso: dados.imagemVerso || null, // imagem anexada à resposta: { id, alt }
      criadoEm: Date.now(),
      // A importação do Anki pode trazer o progresso (intervalos) e cartões suspensos
      rep: dados.rep ? { ...Repeticao.novo(), ...dados.rep } : Repeticao.novo(),
    };
    if (dados.suspenso) c.suspenso = true;
    d.cartoes.push(c);
    if (gravar) salvar();
    return c;
  }

  /** Cria vários cartões de uma vez (importação em massa) */
  function criarCartoesEmLote(lista) {
    const criados = lista.map(item => criarCartao(item, false));
    salvar();
    return criados;
  }

  function atualizarCartao(id, campos) {
    const c = cartao(id);
    if (c) { Object.assign(c, campos); salvar(); }
  }

  /** Exclui um cartão (vai para a lixeira) */
  function excluirCartao(id) { return excluirCartoes([id]); }

  /** Remove cartões que atendem à condição (e suas imagens) */
  function removerCartoes(condicao) {
    tirarCartoes(condicao).forEach(apagarImagensDoCartao);
  }

  /* ---------- Ações em vários cartões (mover, suspender, excluir) ---------- */

  /** Move cartões para outra frente: destino = { grupoId } (matéria e assunto vêm da frente) */
  function moverCartoes(ids, grupoId) {
    const g = grupo(grupoId);
    const a = g && assunto(g.assuntoId);
    if (!a) return 0;
    let n = 0;
    for (const id of ids) {
      const c = cartao(id);
      if (c) { c.materiaId = a.materiaId; c.assuntoId = a.id; c.grupoId = g.id; n++; }
    }
    salvar();
    return n;
  }

  /** Suspende (tira do estudo sem apagar) ou reativa cartões */
  function suspenderCartoes(ids, suspenso = true) {
    let n = 0;
    for (const id of ids) {
      const c = cartao(id);
      if (c && !!c.suspenso !== suspenso) { c.suspenso = suspenso; n++; }
    }
    salvar();
    return n;
  }

  /** Exclui vários cartões de uma vez (um único item na lixeira) */
  function excluirCartoes(ids) {
    const conjunto = new Set(ids);
    const cs = tirarCartoes(c => conjunto.has(c.id));
    if (!cs.length) return null;
    const nome = cs.length === 1 ? (Util.resumir(Util.semFormatacao(Util.lacunaResumo(cs[0].frente)), 70) || cs[0].imagem?.alt || 'Cartão') : `${cs.length} cartões`;
    const c0 = cs[0];
    const origem = [(materia(c0.materiaId) || {}).nome, (assunto(c0.assuntoId) || {}).nome, (grupo(c0.grupoId) || {}).nome].filter(Boolean).join(' › ');
    return paraLixeira(cs.length === 1 ? 'cartao' : 'cartoes', nome, origem, { cartoes: cs });
  }

  /* ---------- Lixeira ----------
     Cada item guarda o que foi excluído junto (matéria, assuntos, frentes,
     cartões e itens de plano). Imagens só são apagadas ao excluir de vez. */
  const DIAS_LIXEIRA = 30;
  const lixeira = () => [...d.lixeira].sort((a, b) => b.excluidoEm - a.excluidoEm);

  function tirarCartoes(condicao) {
    const tirados = d.cartoes.filter(condicao);
    const ids = new Set(tirados.map(c => c.id));
    d.cartoes = d.cartoes.filter(c => !ids.has(c.id));
    return tirados;
  }
  function tirarPlanos(condicao) {
    const tirados = [];
    for (const semana of Object.keys(d.planos)) {
      d.planos[semana] = d.planos[semana].filter(item => {
        if (condicao(item)) { tirados.push({ semana, item }); return false; }
        return true;
      });
    }
    return tirados;
  }
  function juntar(pacote, outro) {
    for (const k of ['materias', 'assuntos', 'grupos', 'cartoes', 'planos']) {
      if (outro[k]) pacote[k] = [...(pacote[k] || []), ...outro[k]];
    }
    return pacote;
  }
  function paraLixeira(tipo, nome, origem, pacote) {
    const item = {
      id: Util.gerarId(), tipo, nome, origem, excluidoEm: Date.now(),
      dados: { materias: [], assuntos: [], grupos: [], cartoes: [], planos: [], ...pacote },
    };
    d.lixeira.push(item);
    salvar();
    return item.id;
  }

  /**
   * Restaura um item. Se a pasta onde ele estava também foi excluída, ela é
   * restaurada junto. Se não existir mais, os cartões vão para `destinoGrupoId`.
   * Retorna { ok: true } ou { ok: false, precisaDestino: true, motivo }.
   */
  function restaurar(itemId, destinoGrupoId = null) {
    const item = d.lixeira.find(x => x.id === itemId);
    if (!item) return { ok: false, motivo: 'Item não encontrado na lixeira.' };
    const dd = item.dados;
    const ids = k => new Set([...(d[k] || []).map(x => x.id), ...(dd[k] || []).map(x => x.id)]);
    // Pais que faltam: tenta trazê-los de outro item da lixeira
    const faltando = () => ({
      materias: dd.assuntos.filter(a => !ids('materias').has(a.materiaId)).map(a => a.materiaId),
      assuntos: dd.grupos.filter(g => !ids('assuntos').has(g.assuntoId)).map(g => g.assuntoId),
      grupos: dd.cartoes.filter(c => !ids('grupos').has(c.grupoId)).map(c => c.grupoId),
    });
    for (const [k, lista] of Object.entries(faltando())) {
      for (const pid of new Set(lista)) {
        const pai = d.lixeira.find(x => x.id !== itemId && (x.dados[k] || []).some(o => o.id === pid));
        if (pai) { const r = restaurar(pai.id, destinoGrupoId); if (!r.ok) return r; }
      }
    }
    const resta = faltando();
    if (resta.materias.length || resta.assuntos.length) return { ok: false, motivo: 'A pasta onde este item estava não existe mais.' };
    if (resta.grupos.length) {
      const g = destinoGrupoId && grupo(destinoGrupoId);
      if (!g) return { ok: false, precisaDestino: true, motivo: 'A frente onde estes cartões estavam foi apagada de vez. Escolha para onde restaurá-los.' };
      const a = assunto(g.assuntoId);
      dd.cartoes.forEach(c => { if (!ids('grupos').has(c.grupoId)) { c.grupoId = g.id; c.assuntoId = a.id; c.materiaId = a.materiaId; } });
    }
    const juntarSemRepetir = (k, lista) => { const ja = new Set(d[k].map(x => x.id)); d[k].push(...lista.filter(x => !ja.has(x.id))); };
    juntarSemRepetir('materias', dd.materias);
    juntarSemRepetir('assuntos', dd.assuntos);
    juntarSemRepetir('grupos', dd.grupos);
    juntarSemRepetir('cartoes', dd.cartoes);
    for (const { semana, item: p } of dd.planos || []) {
      if (!d.planos[semana]) d.planos[semana] = [];
      if (!d.planos[semana].some(x => x.id === p.id) && assunto(p.assuntoId)) d.planos[semana].push(p);
    }
    d.lixeira = d.lixeira.filter(x => x.id !== itemId);
    salvar();
    return { ok: true };
  }

  /** Apaga de vez um item da lixeira (e as imagens dos cartões dele) */
  function excluirDefinitivo(itemId, gravar = true) {
    const item = d.lixeira.find(x => x.id === itemId);
    if (!item) return;
    item.dados.cartoes.forEach(apagarImagensDoCartao);
    d.lixeira = d.lixeira.filter(x => x.id !== itemId);
    if (gravar) salvar();
  }
  function esvaziarLixeira() { [...d.lixeira].forEach(x => excluirDefinitivo(x.id, false)); salvar(); }

  /** Apaga de vez o que está na lixeira há mais de 30 dias. Devolve true se apagou algo. */
  function limparLixeiraAntiga() {
    const limite = Date.now() - DIAS_LIXEIRA * 86400000;
    const velhos = d.lixeira.filter(x => x.excluidoEm < limite);
    velhos.forEach(x => excluirDefinitivo(x.id, false));
    return velhos.length > 0;
  }
  function apagarImagensDoCartao(c) {
    if (c.imagem && c.imagem.id) Banco.apagarImagem(c.imagem.id);
    if (c.imagemVerso && c.imagemVerso.id) Banco.apagarImagem(c.imagemVerso.id);
  }

  /** Cartão participa do estudo? (suspensos ficam de fora) */
  const ativo = c => !c.suspenso;

  /** Zera o agendamento (o cartão volta a ser "novo") */
  function reiniciarCartao(id) { atualizarCartao(id, { rep: Repeticao.novo() }); }

  /* ---------- Data da prova ----------
     Até a prova, nenhum cartão da matéria é agendado para depois da véspera.
     Assim todos são revistos pelo menos uma vez antes do dia. */

  /** Último dia em que um cartão pode ficar agendado para estar revisado antes da prova */
  function limiteProva(m, h = Util.hoje()) {
    if (!m || !m.prova || m.prova <= h) return null;   // sem prova, ou prova hoje/já passou
    const vespera = Util.somarDias(m.prova, -1);
    return vespera > h ? vespera : m.prova;            // véspera é hoje → vale o próprio dia
  }
  function limitarPelaProva(c, vencimento, h = Util.hoje()) {
    const limite = limiteProva(materia(c.materiaId), h);
    return limite && vencimento && vencimento > limite ? limite : vencimento;
  }

  /**
   * Reagenda os cartões da matéria marcados para depois da véspera da prova,
   * espalhando-os entre amanhã e a véspera. Devolve quantos mudaram.
   */
  function ajustarParaProva(materiaId) {
    const m = materia(materiaId);
    const h = Util.hoje();
    const limite = limiteProva(m, h);
    if (!limite) return 0;
    const passam = d.cartoes.filter(c => c.materiaId === materiaId && !c.suspenso && c.rep.estado !== 'novo' && c.rep.vencimento > limite)
      .sort((a, b) => a.rep.vencimento.localeCompare(b.rep.vencimento));
    if (!passam.length) return 0;
    const dias = [];
    for (let dia = Util.somarDias(h, 1); dia <= limite; dia = Util.somarDias(dia, 1)) dias.push(dia);
    if (!dias.length) dias.push(limite);
    passam.forEach((c, i) => { c.rep = { ...c.rep, vencimento: dias[Math.floor(i * dias.length / passam.length)] }; });
    salvar();
    return passam.length;
  }

  /** Provas futuras com o progresso: [{ m, dias, total, novos, revisar, porDia }] */
  function provasFuturas() {
    const h = Util.hoje();
    return d.materias.filter(m => m.prova && m.prova >= h).map(m => {
      const cs = d.cartoes.filter(c => c.materiaId === m.id && !c.suspenso);
      const dias = Util.diferencaDias(h, m.prova);
      const novos = cs.filter(c => c.rep.estado === 'novo').length;
      const ate = m.prova;
      const revisar = cs.filter(c => c.rep.estado !== 'novo' && c.rep.vencimento && c.rep.vencimento < ate).length;
      return { m, dias, total: cs.length, novos, revisar, porDia: dias > 0 ? Math.ceil(novos / dias) : novos };
    }).sort((a, b) => a.m.prova.localeCompare(b.m.prova));
  }

  /* ---------- Revisões pendentes ---------- */

  /** O cartão precisa ser revisado hoje? (novos não contam aqui) */
  const estaVencido = (c, h = Util.hoje()) =>
    c.rep.estado !== 'novo' && !!c.rep.vencimento && c.rep.vencimento <= h;

  /** Quantos cartões novos foram estudados pela primeira vez hoje */
  function novosEstudadosHoje() {
    const h = Util.hoje();
    return d.cartoes.reduce((n, c) => n + (c.rep.introduzidoEm === h ? 1 : 0), 0);
  }

  /** Quantos cartões novos ainda podem ser liberados hoje (limite dos Ajustes) */
  const novosRestantesHoje = () => Math.max(0, d.config.novosPorDia - novosEstudadosHoje());

  /** Contagem de pendências para um filtro: { revisar, novos, total, novosDisponiveis } */
  function contarPendentes(filtro = {}) {
    const lista = cartoes(filtro).filter(ativo);
    const h = Util.hoje();
    let revisar = 0, novosDisponiveis = 0;
    for (const c of lista) {
      if (c.rep.estado === 'novo') novosDisponiveis++;
      else if (estaVencido(c, h)) revisar++;
    }
    const novos = Math.min(novosDisponiveis, novosRestantesHoje());
    return { revisar, novos, total: revisar + novos, novosDisponiveis, cartoes: lista.length };
  }

  /* ---------- Cartões atrasados ---------- */

  /** Cartões já estudados cuja revisão venceu ANTES de hoje (os de hoje não contam) */
  function atrasados(filtro = {}, h = Util.hoje()) {
    return cartoes(filtro)
      .filter(c => ativo(c) && c.rep.estado !== 'novo' && c.rep.vencimento && c.rep.vencimento < h)
      .sort((a, b) => a.rep.vencimento.localeCompare(b.rep.vencimento));
  }

  /** Quantas revisões já estão agendadas em cada dia: { 'AAAA-MM-DD': n } */
  function revisoesAgendadasPorDia(filtro = {}) {
    const mapa = {};
    for (const c of cartoes(filtro)) {
      if (ativo(c) && c.rep.estado !== 'novo' && c.rep.vencimento) mapa[c.rep.vencimento] = (mapa[c.rep.vencimento] || 0) + 1;
    }
    return mapa;
  }

  /** Muda a data de revisão de vários cartões de uma vez: { cartaoId: 'AAAA-MM-DD' } */
  function reagendarCartoes(novasDatas) {
    let n = 0;
    for (const [id, data] of Object.entries(novasDatas)) {
      const c = cartao(id);
      if (c && c.rep.estado !== 'novo') { c.rep = { ...c.rep, vencimento: data }; n++; }
    }
    salvar();
    return n;
  }

  /** Próxima data em que haverá revisão para o filtro (ou null) */
  function proximoVencimento(filtro = {}) {
    let menor = null;
    for (const c of cartoes(filtro)) {
      if (ativo(c) && c.rep.vencimento && (!menor || c.rep.vencimento < menor)) menor = c.rep.vencimento;
    }
    return menor;
  }

  /** Registra a resposta do usuário e reagenda o cartão */
  function registrarResposta(cartaoId, resposta) {
    const c = cartao(cartaoId);
    if (!c) return;
    const h = Util.hoje();
    const eraNovo = c.rep.estado === 'novo';
    c.rep = Repeticao.calcular(c.rep, resposta, h);
    if (eraNovo) c.rep.introduzidoEm = h;
    c.rep.vencimento = limitarPelaProva(c, c.rep.vencimento, h);
    d.historico.push({ data: h, ts: Date.now(), cartaoId, materiaId: c.materiaId, resposta, novo: eraNovo });
    salvar();
  }

  /**
   * Desfaz a última resposta de um cartão: devolve o agendamento anterior
   * e apaga o registro mais recente desse cartão no histórico.
   */
  function desfazerResposta(cartaoId, repAnterior) {
    const c = cartao(cartaoId);
    if (!c) return;
    c.rep = { ...repAnterior };
    for (let i = d.historico.length - 1; i >= 0; i--) {
      if (d.historico[i].cartaoId === cartaoId) { d.historico.splice(i, 1); break; }
    }
    salvar();
  }

  /* ---------- Plano semanal ---------- */
  const plano = semana => d.planos[semana] || [];

  function adicionarAoPlano(semana, item) {
    if (!d.planos[semana]) d.planos[semana] = [];
    d.planos[semana].push({ id: Util.gerarId(), feito: false, grupoId: null, dia: null, ...item });
    salvar();
  }
  function atualizarItemPlano(semana, itemId, campos) {
    const item = plano(semana).find(i => i.id === itemId);
    if (item) { Object.assign(item, campos); salvar(); }
  }
  function removerItemPlano(semana, itemId) {
    d.planos[semana] = plano(semana).filter(i => i.id !== itemId);
    salvar();
  }
  /** Copia os itens de uma semana para outra (desmarcados) */
  function copiarPlano(origem, destino) {
    const itens = plano(origem).map(i => ({ ...i, id: Util.gerarId(), feito: false }));
    d.planos[destino] = [...plano(destino), ...itens];
    salvar();
    return itens.length;
  }

  /* ---------- Histórico e estatísticas ---------- */

  /** Primeiro dia considerado num período: 'tudo' ou número de dias (ex.: 7, 30) */
  const inicioPeriodo = periodo => (periodo === 'tudo' ? '0000-00-00' : Util.somarDias(Util.hoje(), -(Number(periodo) - 1)));

  /**
   * Cartões respondidos com "Errei" no período e ainda não corrigidos,
   * do mais errado para o menos. [{ cartao, erros, respostas, ultimoErro }]
   * Um cartão sai da lista quando é respondido certo depois do último erro
   * (no estudo normal ou na revisão dos errados).
   */
  function cartoesErrados(periodo = 30) {
    const desde = inicioPeriodo(periodo);
    const mapa = {};
    const ultimoAcerto = {};
    for (const r of d.historico) {
      if (r.resposta > 1 && (!ultimoAcerto[r.cartaoId] || r.ts > ultimoAcerto[r.cartaoId])) ultimoAcerto[r.cartaoId] = r.ts;
      if (r.data < desde) continue;
      const x = mapa[r.cartaoId] || (mapa[r.cartaoId] = { erros: 0, respostas: 0, ultimoErro: null });
      x.respostas++;
      if (r.resposta === 1) { x.erros++; if (!x.ultimoErro || r.ts > x.ultimoErro) x.ultimoErro = r.ts; }
    }
    const corrigido = (id, x) => {
      const c = cartao(id);
      const acerto = Math.max(ultimoAcerto[id] || 0, (c && c.corrigidoEm) || 0);
      return acerto > x.ultimoErro;
    };
    return Object.entries(mapa)
      .filter(([id, x]) => x.erros > 0 && cartao(id) && !corrigido(id, x))
      .map(([id, x]) => ({ cartao: cartao(id), ...x }))
      .sort((a, b) => b.erros - a.erros || b.ultimoErro - a.ultimoErro);
  }

  /** Marca (ou desmarca) que o cartão foi respondido certo fora da agenda (revisão livre) */
  function marcarCorrigido(cartaoId, quando = Date.now()) {
    const c = cartao(cartaoId);
    if (!c) return;
    if (quando) c.corrigidoEm = quando; else delete c.corrigidoEm;
    salvar();
  }

  /** Conta uma resposta da revisão livre (não muda a agenda, mas pode contar na meta) */
  function registrarLivre() {
    const h = Util.hoje();
    d.livrePorDia[h] = (d.livrePorDia[h] || 0) + 1;
    // Guarda só os últimos 60 dias
    const limite = Util.somarDias(h, -60);
    Object.keys(d.livrePorDia).forEach(k => { if (k < limite) delete d.livrePorDia[k]; });
    salvar();
  }
  function desfazerLivre() {
    const h = Util.hoje();
    if (d.livrePorDia[h] > 0) { d.livrePorDia[h]--; salvar(); }
  }

  /** Revisões feitas hoje (para a meta diária). Inclui a revisão livre se a opção estiver ligada. */
  const revisoesHoje = () => {
    const h = Util.hoje();
    const agenda = d.historico.reduce((n, r) => n + (r.data === h ? 1 : 0), 0);
    return agenda + (d.config.livreContaMeta ? (d.livrePorDia[h] || 0) : 0);
  };
  const historico = () => d.historico;

  /** { 'AAAA-MM-DD': quantidade de revisões } */
  function revisoesPorDia() {
    const mapa = {};
    for (const r of d.historico) mapa[r.data] = (mapa[r.data] || 0) + 1;
    return mapa;
  }

  /** Sequência de dias estudados: { atual, maior, estudouHoje } */
  function sequencia() {
    const mapa = revisoesPorDia();
    const h = Util.hoje();
    let dia = mapa[h] ? h : Util.somarDias(h, -1); // hoje ainda dá tempo de estudar
    let atual = 0;
    while (mapa[dia]) { atual++; dia = Util.somarDias(dia, -1); }

    let maior = 0, contagem = 0, anterior = null;
    for (const data of Object.keys(mapa).sort()) {
      contagem = anterior && Util.diferencaDias(anterior, data) === 1 ? contagem + 1 : 1;
      maior = Math.max(maior, contagem);
      anterior = data;
    }
    return { atual, maior, estudouHoje: !!mapa[h] };
  }

  /* ---------- Backup ---------- */

  /** Monta o objeto completo de backup (dados + imagens) */
  async function exportar() {
    return {
      app: 'estudos-flashcards',
      versao: VERSAO,
      exportadoEm: new Date().toISOString(),
      dados: d,
      imagens: await Banco.todasImagens(),
    };
  }

  /** Substitui tudo pelo conteúdo de um backup */
  async function importar(backup) {
    if (!backup || backup.app !== 'estudos-flashcards' || !backup.dados) {
      throw new Error('Este arquivo não é um backup válido deste site.');
    }
    await Banco.limparTudo();
    for (const [id, dataUrl] of Object.entries(backup.imagens || {})) {
      await Banco.salvarImagem(id, dataUrl);
    }
    d = normalizar(backup.dados);
    delete d._migrado;
    await salvar();
  }

  function registrarBackup() { d.config.ultimoBackup = new Date().toISOString(); salvar(); }

  async function apagarTudo() {
    await Banco.limparTudo();
    d = estadoVazio();
    await salvar();
  }

  return {
    carregar, salvar, config, atualizarConfig,
    materias, materia, criarMateria, atualizarMateria, excluirMateria,
    assuntosDe, assunto, criarAssunto, renomearAssunto, excluirAssunto,
    gruposDe, grupo, criarGrupo, renomearGrupo, excluirGrupo,
    cartoes, cartao, totalCartoes, criarCartao, criarCartoesEmLote, atualizarCartao, excluirCartao, reiniciarCartao,
    moverCartoes, suspenderCartoes, excluirCartoes, ativo, desfazerResposta,
    lixeira, restaurar, excluirDefinitivo, esvaziarLixeira, DIAS_LIXEIRA,
    registrarLivre, desfazerLivre, limiteProva, ajustarParaProva, provasFuturas,
    estaVencido, atrasados, revisoesAgendadasPorDia, reagendarCartoes, novosRestantesHoje, contarPendentes, proximoVencimento, registrarResposta,
    plano, adicionarAoPlano, atualizarItemPlano, removerItemPlano, copiarPlano,
    historico, revisoesPorDia, sequencia, inicioPeriodo, cartoesErrados, marcarCorrigido, revisoesHoje,
    exportar, importar, registrarBackup, apagarTudo,
    aoSalvar, bruto: () => d,  // usados pela sincronização (nuvem.js)
  };
})();

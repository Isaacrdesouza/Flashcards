/* =============================================================
   banco.js — Armazenamento local no navegador
   Usa IndexedDB (aguenta muitos cartões e imagens).
   Se o IndexedDB não estiver disponível, cai para o localStorage.

   Cada conta tem o seu próprio banco local ("estudos-flashcards-<id>"),
   assim duas pessoas no mesmo navegador não misturam cartões.
   O banco sem conta ("estudos-flashcards") é o de antes do login:
   na primeira entrada ele pode ser levado para a conta (ver app.js).

   Duas "gavetas":
     • dados   → um único registro 'estado' com matérias, cartões, histórico…
     • imagens → cada imagem salva separadamente (id → dataURL)
   ============================================================= */
'use strict';

const Banco = (() => {
  const NOME_LEGADO = 'estudos-flashcards';
  const VERSAO_BANCO = 1;
  let db = null;
  let usandoLocalStorage = false;
  let prefixo = 'fc-';   // chaves do plano B (localStorage), separadas por conta

  /** Abre um banco IndexedDB pelo nome (cria as gavetas na primeira vez) */
  function abrirIDB(nome) {
    return new Promise((resolve, reject) => {
      let req;
      try { req = indexedDB.open(nome, VERSAO_BANCO); } catch (e) { return reject(e); }
      req.onupgradeneeded = () => {
        const banco = req.result;
        if (!banco.objectStoreNames.contains('dados')) banco.createObjectStore('dados');
        if (!banco.objectStoreNames.contains('imagens')) banco.createObjectStore('imagens');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  /** Abre o banco da conta. Deve ser chamado uma vez ao iniciar. */
  async function abrir(usuarioId) {
    prefixo = usuarioId ? `fc-${usuarioId}-` : 'fc-';
    if (!('indexedDB' in window)) { usandoLocalStorage = true; return; }
    try { db = await abrirIDB(usuarioId ? `${NOME_LEGADO}-${usuarioId}` : NOME_LEGADO); }
    catch (e) { console.warn('IndexedDB indisponível, usando localStorage.', e); usandoLocalStorage = true; }
  }

  /** Executa uma operação em uma gaveta e devolve o resultado (Promise) */
  function operar(gaveta, modo, acao, banco = db) {
    return new Promise((resolve, reject) => {
      const transacao = banco.transaction(gaveta, modo);
      const pedido = acao(transacao.objectStore(gaveta));
      transacao.oncomplete = () => resolve(pedido ? pedido.result : undefined);
      transacao.onerror = () => reject(transacao.error);
      transacao.onabort = () => reject(transacao.error);
    });
  }

  /* ---------- Plano B: localStorage (limite de ~5 MB) ---------- */
  const LS = {
    ler: chave => { try { return JSON.parse(localStorage.getItem(chave)); } catch { return null; } },
    gravar: (chave, valor) => localStorage.setItem(chave, JSON.stringify(valor)),
  };
  const chaveEstado = () => prefixo + 'estado';
  const prefixoImg = () => prefixo + 'img:';

  /* ---------- API pública ---------- */

  async function lerEstado() {
    if (usandoLocalStorage) return LS.ler(chaveEstado());
    return operar('dados', 'readonly', g => g.get('estado'));
  }

  async function salvarEstado(estado) {
    if (usandoLocalStorage) return LS.gravar(chaveEstado(), estado);
    return operar('dados', 'readwrite', g => g.put(estado, 'estado'));
  }

  // Cache em memória para não ler a mesma imagem do disco várias vezes
  const cacheImagens = new Map();

  async function lerImagem(id) {
    if (!id) return null;
    if (cacheImagens.has(id)) return cacheImagens.get(id);
    const valor = usandoLocalStorage
      ? localStorage.getItem(prefixoImg() + id)
      : await operar('imagens', 'readonly', g => g.get(id));
    if (valor) cacheImagens.set(id, valor);
    return valor || null;
  }

  async function salvarImagem(id, dataUrl) {
    cacheImagens.set(id, dataUrl);
    if (usandoLocalStorage) return localStorage.setItem(prefixoImg() + id, dataUrl);
    return operar('imagens', 'readwrite', g => g.put(dataUrl, id));
  }

  async function apagarImagem(id) {
    cacheImagens.delete(id);
    if (usandoLocalStorage) return localStorage.removeItem(prefixoImg() + id);
    return operar('imagens', 'readwrite', g => g.delete(id));
  }

  /** Devolve todas as imagens como objeto { id: dataURL } (usado no backup) */
  async function todasImagens(banco = db) {
    const resultado = {};
    if (usandoLocalStorage) {
      for (let i = 0; i < localStorage.length; i++) {
        const chave = localStorage.key(i);
        if (chave.startsWith(prefixoImg())) resultado[chave.slice(prefixoImg().length)] = localStorage.getItem(chave);
      }
      return resultado;
    }
    return new Promise((resolve, reject) => {
      const transacao = banco.transaction('imagens', 'readonly');
      const cursor = transacao.objectStore('imagens').openCursor();
      cursor.onsuccess = () => {
        const c = cursor.result;
        if (c) { resultado[c.key] = c.value; c.continue(); }
      };
      transacao.oncomplete = () => resolve(resultado);
      transacao.onerror = () => reject(transacao.error);
    });
  }

  /** Apaga absolutamente tudo (dados e imagens) */
  async function limparTudo() {
    cacheImagens.clear();
    if (usandoLocalStorage) {
      Object.keys(localStorage)
        .filter(k => k === chaveEstado() || k.startsWith(prefixoImg()))
        .forEach(k => localStorage.removeItem(k));
      return;
    }
    await operar('dados', 'readwrite', g => g.clear());
    await operar('imagens', 'readwrite', g => g.clear());
  }

  /** Pede ao navegador para não apagar os dados automaticamente quando faltar espaço */
  async function pedirPersistencia() {
    try {
      if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist();
    } catch { /* ignorado */ }
    return false;
  }

  /* ---------- Dados de antes do login (banco sem conta) ---------- */

  /** Lê o banco antigo, sem conta. Devolve { estado, imagens } ou null se estiver vazio. */
  async function lerLegado() {
    if (usandoLocalStorage) {
      const estado = LS.ler('fc-estado');
      if (!estado || prefixo === 'fc-') return null;
      const imagens = {};
      Object.keys(localStorage).filter(k => k.startsWith('fc-img:')).forEach(k => { imagens[k.slice(7)] = localStorage.getItem(k); });
      return { estado, imagens };
    }
    // Não cria o banco antigo se ele nunca existiu
    if (indexedDB.databases) {
      try { if (!(await indexedDB.databases()).some(b => b.name === NOME_LEGADO)) return null; } catch { /* segue */ }
    }
    let antigo;
    try { antigo = await abrirIDB(NOME_LEGADO); } catch { return null; }
    try {
      const estado = await operar('dados', 'readonly', g => g.get('estado'), antigo);
      if (!estado) return null;
      return { estado, imagens: await todasImagens(antigo) };
    } finally { antigo.close(); }
  }

  /** Copia as imagens de um objeto { id: dataURL } para o banco atual */
  async function gravarImagens(imagens) {
    for (const [id, dataUrl] of Object.entries(imagens || {})) await salvarImagem(id, dataUrl);
  }

  return {
    abrir, lerLegado, gravarImagens, lerEstado, salvarEstado,
    lerImagem, salvarImagem, apagarImagem, todasImagens,
    limparTudo, pedirPersistencia,
    get usandoLocalStorage() { return usandoLocalStorage; },
  };
})();

/* =============================================================
   anki.js — Leitura de pacotes do Anki (.apkg / .colpkg)

   O .apkg é um arquivo .zip com:
     • collection.anki21b  banco SQLite comprimido com zstd (Anki 2.1.50+)
       ou collection.anki21 / collection.anki2 (formatos antigos)
     • media               lista das imagens (JSON antigo ou protobuf+zstd)
     • 0, 1, 2…            os arquivos de imagem/som (no formato novo, comprimidos)

   As bibliotecas (fflate, fzstd e sql.js) ficam em js/vendor e só são
   carregadas quando alguém importa um arquivo.

   Cada cartão do Anki vira um cartão daqui:
     • Básico / Invertido / modelos próprios → Flashcard (frente e verso)
     • Omissão de palavras (Cloze)           → Ocultação de palavras ({{palavra}})
     • Image Occlusion                       → Cartão de imagem com áreas ocultas
     • Imagem na frente                      → Cartão de imagem (sem áreas)
   ============================================================= */
'use strict';

const Anki = (() => {
  /* =========================================================
     BIBLIOTECAS (carregadas sob demanda)
     ========================================================= */
  let carregando = null;
  const carregarScript = src => new Promise((ok, falha) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = ok;
    s.onerror = () => falha(new Error(`Não foi possível carregar ${src}`));
    document.head.appendChild(s);
  });
  function bibliotecas() {
    if (!carregando) {
      carregando = (async () => {
        if (!window.fflate) await carregarScript('js/vendor/fflate.js');
        if (!window.fzstd) await carregarScript('js/vendor/fzstd.js');
        if (!window.initSqlJs) await carregarScript('js/vendor/sql-wasm.js');
        if (!window.SQL_WASM_BASE64) await carregarScript('js/vendor/sql-wasm-binario.js');
        const bin = Uint8Array.from(atob(window.SQL_WASM_BASE64), c => c.charCodeAt(0));
        const SQL = await window.initSqlJs({ wasmBinary: bin });
        return { fflate: window.fflate, fzstd: window.fzstd, SQL };
      })().catch(e => { carregando = null; throw e; });
    }
    return carregando;
  }

  /* =========================================================
     UTILIDADES
     ========================================================= */
  const utf8 = new TextDecoder('utf-8');
  const ehZstd = b => b && b.length > 4 && b[0] === 0x28 && b[1] === 0xb5 && b[2] === 0x2f && b[3] === 0xfd;

  /** Leitor mínimo de protobuf: devolve [campo, tipo, valor] */
  function proto(bytes) {
    const out = [];
    let i = 0;
    const varint = () => { let r = 0, s = 1, b; do { b = bytes[i++]; r += (b & 0x7f) * s; s *= 128; } while (b & 0x80 && i < bytes.length); return r; };
    while (i < bytes.length) {
      const chave = varint(), campo = Math.floor(chave / 8), tipo = chave & 7;
      if (tipo === 0) out.push([campo, tipo, varint()]);
      else if (tipo === 2) { const n = varint(); out.push([campo, tipo, bytes.subarray(i, i + n)]); i += n; }
      else if (tipo === 1) i += 8;
      else if (tipo === 5) i += 4;
      else break;
    }
    return out;
  }
  const textoProto = (lista, campo) => { const x = lista.find(([c, t]) => c === campo && t === 2); return x ? utf8.decode(x[2]) : ''; };

  const linhas = (db, sql) => {
    const r = db.exec(sql)[0];
    if (!r) return [];
    return r.values.map(v => Object.fromEntries(r.columns.map((c, i) => [c, v[i]])));
  };
  const temTabela = (db, nome) => linhas(db, `select name from sqlite_master where type='table' and name='${nome}'`).length > 0;

  /* =========================================================
     MODELOS DO ANKI (renderização simplificada dos templates)
     ========================================================= */
  /** {{#Campo}}…{{/Campo}} e {{^Campo}}…{{/Campo}} */
  function secoes(tpl, campos) {
    const re = /\{\{([#^])\s*([^}]+?)\s*\}\}([\s\S]*?)\{\{\/\s*\2\s*\}\}/;
    for (let n = 0; n < 50 && re.test(tpl); n++) {
      tpl = tpl.replace(re, (_, tipo, nome, dentro) => {
        const valor = String(campos[nome.split(':').pop().trim()] ?? '').replace(/<[^>]*>/g, '').trim();
        return (tipo === '#') === !!valor ? dentro : '';
      });
    }
    return tpl;
  }
  /** Troca {{Campo}}, {{text:Campo}}, {{cloze:Campo}}, {{FrontSide}}… */
  function renderizar(tpl, campos, { frente = '', cloze = v => v } = {}) {
    return secoes(tpl || '', campos).replace(/\{\{([^{}]+)\}\}/g, (_, dentro) => {
      const t = dentro.trim();
      if (t === 'FrontSide') return frente;
      const partes = t.split(':').map(x => x.trim());
      const nome = partes.pop();
      const filtros = partes;
      if (filtros.includes('type') || filtros.some(f => f.startsWith('tts'))) return '';
      if (!(nome in campos)) return '';   // Tags, Deck, Card… (campos especiais) ficam de fora
      let v = String(campos[nome] ?? '');
      if (filtros.includes('cloze')) v = cloze(v);
      if (filtros.includes('text')) v = v.replace(/<[^>]*>/g, '');
      return v;
    });
  }

  /* Marcadores provisórios que sobrevivem à conversão do HTML */
  const ABRE = '\uE000', FECHA = '\uE001', BLOCO = '\uE003';
  const CLOZE = /\{\{c(\d+)::([\s\S]*?)(?:::([^}]*?))?\}\}/g;
  /** Omissão do Anki → ocultação daqui: a lacuna do número `n` fica escondida, as outras aparecem */
  const clozePara = n => v => v.replace(CLOZE, (_, num, texto) => (Number(num) === n ? `${ABRE}${texto}${FECHA}` : texto));
  const semCloze = v => v.replace(CLOZE, (_, num, texto) => texto);

  /* =========================================================
     HTML DO ANKI → TEXTO COM A FORMATAÇÃO DO SITE
     **negrito** *itálico* __sublinhado__ ==marca== [cor]…[/cor] listas
     ========================================================= */
  const CORES_NOMES = { red: [255, 0, 0], blue: [0, 0, 255], green: [0, 128, 0], orange: [255, 165, 0], yellow: [255, 255, 0], purple: [128, 0, 128], darkred: [139, 0, 0], darkblue: [0, 0, 139], darkgreen: [0, 100, 0], navy: [0, 0, 128], teal: [0, 128, 128], magenta: [255, 0, 255], fuchsia: [255, 0, 255], lime: [0, 255, 0], crimson: [220, 20, 60], brown: [165, 42, 42], gold: [255, 215, 0] };
  function rgbDe(cor) {
    if (!cor) return null;
    cor = cor.trim().toLowerCase();
    let m;
    if ((m = cor.match(/^#([0-9a-f]{3})$/))) return [...m[1]].map(x => parseInt(x + x, 16));
    if ((m = cor.match(/^#([0-9a-f]{6})/))) return [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16));
    if ((m = cor.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:[\s,/]+([\d.]+))?/))) return m[4] !== undefined && Number(m[4]) === 0 ? null : [m[1], m[2], m[3]].map(Number);
    return CORES_NOMES[cor] || null;
  }
  /** Cor de texto → uma das 4 cores do site (ou nada, para preto/branco/cinza) */
  function corDoSite(cor) {
    const rgb = rgbDe(cor);
    if (!rgb) return null;
    const [r, g, b] = rgb.map(x => x / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, dlt = max - min;
    if (dlt < 0.15 || l < 0.12 || l > 0.92) return null;
    let h = max === r ? ((g - b) / dlt) % 6 : max === g ? (b - r) / dlt + 2 : (r - g) / dlt + 4;
    h = (h * 60 + 360) % 360;
    if (h < 18 || h >= 330) return 'vermelho';
    if (h < 65) return 'laranja';
    if (h < 170) return 'verde';
    if (h < 290) return 'azul';
    return 'vermelho';
  }
  const fundoMarcado = cor => { const rgb = rgbDe(cor); if (!rgb) return false; const l = (Math.max(...rgb) + Math.min(...rgb)) / 510; return l < 0.97; };

  const BLOCOS = new Set(['DIV', 'P', 'UL', 'OL', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'TR', 'TABLE', 'TBODY', 'THEAD', 'BLOCKQUOTE', 'PRE', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'CENTER', 'DL', 'DT', 'DD', 'FIGURE', 'FIGCAPTION', 'DETAILS', 'SUMMARY']);
  const IGNORAR = new Set(['SCRIPT', 'STYLE', 'HEAD', 'TITLE', 'TEMPLATE', 'NOSCRIPT', 'AUDIO', 'VIDEO', 'OBJECT', 'IFRAME', 'SVG', 'INPUT', 'BUTTON']);

  /** Envolve cada linha com um marcador, deixando os espaços de fora */
  function envolver(texto, abre, fecha = abre) {
    return texto.split('\n').map(l => {
      const m = l.match(/^(\s*)([\s\S]*?)(\s*)$/);
      return m[2] ? `${m[1]}${abre}${m[2]}${fecha}${m[3]}` : l;
    }).join('\n');
  }

  function htmlParaTexto(html) {
    const imagens = [];
    const limpo = String(html || '')
      .replace(/\[sound:[^\]]*\]/gi, '')
      .replace(/\[anki:tts[^\]]*\][\s\S]*?\[\/anki:tts\]/gi, '');
    const doc = new DOMParser().parseFromString(`<!doctype html><body>${limpo}</body>`, 'text/html');

    function andar(no, lista) {
      let s = '';
      for (const n of no.childNodes) {
        if (n.nodeType === 3) { s += n.nodeValue.replace(/[ \t\r\n\f]+/g, ' ').replace(/ /g, ' '); continue; }
        if (n.nodeType !== 1) continue;
        const tag = n.tagName;
        if (IGNORAR.has(tag) || n.id === 'answer') continue;
        if (tag === 'BR') { s += '\n'; continue; }
        if (tag === 'HR') { s += '\n'; continue; }
        if (tag === 'IMG') { const src = n.getAttribute('src'); if (src) imagens.push(src); continue; }
        let dentro;
        if (tag === 'UL' || tag === 'OL') dentro = andar(n, { tipo: tag, n: 0 });
        else if (tag === 'LI') {
          const marca = lista && lista.tipo === 'OL' ? `${++lista.n}. ` : '- ';
          dentro = marca + andar(n, null).trim().replace(/\n+/g, ' ');
        } else dentro = andar(n, lista);

        // Formatação: tags e estilos
        const st = n.style || {};
        const negrito = tag === 'B' || tag === 'STRONG' || /^(bold|[6-9]00)$/.test(st.fontWeight || '');
        const italico = tag === 'I' || tag === 'EM' || st.fontStyle === 'italic';
        const sublinhado = tag === 'U' || tag === 'INS' || /underline/.test(st.textDecoration || st.textDecorationLine || '');
        const marcado = tag === 'MARK' || fundoMarcado(st.backgroundColor);
        const cor = corDoSite(st.color || (tag === 'FONT' ? n.getAttribute('color') : ''));
        if (dentro.trim()) {
          if (cor) dentro = envolver(dentro, `[${cor}]`, `[/${cor}]`);
          if (marcado) dentro = envolver(dentro, '==');
          if (sublinhado) dentro = envolver(dentro, '__');
          if (italico) dentro = envolver(dentro, '*');
          if (negrito) dentro = envolver(dentro, '**');
        }
        if (BLOCOS.has(tag)) {
          // Um <br> no fim de um bloco não aparece no navegador; um bloco só com <br> é uma linha em branco
          if (dentro !== '\n') dentro = dentro.replace(/\n$/, '');
          s += `${BLOCO}${dentro}${BLOCO}`;
        }
        else if (tag === 'TD' || tag === 'TH') s += `${dentro} `;
        else s += dentro;
      }
      return s;
    }

    let texto = andar(doc.body, null)
      // Fronteiras de blocos viram uma quebra; <br> seguidos (ou um bloco vazio entre blocos) viram linha em branco
      .replace(new RegExp(`[${BLOCO}\\n]+`, 'g'), m => {
        const brs = (m.match(/\n/g) || []).length, blocos = m.length - brs;
        if (!blocos) return brs >= 2 ? '\n\n' : '\n';
        return Math.max(1, brs) + (brs >= 1 && blocos >= 2 ? 1 : 0) >= 2 ? '\n\n' : '\n';
      })
      .split('\n').map(l => l.replace(/[ \t]+/g, ' ').trim()).join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    // Marcadores vazios ("****") e lacunas
    texto = texto.replace(/\*\*\*\*|____|====/g, '');
    texto = texto.replace(new RegExp(`${ABRE}\\s*([\\s\\S]*?)\\s*${FECHA}`, 'g'), (_, t) => (t ? `{{${t.replace(/[{}]/g, '')}}}` : ''));
    return { texto, imagens };
  }

  /* =========================================================
     LER O PACOTE
     ========================================================= */
  /**
   * Lê o arquivo e devolve o que encontrou (nada é gravado ainda).
   * @returns {{ baralhos, cartoes, imagens, avisos, total, abrirMidia }}
   */
  async function ler(arquivo, aoProgresso = () => {}) {
    aoProgresso('Carregando o leitor de arquivos do Anki…');
    const { fflate, fzstd, SQL } = await bibliotecas();
    aoProgresso('Abrindo o arquivo…');
    const bytes = new Uint8Array(await arquivo.arrayBuffer());
    let zip;
    try {
      zip = fflate.unzipSync(bytes, { filter: f => /^(collection\.anki2(1b?)?|media|meta)$/.test(f.name) });
    } catch (e) {
      throw new Error('Este arquivo não parece ser um pacote do Anki (.apkg). Exporte de novo pelo Anki: Arquivo → Exportar → "Pacote de baralhos do Anki (*.apkg)".');
    }
    const nomeBanco = ['collection.anki21b', 'collection.anki21', 'collection.anki2'].find(n => zip[n]);
    if (!nomeBanco) throw new Error('Não encontrei os cartões dentro do arquivo. Ele foi exportado pelo Anki?');
    let bancoBytes = zip[nomeBanco];
    if (ehZstd(bancoBytes)) bancoBytes = fzstd.decompress(bancoBytes);

    aoProgresso('Lendo os cartões…');
    const db = new SQL.Database(bancoBytes);
    try {
      const col = linhas(db, 'select crt, models, decks from col')[0] || {};
      const crt = Number(col.crt) || Math.floor(Date.now() / 1000);

      /* ----- Modelos (tipos de nota) e baralhos ----- */
      const modelos = {};
      const baralhosAnki = {};
      if (temTabela(db, 'notetypes')) {
        for (const nt of linhas(db, 'select id, name, config from notetypes')) {
          const cfg = proto(nt.config || new Uint8Array());
          const kind = (cfg.find(([c, t]) => c === 1 && t === 0) || [0, 0, 0])[2];
          modelos[nt.id] = { nome: nt.name, cloze: kind === 1, campos: [], modelos: {} };
        }
        for (const f of linhas(db, 'select ntid, ord, name from fields order by ntid, ord')) modelos[f.ntid] && (modelos[f.ntid].campos[f.ord] = f.name);
        for (const t of linhas(db, 'select ntid, ord, config from templates')) {
          const cfg = proto(t.config || new Uint8Array());
          if (modelos[t.ntid]) modelos[t.ntid].modelos[t.ord] = { q: textoProto(cfg, 1), a: textoProto(cfg, 2) };
        }
        for (const dk of linhas(db, 'select id, name from decks')) baralhosAnki[dk.id] = String(dk.name).split('\x1f');
      } else {
        const ms = JSON.parse(col.models || '{}');
        for (const m of Object.values(ms)) {
          modelos[m.id] = { nome: m.name, cloze: m.type === 1, campos: (m.flds || []).sort((a, b) => a.ord - b.ord).map(f => f.name), modelos: {} };
          (m.tmpls || []).forEach(t => { modelos[m.id].modelos[t.ord] = { q: t.qfmt, a: t.afmt }; });
        }
        for (const dk of Object.values(JSON.parse(col.decks || '{}'))) baralhosAnki[dk.id] = String(dk.name).split('::');
      }

      /* ----- Mídia: nome do arquivo → nome dentro do zip ----- */
      const midia = {};
      if (zip.media && zip.media.length) {
        let m = zip.media;
        if (ehZstd(m)) m = fzstd.decompress(m);
        if (m[0] === 0x7b) { // JSON antigo: {"0": "foto.jpg"}
          Object.entries(JSON.parse(utf8.decode(m))).forEach(([zipNome, nome]) => { midia[nome] = zipNome; });
        } else {               // protobuf: lista de { nome, tamanho, sha1 }
          proto(m).filter(([c, t]) => c === 1 && t === 2).forEach(([, , entrada], i) => { midia[textoProto(proto(entrada), 1)] = String(i); });
        }
      }

      /* ----- Notas e cartões ----- */
      const notas = {};
      for (const n of linhas(db, 'select id, mid, flds from notes')) notas[n.id] = n;
      const listaCartoes = linhas(db, 'select id, nid, did, odid, ord, type, queue, due, odue, ivl, factor, reps, lapses from cards order by nid, ord');

      const avisos = { vazios: 0, semImagem: new Set(), sons: 0, frenteImagem: 0 };
      const resultado = [];
      const notasOclusao = new Set();
      const nomeImagem = src => { try { return decodeURIComponent(src); } catch { return src; } };

      for (const c of listaCartoes) {
        const nota = notas[c.nid];
        const modelo = nota && modelos[nota.mid];
        if (!nota || !modelo) continue;
        const valores = String(nota.flds).split('\x1f');
        if (/\[sound:/i.test(nota.flds)) avisos.sons++;
        const campos = {};
        modelo.campos.forEach((nome, i) => { campos[nome] = valores[i] ?? ''; });
        const tpl = modelo.cloze ? modelo.modelos[0] : (modelo.modelos[c.ord] || modelo.modelos[0]);
        if (!tpl) continue;
        const deckId = Number(c.odid) || c.did;
        const baralho = baralhosAnki[deckId] || baralhosAnki[c.did] || ['Anki'];
        let item = null;

        // ----- Image Occlusion (Anki 23.10+): uma nota vira um cartão de imagem com todas as áreas -----
        const textoOclusao = valores.find(v => /image-occlusion:/i.test(v));
        if (textoOclusao) {
          if (notasOclusao.has(c.nid)) continue;
          notasOclusao.add(c.nid);
          const formas = [];
          const re = /\{\{c(\d+)::image-occlusion:(rect|ellipse|polygon)((?::[a-z]+=[^:}]*)*)[^}]*\}\}/gi;
          let m;
          while ((m = re.exec(textoOclusao))) {
            const p = Object.fromEntries(m[3].split(':').filter(Boolean).map(x => x.split('=')));
            if (m[2] === 'polygon' && p.points) {
              const pts = p.points.trim().split(/\s+/).map(xy => xy.split(',').map(Number));
              const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]);
              formas.push({ x: Math.min(...xs), y: Math.min(...ys), l: Math.max(...xs) - Math.min(...xs), a: Math.max(...ys) - Math.min(...ys) });
            } else formas.push({ x: +p.left || 0, y: +p.top || 0, l: +p.width || 0, a: +p.height || 0 });
          }
          const imgs = valores.flatMap(v => [...v.matchAll(/<img[^>]+src=["']?([^"'>]+)/gi)].map(x => nomeImagem(x[1])));
          const cabecalho = htmlParaTexto(campos.Header || campos['Cabeçalho'] || '').texto;
          const extra = htmlParaTexto(campos['Back Extra'] || campos['Verso Extra'] || '').texto;
          if (imgs[0] && formas.length) item = { tipo: 'imagem', frente: cabecalho, verso: extra, imagem: imgs[0], formas };
        }

        // ----- Omissão de palavras (Cloze) -----
        else if (modelo.cloze) {
          const n = Number(c.ord) + 1;
          const q = htmlParaTexto(renderizar(tpl.q, campos, { cloze: clozePara(n) }));
          const a = htmlParaTexto(renderizar(tpl.a.replace(/\{\{\s*cloze:[^}]+\}\}/gi, ''), campos, { cloze: semCloze }));
          if (q.texto.includes('{{')) item = { tipo: 'lacuna', frente: q.texto, verso: a.texto, imgFrente: q.imagens, imgVerso: a.imagens };
        }

        // ----- Frente e verso (Básico, Invertido e modelos próprios) -----
        else {
          const qHtml = renderizar(tpl.q, campos);
          let aHtml = renderizar(tpl.a, campos, { frente: '\uE002' });
          // A resposta do Anki repete a frente: fica só o que vem depois de <hr id=answer> (ou do {{FrontSide}})
          const corte = aHtml.search(/<hr[^>]*id\s*=\s*["']?answer["']?[^>]*>/i);
          if (corte >= 0) aHtml = aHtml.slice(corte).replace(/^<hr[^>]*>/i, '');
          aHtml = aHtml.replace(/\uE002/g, '');
          const q = htmlParaTexto(qHtml), a = htmlParaTexto(aHtml);
          item = { tipo: 'basico', frente: q.texto, verso: a.texto, imgFrente: q.imagens.map(nomeImagem), imgVerso: a.imagens.map(nomeImagem) };
          // Imagem na frente: vira cartão de imagem (a imagem aparece na pergunta)
          if (item.imgFrente.length) {
            avisos.frenteImagem++;
            item = { tipo: 'imagem', frente: q.texto, verso: a.texto, imagem: item.imgFrente[0], formas: [] };
          } else if (!item.frente) item = null;
        }

        if (!item) { avisos.vazios++; continue; }
        item.baralho = baralho;
        item.ankiId = c.id;
        item.progresso = progresso(c, crt);
        resultado.push(item);
      }

      // Imagens usadas e as que faltam no pacote
      const imagens = new Set();
      for (const it of resultado) {
        const usadas = [it.imagem, ...(it.imgVerso || []).slice(0, 1)].filter(Boolean);
        usadas.forEach(n => (midia[n] !== undefined ? imagens.add(n) : avisos.semImagem.add(n)));
      }

      // Para buscar as imagens depois (só as usadas, uma por vez)
      const abrirMidia = nome => {
        const zipNome = midia[nome];
        if (zipNome === undefined) return null;
        const r = fflate.unzipSync(bytes, { filter: f => f.name === zipNome });
        let b = r[zipNome];
        if (!b) return null;
        if (ehZstd(b)) b = fzstd.decompress(b);
        return b;
      };

      return { cartoes: resultado, imagens: [...imagens], avisos: { ...avisos, semImagem: [...avisos.semImagem] }, abrirMidia };
    } finally {
      db.close();
    }
  }

  /** Progresso do cartão no Anki → agendamento daqui */
  function progresso(c, crt) {
    const hoje = Util.hoje();
    const r = { suspenso: Number(c.queue) === -1 };
    const tipo = Number(c.type);
    if (tipo === 2) {
      // "due" conta dias desde a criação da coleção; o dia de hoje do Anki só vira às 4h.
      // Mantém a mesma distância que o Anki mostra ("vence em 3 dias" continua em 3 dias).
      const diaAnki = Math.floor((Date.now() / 1000 - crt) / 86400);
      const venc = Util.somarDias(hoje, Number(c.odue && c.odid ? c.odue : c.due) - diaAnki);
      const ivl = Math.max(1, Math.min(3650, Number(c.ivl) || 1));
      let ultima = Util.somarDias(venc, -ivl);
      if (ultima >= hoje) ultima = Util.somarDias(hoje, -1);
      r.rep = {
        estado: 'revisao', intervalo: ivl,
        facilidade: Math.min(3.5, Math.max(1.3, (Number(c.factor) || 2500) / 1000)),
        repeticoes: Math.max(2, Number(c.reps) - Number(c.lapses) || 2), lapsos: Number(c.lapses) || 0,
        vencimento: venc, ultimaRevisao: ultima, introduzidoEm: ultima,
      };
    } else if (tipo === 1 || tipo === 3) {
      const ontem = Util.somarDias(hoje, -1);
      r.rep = { estado: 'aprendendo', intervalo: 0, repeticoes: 0, lapsos: Number(c.lapses) || 0, vencimento: hoje, ultimaRevisao: ontem, introduzidoEm: ontem };
    }
    return r;
  }

  return { ler, htmlParaTexto, bibliotecas };
})();

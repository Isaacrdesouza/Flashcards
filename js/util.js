/* =============================================================
   util.js — Funções utilitárias usadas em todo o projeto
   (identificadores, textos, datas, avisos, modal, arquivos, imagens)
   ============================================================= */
'use strict';

const Util = (() => {

  /* ---------- Identificadores e textos ---------- */

  /** Gera um identificador único curto (ex.: "lq3k9z4f8a2b") */
  function gerarId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /** Escapa caracteres especiais para inserir texto com segurança no HTML */
  function esc(texto) {
    return String(texto ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** Converte texto puro (com quebras de linha) em HTML seguro */
  function textoParaHtml(texto) {
    return esc(texto).replace(/\n/g, '<br>');
  }

  /* ---------- Formatação simples dos cartões ----------
     **negrito**  *itálico*  __sublinhado__  ==marca-texto==
     [vermelho]…[/vermelho]  [azul]…[/azul]  [verde]…[/verde]  [laranja]…[/laranja]
     Linhas começando com "- " viram lista; "1. " vira lista numerada. */
  const CORES_TEXTO = ['vermelho', 'azul', 'verde', 'laranja'];
  const RE_COR = /\[(vermelho|azul|verde|laranja)\]([\s\S]+?)\[\/\1\]/g;

  /** Aplica a formatação em uma linha já escapada */
  function formatarLinha(html) {
    return html
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*(?!\s)([^*]+?)\*(?!\*)/g, '$1<em>$2</em>')
      .replace(/__(.+?)__/g, '<u>$1</u>')
      .replace(/==(.+?)==/g, '<mark class="marca-texto">$1</mark>')
      .replace(RE_COR, '<span class="cor-texto cor-texto--$1">$2</span>');
  }

  /** Texto do cartão → HTML seguro com formatação e listas */
  function formatar(texto) {
    const linhas = esc(texto).split('\n');
    let html = '', lista = null;
    const fecharLista = () => { if (lista) { html += `</${lista}>`; lista = null; } };
    linhas.forEach((linha, i) => {
      const ul = /^\s*[-•]\s+(.*)$/.exec(linha);
      const ol = /^\s*\d+[.)]\s+(.*)$/.exec(linha);
      const tipo = ul ? 'ul' : ol ? 'ol' : null;
      if (tipo) {
        if (lista !== tipo) { fecharLista(); html += `<${tipo} class="lista-formatada">`; lista = tipo; }
        html += `<li>${formatarLinha((ul || ol)[1])}</li>`;
      } else {
        fecharLista();
        html += formatarLinha(linha) + (i < linhas.length - 1 ? '<br>' : '');
      }
    });
    fecharLista();
    return html;
  }

  /** Remove as marcas de formatação (para listas, buscas e resumos) */
  function semFormatacao(texto) {
    return String(texto ?? '')
      .replace(RE_COR, '$2')
      .replace(/\*\*(.+?)\*\*/g, '$1').replace(/__(.+?)__/g, '$1').replace(/==(.+?)==/g, '$1')
      .replace(/(^|[^*])\*(?!\s)([^*]+?)\*(?!\*)/g, '$1$2')
      .replace(/^\s*([-•]|\d+[.)])\s+/gm, '');
  }

  /** Texto sem acentos e em minúsculas (para buscar "funcao" e achar "função") */
  const normalizar = texto => String(texto ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  /* ---------- Cartões de ocultar palavra: {{palavra}} marca o trecho escondido ---------- */
  const LACUNA = /\{\{(.+?)\}\}/g;
  const temLacuna = texto => /\{\{\s*\S.*?\}\}/.test(String(texto ?? ''));
  /** Palavras escondidas de uma frase (ex.: ["rede"]) */
  const palavrasOcultas = texto => [...String(texto ?? '').matchAll(LACUNA)].map(m => m[1].trim());
  /** Frase com as lacunas trocadas por […] (para listas e resumos) */
  const lacunaResumo = texto => String(texto ?? '').replace(LACUNA, '[…]');
  /**
   * Frase em HTML. modo 'oculto': cada palavra vira um botão […] que revela ao tocar;
   * modo 'revelado': a palavra aparece destacada.
   */
  function lacunaParaHtml(texto, modo) {
    let n = 0;
    return formatar(texto).replace(LACUNA, (_, palavra) => {
      n++;
      return modo === 'oculto'
        ? `<button type="button" class="lacuna" data-lacuna aria-pressed="false" aria-label="Revelar palavra oculta ${n}"><span class="lacuna__oculto" aria-hidden="true">[…]</span><span class="lacuna__texto">${palavra}</span></button>`
        : `<mark class="lacuna lacuna--revelada">${palavra}</mark>`;
    });
  }

  /** Corta um texto longo e adiciona reticências */
  function resumir(texto, max = 80) {
    const limpo = String(texto ?? '').replace(/\s+/g, ' ').trim();
    return limpo.length > max ? limpo.slice(0, max - 1) + '…' : limpo;
  }

  /** Comparação alfabética respeitando acentos do português */
  const porNome = (a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true });

  /** Plural simples: plural(2, 'cartão', 'cartões') → "2 cartões" */
  function plural(n, singular, pluralTexto) {
    return `${n.toLocaleString('pt-BR')} ${n === 1 ? singular : pluralTexto}`;
  }

  /* ---------- Datas (sempre no fuso horário local) ---------- */
  // Guardamos datas como texto 'AAAA-MM-DD': fácil de comparar e de salvar.

  /** Retorna 'AAAA-MM-DD' da data informada (padrão: agora) */
  function dataISO(d = new Date()) {
    const ano = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  }

  /** Data de hoje em 'AAAA-MM-DD' */
  const hoje = () => dataISO();

  /** Converte 'AAAA-MM-DD' em objeto Date (meia-noite local) */
  function deISO(iso) {
    const [a, m, d] = iso.split('-').map(Number);
    return new Date(a, m - 1, d);
  }

  /** Soma (ou subtrai) dias de uma data ISO */
  function somarDias(iso, n) {
    const d = deISO(iso);
    d.setDate(d.getDate() + n);
    return dataISO(d);
  }

  /** Quantos dias de A até B (positivo se B for depois) */
  function diferencaDias(isoA, isoB) {
    return Math.round((deISO(isoB) - deISO(isoA)) / 86400000);
  }

  /** Dia da semana: 0 = domingo … 6 = sábado */
  const diaSemana = (iso = hoje()) => deISO(iso).getDay();

  /** Segunda-feira da semana da data (nossas semanas começam na segunda) */
  function inicioSemana(iso = hoje()) {
    const d = deISO(iso);
    const desdeSegunda = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - desdeSegunda);
    return dataISO(d);
  }

  const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const DIAS_LONGOS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  /** Ordem de exibição dos dias: segunda → domingo */
  const ORDEM_SEMANA = [1, 2, 3, 4, 5, 6, 0];

  /** Formata uma data ISO para exibição (ex.: "15 de out.") */
  function formatarData(iso, opcoes = { day: 'numeric', month: 'short' }) {
    return deISO(iso).toLocaleDateString('pt-BR', opcoes);
  }

  /** Texto do intervalo da semana: "13 – 19 de out." */
  function textoSemana(inicioIso) {
    const fim = somarDias(inicioIso, 6);
    const a = deISO(inicioIso), b = deISO(fim);
    const mesmoMes = a.getMonth() === b.getMonth();
    const ini = mesmoMes ? a.getDate() : formatarData(inicioIso);
    return `${ini} – ${formatarData(fim, { day: 'numeric', month: 'short', year: a.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined })}`;
  }

  /** Texto amigável para um intervalo em dias ("agora", "3 dias", "2 meses") */
  function textoIntervalo(dias) {
    if (dias <= 0) return 'agora';
    if (dias === 1) return '1 dia';
    if (dias < 30) return `${dias} dias`;
    if (dias < 365) {
      const meses = Math.round(dias / 30);
      return meses === 1 ? '1 mês' : `${meses} meses`;
    }
    const anos = Math.round(dias / 36.5) / 10;
    return `${String(anos).replace('.', ',')} ${anos === 1 ? 'ano' : 'anos'}`;
  }

  /* ---------- Avisos rápidos (toasts) ---------- */

  /** Mostra um aviso por alguns segundos. tipo: 'info' | 'sucesso' | 'erro' */
  /**
   * Aviso rápido (toast). Opcional: acao = { rotulo, fn } mostra um botão
   * (ex.: "Desfazer") e deixa o aviso mais tempo na tela.
   */
  function aviso(mensagem, tipo = 'info', acao = null) {
    const area = document.getElementById('area-avisos');
    const el = document.createElement('div');
    el.className = `aviso aviso--${tipo}${acao ? ' aviso--com-acao' : ''}`;
    const texto = document.createElement('span');
    texto.textContent = mensagem;
    el.appendChild(texto);
    const fechar = () => { el.classList.add('saindo'); setTimeout(() => el.remove(), 260); };
    if (acao) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'aviso__acao';
      b.textContent = acao.rotulo;
      b.addEventListener('click', () => { fechar(); acao.fn(); }, { once: true });
      el.appendChild(b);
    }
    area.appendChild(el);
    setTimeout(fechar, acao ? 7000 : 3200);
  }

  /* ---------- Janela modal ---------- */

  /**
   * Abre a janela modal com um formulário.
   * Retorna uma Promise com o FormData (se confirmado) ou null (se cancelado).
   * @param {object} o
   * @param {string} o.titulo     Título da janela
   * @param {string} o.corpo      HTML do conteúdo (campos do formulário)
   * @param {string} [o.confirmar] Texto do botão de confirmação
   * @param {string|false} [o.cancelar] Texto do botão cancelar (false para esconder)
   * @param {boolean} [o.perigo]  Botão de confirmação vermelho (ações destrutivas)
   * @param {Function} [o.aoMontar] Função chamada com o <dialog> já preenchido
   */
  function abrirModal({ titulo, corpo, confirmar = 'Salvar', cancelar = 'Cancelar', perigo = false, aoMontar }) {
    const dlg = document.getElementById('modal');
    // O botão confirmar vem primeiro: assim a tecla Enter confirma (o CSS inverte a ordem visual)
    dlg.innerHTML = `
      <form method="dialog" class="modal__form">
        <header class="modal__cabecalho"><h2 id="modal-titulo">${esc(titulo)}</h2></header>
        <div class="modal__corpo">${corpo}</div>
        <footer class="modal__rodape">
          <button class="botao ${perigo ? 'botao--perigo' : 'botao--primario'}" value="confirmar">${esc(confirmar)}</button>
          ${cancelar ? `<button class="botao botao--fantasma" value="cancelar" formnovalidate>${esc(cancelar)}</button>` : ''}
        </footer>
      </form>`;
    dlg.setAttribute('aria-labelledby', 'modal-titulo');
    dlg.returnValue = '';

    return new Promise(resolve => {
      const form = dlg.querySelector('form');
      dlg.addEventListener('close', () => {
        resolve(dlg.returnValue === 'confirmar' ? new FormData(form) : null);
      }, { once: true });
      dlg.showModal();
      if (aoMontar) aoMontar(dlg);
      // Coloca o foco no primeiro campo editável
      const primeiro = dlg.querySelector('input:not([type=radio]):not([type=checkbox]), textarea, select');
      if (primeiro) primeiro.focus();
    });
  }

  /** Pergunta de confirmação (sim/não). Retorna Promise<boolean>. */
  async function confirmar(mensagem, { titulo = 'Confirmar', botao = 'Confirmar', perigo = true } = {}) {
    const fd = await abrirModal({ titulo, corpo: `<p>${mensagem}</p>`, confirmar: botao, perigo });
    return fd !== null;
  }

  /* ---------- Arquivos ---------- */

  /** Faz o navegador baixar um arquivo gerado na hora */
  function baixarArquivo(nome, conteudo, tipo = 'application/json') {
    const blob = new Blob([conteudo], { type: tipo });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /** Lê um arquivo do computador como texto */
  function lerArquivoTexto(arquivo) {
    return new Promise((resolve, reject) => {
      const leitor = new FileReader();
      leitor.onload = () => resolve(leitor.result);
      leitor.onerror = () => reject(leitor.error);
      leitor.readAsText(arquivo, 'utf-8');
    });
  }

  /**
   * Reduz e comprime uma imagem antes de salvar (economiza espaço).
   * Lado maior limitado a `maxLado` px; usa WebP (mantém transparência) ou JPEG.
   * Retorna Promise<{ dataUrl, largura, altura }>.
   */
  function comprimirImagem(arquivo, maxLado = 1600, qualidade = 0.86) {
    return new Promise((resolve, reject) => {
      const leitor = new FileReader();
      leitor.onerror = () => reject(leitor.error);
      leitor.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Não foi possível ler esta imagem.'));
        img.onload = () => {
          const escala = Math.min(1, maxLado / Math.max(img.naturalWidth, img.naturalHeight));
          const largura = Math.max(1, Math.round(img.naturalWidth * escala));
          const altura = Math.max(1, Math.round(img.naturalHeight * escala));
          const canvas = document.createElement('canvas');
          canvas.width = largura;
          canvas.height = altura;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, largura, altura);
          let dataUrl = canvas.toDataURL('image/webp', qualidade);
          // Alguns navegadores não geram WebP: usamos JPEG com fundo branco
          if (!dataUrl.startsWith('data:image/webp')) {
            ctx.globalCompositeOperation = 'destination-over';
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, largura, altura);
            dataUrl = canvas.toDataURL('image/jpeg', qualidade);
          }
          resolve({ dataUrl, largura, altura });
        };
        img.src = leitor.result;
      };
      leitor.readAsDataURL(arquivo);
    });
  }

  /** Atrasa a execução até o usuário parar de digitar */
  function adiar(fn, ms = 250) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  /** Embaralha uma lista (algoritmo de Fisher–Yates) */
  function embaralhar(lista) {
    const a = [...lista];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  return {
    gerarId, esc, textoParaHtml, resumir, porNome, plural,
    LACUNA, temLacuna, palavrasOcultas, lacunaResumo, lacunaParaHtml,
    CORES_TEXTO, formatar, semFormatacao, normalizar,
    dataISO, hoje, deISO, somarDias, diferencaDias, diaSemana, inicioSemana,
    DIAS_CURTOS, DIAS_LONGOS, ORDEM_SEMANA, formatarData, textoSemana, textoIntervalo,
    aviso, abrirModal, confirmar,
    baixarArquivo, lerArquivoTexto, comprimirImagem,
    adiar, embaralhar,
  };
})();

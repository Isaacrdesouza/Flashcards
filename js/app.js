/* =============================================================
   app.js — Inicialização do site
   1. Descobre se há alguém conectado (senão mostra a tela de entrada)
   2. Abre o banco local da conta e carrega os dados
   3. Liga a sincronização e mostra a página
   ============================================================= */
'use strict';

(async function iniciarApp() {
  try {
    // ---- 1. Conta ----
    const inicio = await Nuvem.iniciar();
    let usuario = inicio.usuario;
    if (!usuario || inicio.novaSenha) {
      usuario = await Acesso.mostrar({ modo: inicio.novaSenha ? 'novaSenha' : 'entrar', aviso: inicio.aviso, usuario });
    } else if (inicio.aviso) {
      Util.aviso(inicio.aviso, 'sucesso');
    }

    try { if (usuario.email) localStorage.setItem('flashcards-ultimo-email', usuario.email); } catch { /* ignorado */ }

    // ---- 2. Dados desta conta neste aparelho ----
    await Banco.abrir(usuario.id);
    await trazerDadosAntigos(usuario);
    const primeiraVezAqui = !(await Banco.lerEstado());
    await Estado.carregar();
    // Conta nova neste aparelho: mantém o tema que o aparelho já usava (tela de entrada)
    if (primeiraVezAqui) { try { const tema = localStorage.getItem('flashcards-tema'); if (tema && tema !== Estado.config().tema) Estado.atualizarConfig({ tema }); } catch { /* ignorado */ } }
    Banco.pedirPersistencia();

    // ---- 3. Sincronização e interface ----
    Nuvem.comecar();
    Nuvem.aoMudar(st => {
      const link = document.getElementById('nuvem-menu');
      if (!link) return;
      const textos = { ok: 'Sincronizado', sincronizando: 'Sincronizando…', offline: 'Sem internet', erro: 'Erro na nuvem', desconectado: 'Conta', indisponivel: 'Nuvem off' };
      link.dataset.situacao = st.situacao;
      link.querySelector('.nuvem-menu__texto').textContent = textos[st.situacao] || 'Conta';
      link.title = st.conectado ? `Conta: ${st.usuario.email} · ${textos[st.situacao] || ''}` : 'Conta e nuvem';
    });

    // Aplica o tema e a preferência de animações salvos nos Ajustes
    Ui.aplicarTema(Estado.config().tema);
    document.body.classList.toggle('sem-animacoes', !Estado.config().animacoes);

    Rotas.iniciar();

    // Primeiro acesso: boas-vindas e tutoriais (espera a 1ª sincronização para saber se a conta é nova)
    Tutorial.aoAbrirApp().catch(e => console.error(e));

    // Tecla "/" abre a busca geral (fora de campos de texto e da sessão de estudo)
    document.addEventListener('keydown', e => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || document.querySelector('dialog[open]')) return;
      if (e.target.closest('input, textarea, select, [contenteditable]') || document.body.classList.contains('modo-estudo')) return;
      e.preventDefault();
      Rotas.ir('#/busca');
    });

    if (Banco.usandoLocalStorage) {
      Util.aviso('Armazenamento limitado neste navegador: faça backups com frequência.', 'erro');
    }
  } catch (erro) {
    console.error(erro);
    document.body.classList.remove('sem-acesso');
    document.getElementById('conteudo').innerHTML =
      `<p class="carregando">Não foi possível iniciar o site: ${Util.esc(erro.message)}</p>`;
  }

  /**
   * Cartões de antes das contas (guardados no navegador sem dono):
   * na primeira entrada de uma conta neste aparelho, oferece levá-los para ela.
   * Só uma conta pode ficar com eles.
   */
  async function trazerDadosAntigos(usuario) {
    if (await Banco.lerEstado()) return;                     // a conta já tem dados neste aparelho
    const CHAVE_DONO = 'flashcards-legado-dono';
    const CHAVE_RECUSA = `flashcards-legado-recusado-${usuario.id}`;
    const lerLS = k => { try { return localStorage.getItem(k); } catch { return null; } };
    const gravarLS = (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignorado */ } };

    const jaSincronizou = Nuvem.jaSincronizouAqui(usuario.id);
    let adotou = false;
    if (!lerLS(CHAVE_DONO) && !lerLS(CHAVE_RECUSA)) {
      const legado = await Banco.lerLegado();
      const e = legado?.estado;
      const temAlgo = e && ((e.cartoes || []).length || (e.materias || []).length || (e.historico || []).length);
      if (temAlgo) {
        const n = (e.cartoes || []).length, m = (e.materias || []).length;
        // Se esta conta já sincronizou estes dados antes (login de versões anteriores), leva sem perguntar
        const levar = jaSincronizou || (await Util.abrirModal({
          titulo: 'Cartões salvos neste navegador',
          corpo: `<p>Encontramos <strong>${Util.plural(n, 'cartão', 'cartões')}</strong> em ${Util.plural(m, 'matéria', 'matérias')} salvos aqui antes de existir conta.</p>
                  <p>Quer levar tudo para a conta <strong>${Util.esc(usuario.email || '')}</strong>? Eles serão guardados na nuvem.</p>`,
          confirmar: 'Levar para a minha conta',
          cancelar: 'Agora não',
        })) !== null;
        if (levar) {
          await Banco.gravarImagens(legado.imagens);
          await Banco.salvarEstado(legado.estado);
          gravarLS(CHAVE_DONO, usuario.id);
          adotou = true;
        } else {
          gravarLS(CHAVE_RECUSA, '1');
        }
      }
    }
    // Banco local novo: a memória da sincronização tem que começar do zero (senão pareceria
    // que tudo foi apagado aqui e a exclusão iria para a nuvem)
    if (!adotou) Nuvem.esquecerSincronizacao(usuario.id);
  }
})();

/* =============================================================
   acesso.js — Tela de entrada (antes de abrir o site)
   Telas: entrar · criar conta · confirmar e-mail · esqueci a senha
          · código de recuperação · nova senha
   Acesso.mostrar() devolve uma Promise que termina com o usuário
   conectado; aí o app.js abre os dados da conta.
   ============================================================= */
'use strict';

const Acesso = (() => {
  const { esc } = Util;
  const MIN_SENHA = 6;

  function mostrar({ modo = 'entrar', aviso = '', usuario = null } = {}) {
    return new Promise(resolve => {
      let tela = modo;
      let email = usuario?.email || lembrarEmail() || '';
      let mensagem = aviso ? { tipo: modo === 'novaSenha' ? 'ok' : 'erro', texto: aviso } : null;
      let esperaReenvio = 0, relogio = null;

      document.body.classList.add('sem-acesso');
      const raiz = document.createElement('div');
      raiz.className = 'acesso';
      raiz.innerHTML = `
        <aside class="acesso__lado" aria-hidden="true">
          <div class="acesso__lado-conteudo">
            <span class="acesso__marca"><img src="assets/icone.svg" alt="" width="40" height="40"> Flash Cards</span>
            <p class="acesso__chamada">Estude o que importa, na hora certa.</p>
            <ul class="acesso__vantagens">
              <li>${Ui.icone('repetir')}<span><strong>Repetição espaçada</strong>Cada cartão volta no momento em que você está para esquecer.</span></li>
              <li>${Ui.icone('nuvem')}<span><strong>No PC e no tablet</strong>Seus cartões ficam na sua conta e aparecem em todos os aparelhos.</span></li>
              <li>${Ui.icone('check')}<span><strong>Funciona sem internet</strong>Estude offline: as mudanças são enviadas quando a conexão voltar.</span></li>
            </ul>
          </div>
          <div class="acesso__pilha">
            <div class="acesso__cartao-deco acesso__cartao-deco--tras"></div>
            <div class="acesso__cartao-deco"><span class="acesso__deco-rotulo">Frente</span><span class="acesso__deco-linha"></span><span class="acesso__deco-linha acesso__deco-linha--curta"></span><span class="acesso__deco-botoes"><i></i><i></i><i></i><i></i></span></div>
          </div>
        </aside>
        <main class="acesso__principal">
          <div class="acesso__caixa" id="acesso-caixa"></div>
        </main>`;
      document.body.appendChild(raiz);
      const caixa = raiz.querySelector('#acesso-caixa');

      /* ---------- Desenho de cada tela ---------- */
      const campoEmail = (auto = 'email') => `
        <div class="campo"><label class="campo__rotulo" for="acesso-email">E-mail</label>
          <span class="acesso__entrada">${Ui.icone('email')}
            <input id="acesso-email" type="email" name="email" required autocomplete="${auto}" inputmode="email" autocapitalize="off" spellcheck="false" value="${esc(email)}" placeholder="voce@exemplo.com">
          </span></div>`;
      const campoSenha = (nome, rotulo, auto, extra = '') => `
        <div class="campo"><div class="acesso__rotulo-linha"><label class="campo__rotulo" for="acesso-${nome}">${rotulo}</label>${extra}</div>
          <span class="acesso__entrada acesso__entrada--senha">${Ui.icone('cadeado')}
            <input id="acesso-${nome}" type="password" name="${nome}" required minlength="${MIN_SENHA}" autocomplete="${auto}">
            <button type="button" class="acesso__olho" data-acao="ver-senha" aria-label="Mostrar senha" aria-pressed="false">${Ui.icone('olho')}</button>
          </span></div>`;
      const caixaMensagem = () => mensagem
        ? `<p class="acesso__msg acesso__msg--${mensagem.tipo}" role="${mensagem.tipo === 'erro' ? 'alert' : 'status'}">${esc(mensagem.texto)}</p>`
        : '<p class="acesso__msg" role="alert" hidden></p>';
      const semInternet = () => navigator.onLine ? '' :
        `<p class="acesso__msg acesso__msg--aviso" role="status">${Ui.icone('nuvem')} Sem internet. Conecte-se para entrar.</p>`;
      const topo = (titulo, texto) => `
        <span class="acesso__marca acesso__marca--caixa"><img src="assets/icone.svg" alt="" width="32" height="32"> Flash Cards</span>
        <h1 class="acesso__titulo" tabindex="-1">${titulo}</h1>
        <p class="acesso__texto">${texto}</p>`;

      const TELAS = {
        entrar: () => `
          ${topo('Entrar', 'Use seu e-mail e senha para abrir seus cartões.')}
          ${semInternet()}
          <form class="formulario acesso__form" data-form="entrar" novalidate>
            ${campoEmail()}
            ${campoSenha('senha', 'Senha', 'current-password', '<button type="button" class="acesso__link" data-ir="esqueci">Esqueci a senha</button>')}
            ${caixaMensagem()}
            <button type="submit" class="botao botao--primario botao--grande botao--bloco">Entrar</button>
          </form>
          <p class="acesso__troca">Ainda não tem conta? <button type="button" class="acesso__link" data-ir="criar">Criar conta</button></p>`,

        criar: () => `
          ${topo('Criar conta', 'Seus cartões ficam guardados na sua conta e aparecem em todos os seus aparelhos.')}
          ${semInternet()}
          <form class="formulario acesso__form" data-form="criar" novalidate>
            ${campoEmail()}
            ${campoSenha('senha', 'Senha', 'new-password')}
            <div class="acesso__forca" aria-live="polite"><span class="acesso__forca-barra"><span></span></span><span class="acesso__forca-texto">Pelo menos ${MIN_SENHA} caracteres</span></div>
            ${campoSenha('senha2', 'Confirmar senha', 'new-password')}
            ${caixaMensagem()}
            <button type="submit" class="botao botao--primario botao--grande botao--bloco">Criar conta</button>
          </form>
          <p class="acesso__troca">Já tem conta? <button type="button" class="acesso__link" data-ir="entrar">Entrar</button></p>`,

        confirmar: () => `
          <span class="acesso__selo">${Ui.icone('email')}</span>
          ${topo('Confirme seu e-mail', `Enviamos um link de confirmação para <strong>${esc(email)}</strong>. Abra o e-mail, clique no link e depois volte aqui para entrar.`)}
          ${caixaMensagem()}
          <div class="acesso__acoes">
            <button type="button" class="botao botao--primario botao--grande botao--bloco" data-ir="entrar">Já confirmei, entrar</button>
            <button type="button" class="botao botao--bloco" data-acao="reenviar" ${esperaReenvio ? 'disabled' : ''}>${esperaReenvio ? `Reenviar em ${esperaReenvio}s` : 'Reenviar e-mail'}</button>
          </div>
          <p class="acesso__dica">Não chegou? Olhe a caixa de spam ou lixo eletrônico.</p>
          <p class="acesso__troca"><button type="button" class="acesso__link" data-ir="criar">Usar outro e-mail</button></p>`,

        esqueci: () => `
          ${topo('Esqueci a senha', 'Digite o e-mail da sua conta. Vamos enviar um link para você criar uma senha nova.')}
          ${semInternet()}
          <form class="formulario acesso__form" data-form="esqueci" novalidate>
            ${campoEmail()}
            ${caixaMensagem()}
            <button type="submit" class="botao botao--primario botao--grande botao--bloco">Enviar link</button>
          </form>
          <p class="acesso__troca"><button type="button" class="acesso__link" data-ir="entrar">${Ui.icone('voltar')} Voltar para entrar</button></p>`,

        enviado: () => `
          <span class="acesso__selo">${Ui.icone('email')}</span>
          ${topo('Verifique seu e-mail', `Se existir uma conta com <strong>${esc(email)}</strong>, enviamos um link para criar uma senha nova. Abra o link neste aparelho.`)}
          ${caixaMensagem()}
          <details class="acesso__codigo" ${mensagem?.tipo === 'erro' ? 'open' : ''}>
            <summary>O e-mail trouxe um código de 6 dígitos?</summary>
            <form class="formulario acesso__form" data-form="codigo" novalidate>
              <label class="campo"><span class="campo__rotulo">Código do e-mail</span>
                <input class="entrada acesso__otp" id="acesso-codigo" type="text" name="codigo" required inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6,10}" maxlength="10" placeholder="000000"></label>
              ${campoSenha('senha', 'Senha nova', 'new-password')}
              ${campoSenha('senha2', 'Confirmar senha nova', 'new-password')}
              <button type="submit" class="botao botao--primario botao--bloco">Salvar senha e entrar</button>
            </form>
          </details>
          <p class="acesso__dica">Não chegou? Olhe a caixa de spam ou tente de novo em um minuto.</p>
          <p class="acesso__troca"><button type="button" class="acesso__link" data-ir="entrar">${Ui.icone('voltar')} Voltar para entrar</button></p>`,

        novaSenha: () => `
          ${topo('Crie uma senha nova', usuario?.email ? `Para a conta <strong>${esc(usuario.email)}</strong>.` : 'Escolha a senha que vai usar daqui em diante.')}
          <form class="formulario acesso__form" data-form="nova" novalidate>
            ${campoSenha('senha', 'Senha nova', 'new-password')}
            ${campoSenha('senha2', 'Confirmar senha nova', 'new-password')}
            ${caixaMensagem()}
            <button type="submit" class="botao botao--primario botao--grande botao--bloco">Salvar e entrar</button>
          </form>`,
      };

      function desenhar(focarTitulo = true) {
        caixa.innerHTML = TELAS[tela]();
        caixa.dataset.tela = tela;
        document.title = `${{ entrar: 'Entrar', criar: 'Criar conta', confirmar: 'Confirme seu e-mail', esqueci: 'Esqueci a senha', enviado: 'Verifique seu e-mail', novaSenha: 'Nova senha' }[tela]} · Flash Cards`;
        // Foco: no primeiro campo vazio (ou no título, para leitores de tela)
        const vazio = [...caixa.querySelectorAll('input')].find(i => !i.value);
        if (vazio && tela !== 'enviado') vazio.focus();
        else if (focarTitulo) caixa.querySelector('.acesso__titulo')?.focus();
      }
      const ir = (nova, msg = null) => { tela = nova; mensagem = msg; desenhar(); };

      function erro(form, texto, campo) {
        const p = form.querySelector('.acesso__msg') || caixa.querySelector('.acesso__msg');
        if (p) { p.className = 'acesso__msg acesso__msg--erro'; p.textContent = texto; p.hidden = false; p.setAttribute('role', 'alert'); }
        if (campo) { const i = form.querySelector(`[name="${campo}"]`); i?.setAttribute('aria-invalid', 'true'); i?.focus(); }
      }

      function concluir(u) {
        lembrarEmail(u?.email || email);
        clearInterval(relogio);
        window.removeEventListener('online', aoMudarRede);
        window.removeEventListener('offline', aoMudarRede);
        raiz.classList.add('acesso--saindo');
        document.body.classList.remove('sem-acesso');
        setTimeout(() => raiz.remove(), 260);
        resolve(u);
      }

      function contarReenvio() {
        esperaReenvio = 60;
        clearInterval(relogio);
        relogio = setInterval(() => {
          esperaReenvio--;
          if (esperaReenvio <= 0) { esperaReenvio = 0; clearInterval(relogio); }
          const b = caixa.querySelector('[data-acao="reenviar"]');
          if (b) { b.disabled = esperaReenvio > 0; b.textContent = esperaReenvio ? `Reenviar em ${esperaReenvio}s` : 'Reenviar e-mail'; }
        }, 1000);
      }

      /* ---------- Força da senha (só uma dica, não bloqueia) ---------- */
      function forca(senha) {
        if (!senha) return { nivel: 0, texto: `Pelo menos ${MIN_SENHA} caracteres` };
        if (senha.length < MIN_SENHA) return { nivel: 1, texto: `Faltam ${MIN_SENHA - senha.length} caracteres` };
        let pontos = 0;
        if (senha.length >= 10) pontos++;
        if (/[a-z]/.test(senha) && /[A-Z]/.test(senha)) pontos++;
        if (/\d/.test(senha)) pontos++;
        if (/[^A-Za-z0-9]/.test(senha)) pontos++;
        return pontos >= 3 ? { nivel: 4, texto: 'Senha forte' } : pontos >= 1 ? { nivel: 3, texto: 'Senha boa' } : { nivel: 2, texto: 'Senha fraca: misture letras, números e símbolos' };
      }

      /* ---------- Eventos ---------- */
      raiz.addEventListener('click', async e => {
        const destino = e.target.closest('[data-ir]');
        if (destino) {
          const campo = caixa.querySelector('input[name="email"]');
          if (campo) email = campo.value.trim();
          ir(destino.dataset.ir);
          return;
        }
        const acao = e.target.closest('[data-acao]')?.dataset.acao;
        if (acao === 'ver-senha') {
          const botao = e.target.closest('[data-acao]');
          const input = botao.parentElement.querySelector('input');
          const mostrarSenha = input.type === 'password';
          input.type = mostrarSenha ? 'text' : 'password';
          botao.setAttribute('aria-pressed', String(mostrarSenha));
          botao.setAttribute('aria-label', mostrarSenha ? 'Esconder senha' : 'Mostrar senha');
          botao.innerHTML = Ui.icone(mostrarSenha ? 'olho-fechado' : 'olho');
          input.focus();
        } else if (acao === 'reenviar') {
          const botao = e.target.closest('button');
          botao.disabled = true;
          try { await Nuvem.reenviarConfirmacao(email); mensagem = { tipo: 'ok', texto: 'Enviamos o e-mail de novo.' }; contarReenvio(); }
          catch (er) { mensagem = { tipo: 'erro', texto: er.message }; }
          desenhar(false);
        }
      });

      raiz.addEventListener('input', e => {
        e.target.removeAttribute('aria-invalid');
        if (e.target.name === 'senha' && caixa.dataset.tela === 'criar') {
          const f = forca(e.target.value);
          const caixaForca = caixa.querySelector('.acesso__forca');
          caixaForca.dataset.nivel = f.nivel;
          caixaForca.querySelector('.acesso__forca-texto').textContent = f.texto;
        }
        if (e.target.name === 'codigo') e.target.value = e.target.value.replace(/\D/g, '');
      });

      raiz.addEventListener('submit', async e => {
        e.preventDefault();
        const form = e.target;
        const tipo = form.dataset.form;
        const valor = nome => (form.elements[nome]?.value || '');
        const botao = form.querySelector('[type="submit"]');

        // Validação com mensagens claras (antes de ir à internet)
        if (form.elements.email) {
          email = valor('email').trim();
          if (!email) return erro(form, 'Digite seu e-mail.', 'email');
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return erro(form, 'Este e-mail não parece válido. Confira se digitou certo.', 'email');
        }
        if (tipo === 'codigo' && !/^\d{6,10}$/.test(valor('codigo'))) return erro(form, 'Digite o código de 6 dígitos do e-mail.', 'codigo');
        if (form.elements.senha) {
          if (!valor('senha')) return erro(form, 'Digite a senha.', 'senha');
          if (tipo !== 'entrar' && valor('senha').length < MIN_SENHA) return erro(form, `A senha precisa ter pelo menos ${MIN_SENHA} caracteres.`, 'senha');
        }
        if (form.elements.senha2 && valor('senha2') !== valor('senha')) return erro(form, 'As duas senhas não são iguais.', 'senha2');
        if (!navigator.onLine) return erro(form, 'Sem internet. Conecte-se e tente de novo.');

        const textoBotao = botao.textContent;
        botao.disabled = true;
        botao.classList.add('botao--carregando');
        botao.textContent = { entrar: 'Entrando…', criar: 'Criando conta…', esqueci: 'Enviando…', codigo: 'Conferindo…', nova: 'Salvando…' }[tipo];
        try {
          if (tipo === 'entrar') {
            concluir(await Nuvem.entrar(email, valor('senha')));
            return;
          }
          if (tipo === 'criar') {
            const r = await Nuvem.criarConta(email, valor('senha'));
            if (r.usuario) { concluir(r.usuario); Util.aviso('Conta criada! Bem-vindo.', 'sucesso'); return; }
            contarReenvio();
            ir('confirmar');
            return;
          }
          if (tipo === 'esqueci') {
            await Nuvem.recuperarSenha(email);
            ir('enviado');
            return;
          }
          if (tipo === 'codigo') {
            const u = await Nuvem.entrarComCodigo(email, valor('codigo'));
            await Nuvem.trocarSenha(valor('senha'));
            concluir(u);
            Util.aviso('Senha nova salva!', 'sucesso');
            return;
          }
          if (tipo === 'nova') {
            await Nuvem.trocarSenha(valor('senha'));
            concluir(Nuvem.status().usuario || usuario);
            Util.aviso('Senha nova salva!', 'sucesso');
          }
        } catch (er) {
          if (!botao.isConnected) return;
          botao.disabled = false;
          botao.classList.remove('botao--carregando');
          botao.textContent = textoBotao;
          erro(form, er.message);
        }
      });

      // Mostra/esconde o aviso de "sem internet" quando a conexão muda
      function aoMudarRede() {
        if (['entrar', 'criar', 'esqueci'].includes(tela)) {
          const valores = [...caixa.querySelectorAll('input')].map(i => i.value);
          desenhar(false);
          caixa.querySelectorAll('input').forEach((i, n) => { i.value = valores[n] ?? ''; });
        }
      }
      window.addEventListener('online', aoMudarRede);
      window.addEventListener('offline', aoMudarRede);

      desenhar();
    });
  }

  /** Lembra o último e-mail usado neste aparelho (só o e-mail, nunca a senha) */
  function lembrarEmail(valor) {
    try {
      if (valor === undefined) return localStorage.getItem('flashcards-ultimo-email');
      if (valor) localStorage.setItem('flashcards-ultimo-email', valor);
    } catch { return null; }
    return null;
  }

  return { mostrar };
})();

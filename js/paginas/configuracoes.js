/* =============================================================
   paginas/configuracoes.js — Ajustes, backup e restauração
   ============================================================= */
'use strict';

Rotas.registrar('configuracoes', {
  titulo: 'Ajustes',

  render(el) {
    const { esc } = Util;
    const cfg = Estado.config();
    const ultimo = cfg.ultimoBackup
      ? new Date(cfg.ultimoBackup).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' })
      : 'nunca';

    el.innerHTML = `
      ${Ui.cabecalho({ titulo: 'Ajustes' })}

      <section class="painel" aria-labelledby="t-tema">
        <h2 class="painel__titulo painel__titulo--margem" id="t-tema">Aparência</h2>
        <div class="seletor-tema" role="radiogroup" aria-labelledby="t-tema">
          ${Object.entries(Ui.TEMAS).map(([chave, t]) => `
            <label class="opcao-tema opcao-tema--${chave}">
              <input type="radio" name="tema" value="${chave}" ${(cfg.tema || 'escuro') === chave ? 'checked' : ''}>
              <span class="opcao-tema__amostra" aria-hidden="true"><span></span><span></span><span></span></span>
              <span class="opcao-tema__nome">${Ui.icone(t.icone)} ${esc(t.nome)}</span>
              ${t.nota ? `<span class="opcao-tema__nota">${esc(t.nota)}</span>` : ''}
            </label>`).join('')}
        </div>
      </section>

      <section class="painel" aria-labelledby="t-pref">
        <h2 class="painel__titulo painel__titulo--margem" id="t-pref">Preferências de estudo</h2>
        <form class="formulario" id="form-pref">
          <div class="grade-campos">
            <label class="campo">
              <span class="campo__rotulo">Nome das pastas do 3º nível</span>
              <input type="text" name="nomeNivel3" maxlength="30" required value="${esc(cfg.nomeNivel3)}">
              <span class="campo__ajuda">Matéria → Frente → <strong>${esc(cfg.nomeNivel3)}</strong></span>
            </label>
            <label class="campo">
              <span class="campo__rotulo">Meta diária de revisões</span>
              <input type="number" name="metaDiaria" min="0" max="9999" required value="${cfg.metaDiaria || 0}">
              <span class="campo__ajuda">Quantas respostas você quer dar por dia. 0 = sem meta.</span>
            </label>
            <label class="campo">
              <span class="campo__rotulo">Cartões novos por dia</span>
              <input type="number" name="novosPorDia" min="0" max="999" required value="${cfg.novosPorDia}">
              <span class="campo__ajuda">Limite somando todas as matérias.</span>
            </label>
          </div>
          <label class="interruptor">
            <span>Contar a revisão livre na meta diária <span class="campo__ajuda">(inclui a revisão dos cartões errados)</span></span>
            <input type="checkbox" name="livreContaMeta" ${cfg.livreContaMeta !== false ? 'checked' : ''}>
          </label>
          <label class="interruptor">
            <span>Animações (virar cartão, deslizar, transições)</span>
            <input type="checkbox" name="animacoes" ${cfg.animacoes ? 'checked' : ''}>
          </label>
          <div><button type="submit" class="botao botao--primario">Salvar preferências</button></div>
        </form>
      </section>

      <section class="painel" aria-labelledby="t-tutoriais">
        <h2 class="painel__titulo painel__titulo--margem" id="t-tutoriais">Tutoriais e ajuda</h2>
        <label class="interruptor">
          <span>Mostrar dicas ao abrir cada página pela primeira vez <span class="campo__ajuda">(o botão ${Ui.icone('ajuda', 'icone--texto')} no topo de cada página explica a qualquer momento)</span></span>
          <input type="checkbox" id="chk-dicas" ${Tutorial.prefs()?.dicas ? 'checked' : ''}>
        </label>
        <label class="interruptor">
          <span>Mostrar os <strong>Primeiros passos</strong> no Início</span>
          <input type="checkbox" id="chk-primeiros" ${Tutorial.prefs()?.primeirosPassos !== false && Tutorial.prefs() ? 'checked' : ''}>
        </label>
        <div class="acoes-linha">
          <button class="botao" data-tutorial="boas-vindas">${Ui.icone('play')} Ver boas-vindas</button>
          <button class="botao" data-tutorial="menu">${Ui.icone('ajuda')} Tour pelo menu</button>
          <button class="botao botao--fantasma" data-acao="recomecar-dicas">${Ui.icone('repetir')} Recomeçar todas as dicas</button>
        </div>
      </section>

      <section class="painel" aria-labelledby="t-nuvem">
        <div class="painel__cabecalho">
          <div>
            <h2 class="painel__titulo" id="t-nuvem">Conta e nuvem</h2>
            <p class="painel__nota">${Nuvem.status().conectado
              ? `Conectado como <strong>${esc(Nuvem.status().usuario.email || '')}</strong>. Seus cartões são sincronizados com a nuvem.`
              : 'Entre com uma conta para guardar os cartões na nuvem e usar no PC e no tablet.'}</p>
          </div>
          <a class="botao ${Nuvem.status().conectado ? '' : 'botao--primario'}" href="#/conta">${Ui.icone('nuvem')} ${Nuvem.status().conectado ? 'Ver conta' : 'Entrar ou criar conta'}</a>
        </div>
      </section>

      <section class="painel" aria-labelledby="t-lixeira">
        <div class="painel__cabecalho">
          <div>
            <h2 class="painel__titulo" id="t-lixeira">Lixeira</h2>
            <p class="painel__nota">${Estado.lixeira().length
              ? `${Util.plural(Estado.lixeira().length, 'item excluído', 'itens excluídos')}. Ficam ${Estado.DIAS_LIXEIRA} dias antes de serem apagados de vez.`
              : 'Vazia. O que você excluir fica aqui por 30 dias e pode ser restaurado.'}</p>
          </div>
          <a class="botao" href="#/lixeira">${Ui.icone('lixeira')} Abrir lixeira</a>
        </div>
      </section>

      <section class="painel" aria-labelledby="t-backup">
        <h2 class="painel__titulo" id="t-backup">Backup</h2>
        <p class="painel__nota painel__nota--margem">
          Seus dados ficam guardados apenas neste navegador. Faça backups regularmente — o arquivo
          <code>.json</code> inclui matérias, cartões, imagens, histórico e planos.<br>
          Último backup: <strong>${esc(ultimo)}</strong>
        </p>
        <div class="acoes-linha">
          <button class="botao botao--primario" data-acao="exportar">${Ui.icone('importar')} Baixar backup</button>
          <label class="botao">
            <input type="file" accept=".json,application/json" id="arquivo-backup" class="sr-only">
            ${Ui.icone('repetir')} Restaurar backup
          </label>
        </div>
      </section>

      <section class="painel" aria-labelledby="t-atalhos">
        <h2 class="painel__titulo painel__titulo--margem" id="t-atalhos">Atalhos de teclado</h2>
        <table class="tabela">
          <tbody>
            <tr><td><kbd>Espaço</kbd> ou <kbd>Enter</kbd></td><td>Virar o cartão</td></tr>
            <tr><td><kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> <kbd>4</kbd></td><td>Errei · Difícil · Bom · Fácil</td></tr>
            <tr><td>Deslizar ← / →</td><td>Errei / Bom (no tablet ou celular)</td></tr>
            <tr><td><kbd>Ctrl</kbd> + <kbd>Enter</kbd></td><td>Salvar cartão no editor</td></tr>
            <tr><td><kbd>Ctrl</kbd> + <kbd>V</kbd></td><td>Colar imagem no editor de cartão</td></tr>
          </tbody>
        </table>
      </section>

      <section class="painel painel--perigo" aria-labelledby="t-perigo">
        <h2 class="painel__titulo" id="t-perigo">Zona de perigo</h2>
        <p class="painel__nota painel__nota--margem">Apaga todas as matérias, cartões, imagens e histórico deste navegador.</p>
        <button class="botao botao--perigo" data-acao="apagar">${Ui.icone('lixeira')} Apagar todos os dados</button>
      </section>`;

    /* ----- Tutoriais ----- */
    el.querySelector('#chk-dicas').addEventListener('change', e => {
      Tutorial.ligarDicas(e.target.checked);
      Util.aviso(e.target.checked ? 'Dicas ligadas: aparecem na primeira visita de cada página.' : 'Dicas desligadas. O botão ? continua no topo das páginas.');
    });
    el.querySelector('#chk-primeiros').addEventListener('change', e => {
      Tutorial.gravar({ primeirosPassos: e.target.checked });
      Util.aviso(e.target.checked ? 'Os primeiros passos aparecem no Início.' : 'Primeiros passos escondidos.');
    });
    el.querySelectorAll('[data-tutorial]').forEach(b => b.addEventListener('click', () => Tutorial.iniciar(b.dataset.tutorial)));
    el.querySelector('[data-acao="recomecar-dicas"]').addEventListener('click', () => {
      Tutorial.recomecar();
      Util.aviso('Pronto! As dicas de cada página vão aparecer de novo.', 'sucesso');
      Rotas.recarregar();
    });

    /* ----- Tema: aplica e salva na hora ----- */
    el.querySelectorAll('input[name="tema"]').forEach(r => r.addEventListener('change', () => {
      Ui.aplicarTema(r.value);
      Estado.atualizarConfig({ tema: r.value });
      Util.aviso(`Tema ${Ui.TEMAS[r.value].nome.toLowerCase()} ativado`, 'sucesso');
    }));

    /* ----- Preferências ----- */
    el.querySelector('#form-pref').addEventListener('submit', e => {
      e.preventDefault();
      const f = e.target;
      if (!f.reportValidity()) return;
      Estado.atualizarConfig({
        nomeNivel3: f.nomeNivel3.value.trim() || 'Frente',
        novosPorDia: Math.max(0, Math.min(999, parseInt(f.novosPorDia.value, 10) || 0)),
        metaDiaria: Math.max(0, Math.min(9999, parseInt(f.metaDiaria.value, 10) || 0)),
        animacoes: f.animacoes.checked,
        livreContaMeta: f.livreContaMeta.checked,
      });
      document.body.classList.toggle('sem-animacoes', !f.animacoes.checked);
      Util.aviso('Preferências salvas', 'sucesso');
      Rotas.recarregar();
    });

    /* ----- Backup / restauração / apagar ----- */
    el.addEventListener('click', async e => {
      const btn = e.target.closest('[data-acao]');
      if (!btn) return;

      if (btn.dataset.acao === 'exportar') {
        btn.disabled = true;
        try {
          const backup = await Estado.exportar();
          Util.baixarArquivo(`flashcards-backup-${Util.hoje()}.json`, JSON.stringify(backup));
          Estado.registrarBackup();
          Util.aviso('Backup baixado! Guarde-o em local seguro (ex.: OneDrive/Google Drive).', 'sucesso');
          Rotas.recarregar();
        } catch (erro) {
          Util.aviso('Erro ao gerar o backup: ' + erro.message, 'erro');
          btn.disabled = false;
        }
      }

      if (btn.dataset.acao === 'apagar') {
        const ok = await Util.confirmar(
          'Tem certeza? <strong>Todos os dados serão apagados</strong> deste navegador. Recomendamos baixar um backup antes.',
          { titulo: 'Apagar todos os dados', botao: 'Apagar tudo' });
        if (ok) {
          await Estado.apagarTudo();
          Util.aviso('Todos os dados foram apagados');
          Rotas.ir('#/inicio');
        }
      }
    });

    el.querySelector('#arquivo-backup').addEventListener('change', async e => {
      const arquivo = e.target.files[0];
      e.target.value = '';
      if (!arquivo) return;
      try {
        const backup = JSON.parse(await Util.lerArquivoTexto(arquivo));
        if (!backup || backup.app !== 'estudos-flashcards') throw new Error('Este arquivo não é um backup deste site.');
        const d = backup.dados || {};
        const resumo = `${Util.plural((d.materias || []).length, 'matéria', 'matérias')} e ${Util.plural((d.cartoes || []).length, 'cartão', 'cartões')}`;
        const data = backup.exportadoEm ? new Date(backup.exportadoEm).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' }) : 'data desconhecida';
        const ok = await Util.confirmar(
          `O backup de <strong>${esc(data)}</strong> tem ${resumo}. Os dados atuais serão <strong>substituídos</strong>. Continuar?`,
          { titulo: 'Restaurar backup', botao: 'Restaurar' });
        if (!ok) return;
        await Estado.importar(backup);
        document.body.classList.toggle('sem-animacoes', !Estado.config().animacoes);
        Util.aviso('Backup restaurado!', 'sucesso');
        Rotas.ir('#/inicio');
      } catch (erro) {
        Util.aviso(erro instanceof SyntaxError ? 'Arquivo inválido (não é JSON).' : erro.message, 'erro');
      }
    });
  },
});

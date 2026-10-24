/* =============================================================
   paginas/conta.js — Conta e sincronização na nuvem (Supabase)
   A entrada e a criação de conta ficam na tela de acesso (js/acesso.js).
   Aqui: situação da sincronização, "Sincronizar agora", "Alterar senha" e "Sair".
   Endereço: #/conta
   ============================================================= */
'use strict';

Rotas.registrar('conta', {
  titulo: 'Conta e nuvem',

  render(el) {
    const { esc } = Util;
    let desligar = null;

    const TEXTOS = {
      ok: { rotulo: 'Sincronizado', classe: 'ok' },
      sincronizando: { rotulo: 'Sincronizando…', classe: 'andando' },
      offline: { rotulo: 'Sem internet: as mudanças ficam aqui e vão depois', classe: 'aviso' },
      erro: { rotulo: 'Erro ao sincronizar', classe: 'erro' },
      desconectado: { rotulo: 'Não conectado', classe: '' },
      indisponivel: { rotulo: 'Nuvem indisponível', classe: 'erro' },
    };

    function desenhar(st) {
      const t = TEXTOS[st.situacao] || TEXTOS.desconectado;
      const quando = st.ultimaSync ? new Date(st.ultimaSync).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : null;
      el.innerHTML = `
        ${Ui.cabecalho({ titulo: 'Conta e nuvem', voltar: '#/configuracoes', subtitulo: 'Guarde seus cartões na nuvem e use o mesmo conteúdo no PC e no tablet.' })}
        <section class="painel conta">
          <div class="conta__topo">
            <span class="conta__avatar" aria-hidden="true">${esc(((st.usuario && st.usuario.email) || '?')[0].toUpperCase())}</span>
            <div class="conta__textos">
              <span class="conta__email">${esc((st.usuario && st.usuario.email) || '')}</span>
              <span class="nuvem-selo nuvem-selo--${t.classe}">${Ui.icone('nuvem')} ${esc(t.rotulo)}${st.situacao === 'ok' && quando ? ` às ${quando}` : ''}</span>
            </div>
          </div>
          ${st.situacao === 'erro' && st.ultimoErro ? `<p class="erro-formulario">${esc(st.ultimoErro)}</p>` : ''}
          <div class="acoes-linha">
            <button class="botao botao--primario" data-acao="sincronizar" ${st.situacao === 'sincronizando' ? 'disabled' : ''}>${Ui.icone('repetir')} Sincronizar agora</button>
            <button class="botao" data-acao="senha">${Ui.icone('cadeado')} Alterar senha</button>
            <button class="botao" data-acao="sair">${Ui.icone('sair')} Sair da conta</button>
          </div>
          <ul class="conta__info">
            <li>As mudanças são enviadas sozinhas alguns segundos depois de cada alteração, ao voltar para o site e a cada minuto.</li>
            <li>Os dados continuam também neste navegador: o site abre rápido e funciona sem internet.</li>
            <li>Para usar no tablet ou em outro computador, abra o site lá e entre com este mesmo e-mail.</li>
          </ul>
        </section>`;
    }

    desligar = Nuvem.aoMudar(desenhar);

    el.addEventListener('click', async e => {
      const acao = e.target.closest('[data-acao]')?.dataset.acao;
      if (acao === 'sincronizar') {
        await Nuvem.sincronizarAgora();
      } else if (acao === 'senha') {
        const fd = await Util.abrirModal({
          titulo: 'Alterar senha',
          corpo: `
            <div class="formulario conta">
              <label class="campo"><span class="campo__rotulo">Senha nova</span>
                <input type="password" name="senha" required minlength="6" autocomplete="new-password">
                <span class="campo__ajuda">Pelo menos 6 caracteres.</span></label>
              <label class="campo"><span class="campo__rotulo">Confirmar senha nova</span>
                <input type="password" name="senha2" required minlength="6" autocomplete="new-password"></label>
            </div>`,
          confirmar: 'Salvar senha',
          aoMontar: dlg => {
            const f = dlg.querySelector('form');
            const s1 = f.elements.senha, s2 = f.elements.senha2;
            const conferir = () => s2.setCustomValidity(s1.value === s2.value ? '' : 'As duas senhas não são iguais.');
            s1.addEventListener('input', conferir);
            s2.addEventListener('input', conferir);
          },
        });
        if (!fd) return;
        try { await Nuvem.trocarSenha(fd.get('senha')); Util.aviso('Senha alterada!', 'sucesso'); }
        catch (erro) { Util.aviso(erro.message, 'erro'); }
      } else if (acao === 'sair') {
        const fd = await Util.abrirModal({
          titulo: 'Sair da conta',
          corpo: `
            <p>Para voltar a usar o site neste aparelho, será preciso entrar de novo.</p>
            <label class="caixa-marcar"><input type="checkbox" name="apagar">
              <span>Apagar também a cópia dos cartões guardada neste aparelho <small>(use em computador compartilhado; os cartões continuam na nuvem)</small></span></label>`,
          confirmar: 'Sair',
        });
        if (!fd) return;
        const st = Nuvem.status();
        if (st.situacao === 'offline' && !(await Util.confirmar('Você está sem internet: mudanças feitas agora podem ainda não ter ido para a nuvem. Elas ficam guardadas neste aparelho e vão quando você entrar de novo aqui. Sair mesmo assim?', { titulo: 'Sem internet', botao: 'Sair', perigo: !!fd.get('apagar') }))) return;
        Util.aviso('Saindo…');
        await Nuvem.sair({ apagarDesteAparelho: !!fd.get('apagar') });
        Nuvem.voltarParaEntrada();
      }
    });

    return () => { if (desligar) desligar(); };
  },
});

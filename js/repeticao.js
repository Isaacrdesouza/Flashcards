/* =============================================================
   repeticao.js — Algoritmo de repetição espaçada
   Baseado no SM-2 (o mesmo princípio do Anki), simplificado para dias.

   Cada cartão guarda em `rep`:
     estado        'novo' | 'aprendendo' | 'revisao'
     intervalo     dias até a próxima revisão
     facilidade    multiplicador do intervalo (começa em 2,5; mínimo 1,3)
     repeticoes    acertos seguidos
     lapsos        quantas vezes errou depois de já ter aprendido
     vencimento    data 'AAAA-MM-DD' da próxima revisão
     introduzidoEm data em que o cartão foi estudado pela 1ª vez

   Respostas: 1 = Errei · 2 = Difícil · 3 = Bom · 4 = Fácil
   ============================================================= */
'use strict';

const Repeticao = (() => {

  /** Botões de resposta exibidos na sessão de estudo */
  const RESPOSTAS = [
    { valor: 1, rotulo: 'Errei',   classe: 'errei' },
    { valor: 2, rotulo: 'Difícil', classe: 'dificil' },
    { valor: 3, rotulo: 'Bom',     classe: 'bom' },
    { valor: 4, rotulo: 'Fácil',   classe: 'facil' },
  ];

  const INTERVALO_MAXIMO = 3650; // 10 anos

  /** Dados de agendamento de um cartão recém-criado */
  function novo() {
    return {
      estado: 'novo', intervalo: 0, facilidade: 2.5, repeticoes: 0, lapsos: 0,
      vencimento: null, ultimaRevisao: null, introduzidoEm: null,
    };
  }

  /**
   * Calcula o novo agendamento SEM alterar o original.
   * @param {object} rep       agendamento atual do cartão
   * @param {number} resposta  1 a 4
   * @param {string} hojeIso   data de hoje 'AAAA-MM-DD'
   */
  function calcular(rep, resposta, hojeIso = Util.hoje()) {
    const r = { ...novo(), ...rep };

    if (resposta === 1) {
      // Errou: volta para a fase de aprendizado e reaparece ainda nesta sessão
      if (r.estado === 'revisao') r.lapsos += 1;
      r.estado = 'aprendendo';
      r.repeticoes = 0;
      r.intervalo = 0;
      r.facilidade = Math.max(1.3, r.facilidade - 0.2);
      r.vencimento = hojeIso;
    } else {
      const anterior = r.intervalo;
      if (r.repeticoes === 0) {
        // Primeiro acerto
        r.intervalo = { 2: 1, 3: 1, 4: 4 }[resposta];
      } else if (r.repeticoes === 1) {
        // Segundo acerto
        r.intervalo = { 2: 3, 3: 6, 4: 8 }[resposta];
      } else {
        // Daqui em diante o intervalo cresce multiplicado pela facilidade
        const fator = { 2: 1.2, 3: r.facilidade, 4: r.facilidade * 1.3 }[resposta];
        r.intervalo = Math.round(anterior * fator);
      }
      // Garante que o intervalo sempre aumente um pouco
      r.intervalo = Math.min(INTERVALO_MAXIMO, Math.max(r.intervalo, anterior + 1));

      // Ajusta a facilidade conforme a dificuldade relatada
      r.facilidade = Math.max(1.3, r.facilidade + { 2: -0.15, 3: 0, 4: 0.15 }[resposta]);
      r.repeticoes += 1;
      r.estado = 'revisao';
      r.vencimento = Util.somarDias(hojeIso, r.intervalo);
    }
    r.ultimaRevisao = hojeIso;
    return r;
  }

  /** Texto do próximo intervalo de cada botão (ex.: { 1: 'agora', 3: '6 dias' }) */
  function previsoes(rep) {
    const resultado = {};
    for (const { valor } of RESPOSTAS) {
      resultado[valor] = Util.textoIntervalo(calcular(rep, valor).intervalo);
    }
    return resultado;
  }

  /** Cartão "maduro" = intervalo de 21 dias ou mais (mesmo critério do Anki) */
  const ehMaduro = rep => rep.estado === 'revisao' && rep.intervalo >= 21;

  return { RESPOSTAS, novo, calcular, previsoes, ehMaduro };
})();

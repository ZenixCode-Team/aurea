import type { Sintoma } from './sintomas.js';

/**
 * O mural de sintomas — o que a equipe explicou na primeira consulta, disponível
 * para reler em casa.
 *
 * O PROBLEMA QUE ELE RESOLVE. Na primeira consulta o paciente recebe, de uma vez,
 * mais informação do que qualquer pessoa absorve numa sessão: o que é o tratamento,
 * o que vai sentir, o que é esperado, quando ligar. O que não coube fica como dúvida
 * guardada até o próximo retorno — e o retorno pode ser em três semanas.
 *
 * O mural não substitui a consulta. Ele repete, escrito e no ritmo da pessoa, o que
 * já foi dito por voz.
 *
 * POR QUE ELE NASCE DA ÁRVORE DE TRIAGEM. Os verbetes cobrem exatamente os sintomas
 * que o check-in pergunta. Se o mural tivesse lista própria, as duas listas
 * divergiriam na primeira mudança do protocolo, e o paciente leria sobre um sintoma
 * que o sistema não acompanha — ou pior, não leria sobre um que acompanha.
 *
 * ------------------------------------------------------------------------------
 * `quandoProcurar` É OBRIGATÓRIO NO TIPO, E ISSO NÃO É DETALHE DE MODELAGEM.
 *
 * Uma tela que diz a alguém em quimioterapia "isso é esperado" sem dizer onde o
 * esperado termina é ativamente perigosa: é assim que uma pessoa com febre em
 * neutropenia decide esperar até amanhã. O campo ser obrigatório significa que não
 * existe verbete futuro — escrito por mim, pelo orientador ou por quem vier depois —
 * capaz de tranquilizar sem dizer o limite. O compilador recusa.
 *
 * Pela mesma razão `oQueEsperar` e `quandoProcurar` são sempre exibidos juntos, e
 * `quandoProcurar` nunca vem depois de dobra ou dentro de acordeão fechado.
 * ------------------------------------------------------------------------------
 *
 * ESTADO DO CONTEÚDO. Rascunho, sem assinatura clínica — igual ao conjunto de
 * limiares `rascunho-0` e aos verbetes da biblioteca. A interface é obrigada a
 * exibir a marca de não validado enquanto for assim. Ver ADR-001, regra 1.
 *
 * DESTINO. Isto vive aqui hoje pelo mesmo motivo que `ARVORE_DE_TRIAGEM` vive aqui:
 * é contrato compartilhado entre a API e o front, e ainda não existe origem de
 * escrita para ele. Quando a Onda F entregar o CRUD, migra para tabela versionada
 * com autoria, como `VerbeteDaBiblioteca` já é — e a interface não muda, porque o
 * formato é o mesmo.
 */
export interface VerbeteDoMural {
  readonly sintoma: Sintoma;
  /** Como a pessoa chama isso, não como o prontuário chama. */
  readonly titulo: string;
  /** Uma frase. É o que aparece no cartão do mural, antes de qualquer clique. */
  readonly resumo: string;
  /** Por que acontece. Sem mecanismo fisiológico detalhado: a pessoa quer entender, não estudar. */
  readonly porQueAcontece: string;
  /** O que costuma acontecer durante o tratamento. Nunca exibido sem `quandoProcurar` ao lado. */
  readonly oQueEsperar: readonly string[];
  /** O que dá para fazer em casa. Nada que não esteja na receita — regra 8 do ADR-001. */
  readonly emCasa: readonly string[];
  /** OBRIGATÓRIO. Onde o esperado termina e a equipe entra. Ver o bloco acima. */
  readonly quandoProcurar: readonly string[];
}

/**
 * Versão do conteúdo do mural.
 *
 * Existe pela mesma razão que o conjunto de limiares tem versão: quando alguém com
 * responsabilidade clínica revisar estes textos, o que a pessoa leu em agosto precisa
 * continuar identificável depois que a redação mudar em outubro.
 */
export const VERSAO_DO_MURAL = 'rascunho-0';

/** Enquanto for `false`, a interface É OBRIGADA a exibir a marca de não validado. */
export const MURAL_VALIDADO_CLINICAMENTE = false;

export const MURAL_DE_SINTOMAS: readonly VerbeteDoMural[] = [
  {
    sintoma: 'FEBRE',
    titulo: 'Febre',
    resumo:
      'Durante a quimioterapia a febre tem peso diferente do que tinha antes, e é o sinal que a equipe mais quer saber cedo.',
    porQueAcontece:
      'A quimioterapia reduz por alguns dias as células de defesa do corpo. Nesse período uma infecção pequena avança mais rápido do que avançaria antes, e a febre costuma ser o primeiro aviso, às vezes o único.',
    oQueEsperar: [
      'A queda de defesa costuma acontecer nos dias seguintes à sessão, e o serviço informa em quais dias ela é mais provável no seu protocolo.',
      'Você pode se sentir bem e ter febre assim mesmo. Sentir-se bem não descarta.',
    ],
    emCasa: [
      'Meça a temperatura sempre que sentir calor, calafrio ou moleza, e não só quando parecer óbvio.',
      'Anote o valor e a hora. É isso que a equipe usa para decidir, e é a pergunta que o check-in faz.',
    ],
    quandoProcurar: [
      'Entre em contato no mesmo dia se a temperatura passar de 37,8 °C.',
      'Não tome remédio para baixar a febre antes de falar com a equipe: o remédio esconde o sinal e atrasa a avaliação.',
      'Calafrio forte, tremor ou moleza fora do comum pedem contato mesmo com a temperatura ainda normal.',
    ],
  },
  {
    sintoma: 'DIARREIA',
    titulo: 'Diarreia',
    resumo:
      'Comum em vários protocolos. O que muda a conduta não é o incômodo, é quanto líquido você está perdendo.',
    porQueAcontece:
      'Alguns medicamentos irritam o revestimento do intestino, que se renova rápido e por isso sente antes. O intestino passa a absorver menos água.',
    oQueEsperar: [
      'Pode aparecer nos primeiros dias depois da sessão e ceder sozinha.',
      'A frequência varia de um ciclo para outro, mesmo com a mesma medicação.',
    ],
    emCasa: [
      'Beba líquido em goles ao longo do dia, sem esperar sede. Perder água é o que mais rápido complica.',
      'Refeições menores e mais frequentes pesam menos que três grandes.',
      'Se você tem remédio receitado para isso, use conforme a receita. Nada novo deve ser começado por conta própria.',
    ],
    quandoProcurar: [
      'Procure a equipe se as evacuações aumentarem muito em relação ao seu normal, ou se durarem mais de um dia sem melhora.',
      'Sangue nas fezes pede contato imediato.',
      'Se você não estiver conseguindo beber água, ou notar boca muito seca, tontura ao levantar e urina muito escura, não espere o próximo dia.',
    ],
  },
  {
    sintoma: 'NAUSEA_VOMITO',
    titulo: 'Enjoo e vômito',
    resumo:
      'Dos efeitos mais frequentes, e um dos que mais têm remédio eficaz, desde que a equipe saiba que está acontecendo.',
    porQueAcontece:
      'A medicação estimula a área do cérebro que controla o vômito, e também irrita o estômago. Por isso o enjoo pode vir mesmo sem nada no estômago.',
    oQueEsperar: [
      'Costuma ser mais forte nas primeiras 24 a 48 horas depois da sessão.',
      'Cheiros fortes, comida gordurosa e jejum longo costumam piorar.',
    ],
    emCasa: [
      'Coma em porções pequenas ao longo do dia; estômago vazio costuma enjoar mais.',
      'Beba líquidos gelados em goles, mesmo sem vontade.',
      'Use o remédio para enjoo que está na sua receita, no horário orientado, inclusive nos dias em que você acha que não vai precisar, se foi assim que a equipe orientou.',
    ],
    quandoProcurar: [
      'Procure a equipe se você vomitar repetidamente e não conseguir segurar líquido.',
      'Se não conseguir tomar os remédios de uso contínuo por causa do vômito, avise no mesmo dia.',
      'Vômito com sangue ou com aspecto de borra de café pede contato imediato.',
    ],
  },
  {
    sintoma: 'DOR',
    titulo: 'Dor',
    resumo:
      'Dor tratada cedo é mais fácil de controlar. Aguentar calado não ajuda o tratamento e não é sinal de força.',
    porQueAcontece:
      'Pode vir da própria doença, do efeito da medicação sobre nervos e mucosas, ou do local do cateter. Onde dói diz mais à equipe do que o quanto dói.',
    oQueEsperar: [
      'Dor no corpo e nas articulações nos dias seguintes à sessão é relatada com frequência.',
      'A intensidade tende a variar ao longo do dia.',
    ],
    emCasa: [
      'Se você tem analgésico receitado, use conforme a receita, no horário, sem esperar a dor ficar forte.',
      'Anote onde dói e em que horas piora. É isso que permite mudar a conduta com segurança.',
    ],
    quandoProcurar: [
      'Procure a equipe se a dor aumentar, mudar de lugar ou não ceder com o que está na sua receita.',
      'Dor no peito e falta de ar juntas pedem atendimento imediato, não contato pelo aplicativo.',
      'Dor, vermelhidão ou inchaço no local do cateter pedem avaliação no mesmo dia.',
    ],
  },
  {
    sintoma: 'FALTA_DE_AR',
    titulo: 'Falta de ar',
    resumo:
      'É o sintoma desta lista com menor margem para esperar. Na dúvida, o caminho é o serviço, não o aplicativo.',
    porQueAcontece:
      'Pode vir de anemia, que é comum durante o tratamento, mas também de causas que precisam de avaliação rápida. Só o exame distingue, e não dá para distinguir de casa.',
    oQueEsperar: [
      'Cansaço ao subir escada ou ao caminhar mais que o habitual aparece com frequência quando a anemia se instala.',
      'Esse cansaço costuma vir junto com palidez e sono fora do comum.',
    ],
    emCasa: [
      'Distribua esforço ao longo do dia e aceite ajuda nas tarefas pesadas.',
      'Repare em quando a falta de ar aparece: subindo escada, andando no plano, ou parado. A diferença entre esses três muda a conduta.',
    ],
    quandoProcurar: [
      'Falta de ar em repouso, ou que apareceu de repente, é procura imediata pelo serviço.',
      'Se vier com dor no peito, lábios ou pontas dos dedos arroxeados, procure atendimento agora.',
      'Falta de ar que piorou de um dia para o outro merece contato no mesmo dia, mesmo que seja leve.',
    ],
  },
];

/** O verbete de um sintoma, ou `undefined` quando o mural ainda não cobre aquele ramo. */
export function verbeteDoSintoma(sintoma: Sintoma): VerbeteDoMural | undefined {
  return MURAL_DE_SINTOMAS.find((verbete) => verbete.sintoma === sintoma);
}

/**
 * `NAUSEA_VOMITO` vira `nausea-vomito`.
 *
 * Mora aqui, e não na tela, porque quem monta o endereço e quem o resolve são
 * arquivos diferentes. Duas implementações da mesma regra é como um link do mural
 * passa a apontar para uma página que não existe.
 */
export function apelidoDoSintoma(sintoma: Sintoma): string {
  return sintoma.toLowerCase().replace(/_/g, '-');
}

/** O verbete a partir do apelido de URL, ou `undefined` se o endereço não bate. */
export function verbetePorApelido(apelido: string): VerbeteDoMural | undefined {
  return MURAL_DE_SINTOMAS.find((verbete) => apelidoDoSintoma(verbete.sintoma) === apelido);
}

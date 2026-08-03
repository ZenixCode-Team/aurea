/**
 * O conteúdo da biblioteca — a enciclopédia do paciente.
 *
 * POR QUE ISTO É UM ARQUIVO SEPARADO, E NÃO MAIS UM TRECHO DO `seed.ts`.
 *
 * O seed começa apagando o banco: são quinze `deleteMany` antes de qualquer escrita.
 * Isso é correto para preparar um ambiente do zero e é destrutivo para publicar
 * conteúdo num ambiente que já está no ar. Como a biblioteca vai crescer texto a
 * texto, e cada texto novo precisa chegar em produção sem levar junto o histórico de
 * check-in de ninguém, a publicação virou operação própria: idempotente, sem apagar
 * nada, segura de rodar quantas vezes for.
 *
 *   pnpm tsx prisma/verbetes-da-biblioteca.ts
 *
 * `seed.ts` chama a mesma função. Uma fonte de conteúdo, dois caminhos até o banco.
 *
 * A CHAVE DE IDEMPOTÊNCIA É O TÍTULO. `VerbeteDaBiblioteca` não tem coluna única além
 * do id, e id gerado não sobrevive a duas execuções. Título é o que um humano usa para
 * dizer "aquele texto sobre enjoo", e mudar o título é, na prática, escrever outro
 * verbete. A consequência está declarada: renomear um título cria um registro novo em
 * vez de atualizar o antigo.
 *
 * ------------------------------------------------------------------------------
 * ESTADO CLÍNICO DESTE CONTEÚDO
 *
 * Rascunho. `autoria` diz isso em toda linha, `revisadoPor` está vazio e a interface
 * exibe o aviso de conteúdo não revisado. Vai para `publicado: true` porque biblioteca
 * vazia não ensina ninguém, e porque a alternativa honesta — mostrar com a marca — é a
 * mesma que o projeto já aplica ao conjunto de limiares `rascunho-0`.
 *
 * O que NÃO está aqui, de propósito: dose, nome de medicamento que não seja categoria
 * geral, e qualquer número de corte que não seja o 37,8 °C que já circula no material
 * do próprio serviço. Inventar limiar clínico em texto de paciente é o erro que a
 * regra 1 do ADR-001 existe para impedir.
 * ------------------------------------------------------------------------------
 */
import { PrismaClient, type CategoriaDaBiblioteca } from '@prisma/client';

const AUTORIA_RASCUNHO = 'RASCUNHO, sem autoria clínica definida';

interface VerbeteSemeado {
  readonly categoria: CategoriaDaBiblioteca;
  readonly titulo: string;
  readonly corpo: string;
}

export const VERBETES_DA_BIBLIOTECA: readonly VerbeteSemeado[] = [
  {
    categoria: 'MEDICAMENTOS',
    titulo: 'Como organizar os remédios em casa',
    corpo:
      'Durante o tratamento a lista de remédios costuma crescer, e alguns têm horário fixo enquanto outros são só se precisar. Confundir os dois é o engano mais comum.\n\nSepare por horário, não por caixa. Um porta-comprimidos de sete dias resolve mais do que qualquer aplicativo, porque mostra num olhar o que já foi tomado.\n\nMantenha a receita mais recente junto dos remédios. Em contato com a equipe, a primeira pergunta costuma ser o que você está tomando e desde quando.\n\nNão comece nada por conta própria, nem chá, nem vitamina, nem remédio que ajudou alguém conhecido. Interação com quimioterapia não é raridade, e algumas reduzem o efeito do tratamento.\n\nSe você esqueceu uma dose, não dobre a próxima. Avise a equipe e siga a orientação que receber.',
  },
  {
    categoria: 'ALIMENTACAO',
    titulo: 'Comer quando não se tem vontade',
    corpo:
      'Perder o apetite é comum, e passar o dia sem comer piora o cansaço que já vem do tratamento.\n\nComa em porções pequenas várias vezes ao dia, em vez de três refeições grandes. Estômago muito cheio enjoa; estômago vazio também.\n\nAlimento frio ou morno costuma incomodar menos que quente, porque solta menos cheiro. Se o cheiro da comida está atrapalhando, peça para alguém preparar e arejar a cozinha antes de você entrar.\n\nBeba líquido entre as refeições, não durante, para não encher o estômago antes da comida.\n\nNos dias ruins, priorize o que tem mais valor por colher: leite, ovo, feijão amassado, purê. Comer pouco de algo nutritivo vale mais que comer muito de algo leve.\n\nSe você não conseguir comer nem beber por mais de um dia, avise a equipe. Isso não é frescura nem falta de esforço.',
  },
  {
    categoria: 'MUCOSITE',
    titulo: 'Feridas na boca durante o tratamento',
    corpo:
      'A mucosa da boca se renova rápido, e por isso sente o efeito da quimioterapia antes de outros tecidos. Aparecem feridas, ardência e sensibilidade.\n\nEscove os dentes com escova macia depois de cada refeição, sem pressa e sem força. Escova dura machuca mucosa fragilizada.\n\nEvite enxaguante com álcool: arde e resseca. Bochecho com água e sal ou com bicarbonato, na proporção que a equipe orientar, costuma aliviar.\n\nComida ácida, apimentada, muito quente ou muito dura piora a dor. Nessa fase, o que passa fácil é o que serve.\n\nSe a boca estiver seca, goles frequentes de água e gelo picado ajudam mais do que beber muito de uma vez.\n\nProcure a equipe se as feridas impedirem você de comer ou beber, se aparecerem placas brancas, ou se vier febre junto.',
  },
  {
    categoria: 'CATETER',
    titulo: 'Cuidados com o cateter',
    corpo:
      'O cateter é a porta de entrada da medicação, e também uma porta de entrada para infecção. É por isso que os cuidados com ele são tão insistentes.\n\nMantenha o curativo seco e íntegro. Se molhar, descolar ou sujar, não troque por conta própria: procure o serviço.\n\nNo banho, siga exatamente a proteção que a equipe orientou para o seu tipo de cateter.\n\nEvite carregar peso e fazer esforço com o braço do lado do cateter, quando for o caso.\n\nOlhe o local uma vez por dia. Você está procurando vermelhidão, inchaço, calor, dor nova ou qualquer secreção.\n\nProcure o serviço no mesmo dia se encontrar qualquer um desses sinais, ou se tiver febre. Infecção de cateter em quem está com a defesa baixa avança rápido e não espera o próximo retorno.',
  },
  {
    categoria: 'QUEDA_DE_CABELO',
    titulo: 'Quando o cabelo cai',
    corpo:
      'Nem todo tratamento derruba cabelo, e quando derruba costuma começar duas a três semanas depois da primeira sessão. Pergunte à sua equipe o que é esperado no seu protocolo.\n\nA queda é temporária na maioria dos casos. O cabelo volta depois do fim do tratamento, às vezes com textura ou cor um pouco diferentes.\n\nAlgumas pessoas preferem cortar curto antes: ver menos fio no travesseiro incomoda menos que ver um tufo. Não existe escolha certa aqui, existe a sua.\n\nUse xampu suave, água morna e evite secador quente, chapinha e tintura durante o período.\n\nO couro cabeludo fica sensível e exposto. Boné, lenço ou chapéu protegem de sol e de frio, e nenhum deles atrapalha o tratamento.\n\nSe isso estiver pesando emocionalmente, diga à equipe. Não é vaidade, e existe apoio para isso no serviço.',
  },
  {
    categoria: 'DIARREIA',
    titulo: 'Diarreia: o que fazer em casa',
    corpo:
      'O risco maior da diarreia durante o tratamento não é o incômodo, é a desidratação, que chega mais rápido do que a maioria das pessoas imagina.\n\nBeba líquido em goles ao longo do dia inteiro, sem esperar sede. Água, água de coco e soro caseiro servem.\n\nPrefira alimento cozido e simples: arroz, batata, macarrão, banana, maçã sem casca, carne magra. Deixe de lado leite, fritura, doce concentrado e alimento com muita fibra enquanto durar.\n\nSe você tem remédio receitado para diarreia, use conforme a receita. Não comece nenhum por conta própria: em alguns quadros o remédio que segura o intestino atrasa o diagnóstico.\n\nAnote quantas vezes ao dia. É a pergunta que a equipe faz, e "muitas" não ajuda a decidir.\n\nProcure a equipe se as evacuações aumentarem muito em relação ao seu normal, se houver sangue, se vier febre junto, ou se você não estiver conseguindo beber água.',
  },
  {
    categoria: 'CONSTIPACAO',
    titulo: 'Intestino preso durante o tratamento',
    corpo:
      'Prender o intestino é tão comum quanto soltar, e costuma vir de três coisas somadas: remédio para enjoo, remédio para dor e menos movimento que o habitual.\n\nBeba água ao longo do dia. Fibra sem água piora, e não melhora.\n\nAumente fibra aos poucos: fruta com casca, verdura, aveia, feijão. De uma vez, dá cólica.\n\nCaminhe o que der, mesmo dentro de casa. Movimento é o que faz o intestino trabalhar.\n\nTente ir ao banheiro sempre no mesmo horário, de preferência depois de uma refeição, sem pressa.\n\nNão use laxante por conta própria. Alguns são desaconselhados em quem está com a defesa baixa ou com plaqueta baixa.\n\nAvise a equipe se passar mais de três dias sem evacuar, ou antes disso se houver dor na barriga, barriga inchada, náusea ou vômito junto.',
  },
  {
    categoria: 'EXERCICIOS',
    titulo: 'Movimento e descanso',
    corpo:
      'O cansaço do tratamento é diferente do cansaço comum: não passa só com sono. E, ao contrário do que parece, ficar parado o dia inteiro costuma aumentá-lo.\n\nCaminhada leve, na maioria dos dias, é o que tem mais evidência a favor. Comece pelo que você consegue hoje, nem que sejam dez minutos.\n\nA régua é conseguir conversar enquanto se movimenta. Se não consegue falar uma frase inteira, diminua o ritmo.\n\nDistribua as tarefas ao longo da semana em vez de concentrar tudo num dia bom. Gastar todo o gás no dia em que se está bem costuma custar os dois dias seguintes.\n\nDescansar também é parte do tratamento, e cochilo curto atrapalha menos a noite do que o longo.\n\nFale com a equipe antes de começar qualquer atividade nova, principalmente musculação e esporte de contato. Em algumas fases, com plaqueta baixa, o risco muda.',
  },
  {
    categoria: 'VACINAS',
    titulo: 'Vacinas durante o tratamento',
    corpo:
      'Durante a quimioterapia a resposta do corpo às vacinas muda, e algumas vacinas deixam de ser seguras. Isso vale para você e, em parte, para quem mora com você.\n\nA regra que mais importa: vacina de vírus vivo, em geral, não é indicada durante o tratamento. Nenhuma vacina deve ser tomada sem falar antes com a sua equipe, nem em campanha, nem em farmácia.\n\nLeve sempre a sua carteira de vacinação às consultas.\n\nQuem mora com você manter as vacinas em dia protege você — é a barreira que sobra quando a sua própria defesa está baixa.\n\nSe você tomou alguma vacina sem saber disso, não entre em pânico: avise a equipe e siga a orientação.',
  },
  {
    categoria: 'DIREITOS_DO_PACIENTE',
    titulo: 'Direitos de quem está em tratamento oncológico',
    corpo:
      'Existem direitos previstos em lei para quem faz tratamento oncológico no Brasil, e boa parte das pessoas descobre tarde demais para usar.\n\nEntre os mais citados estão o início do tratamento no SUS em prazo definido em lei, o transporte e a assistência social pelo serviço, e benefícios previdenciários e trabalhistas conforme a situação de cada um.\n\nAlgumas isenções tributárias e o saque de FGTS e PIS/PASEP também podem se aplicar dependendo do diagnóstico e do estágio.\n\nO caminho para saber o que vale no SEU caso é o serviço social do hospital. É o setor que conhece o que se aplica ao seu diagnóstico e à sua situação, e que ajuda a reunir documento.\n\nEste texto não substitui orientação jurídica nem do serviço social. Ele existe para você saber que a conversa existe e pedir por ela.',
  },
];

/**
 * Publica os verbetes sem apagar nada. Rodar duas vezes não duplica.
 *
 * Não sobrescreve `revisadoPor` nem `revisadoEm`: no dia em que alguém com
 * responsabilidade clínica assinar um verbete, uma execução desta função não pode
 * apagar a assinatura. Só título, corpo e categoria são atualizados.
 */
export async function publicarVerbetes(prisma: PrismaClient): Promise<{
  criados: number;
  atualizados: number;
}> {
  let criados = 0;
  let atualizados = 0;

  for (const verbete of VERBETES_DA_BIBLIOTECA) {
    const existente = await prisma.verbeteDaBiblioteca.findFirst({
      where: { titulo: verbete.titulo },
      select: { id: true },
    });

    if (existente) {
      await prisma.verbeteDaBiblioteca.update({
        where: { id: existente.id },
        data: {
          categoria: verbete.categoria,
          corpo: verbete.corpo,
          autoria: AUTORIA_RASCUNHO,
          publicado: true,
        },
      });
      atualizados += 1;
      continue;
    }

    await prisma.verbeteDaBiblioteca.create({
      data: {
        categoria: verbete.categoria,
        titulo: verbete.titulo,
        corpo: verbete.corpo,
        autoria: AUTORIA_RASCUNHO,
        publicado: true,
      },
    });
    criados += 1;
  }

  return { criados, atualizados };
}

/* Executado direto pela linha de comando; importado, só exporta. Mesmo padrão de
   `servidor.ts`. */
if (process.argv[1]?.endsWith('verbetes-da-biblioteca.ts')) {
  const prisma = new PrismaClient();
  publicarVerbetes(prisma)
    .then(({ criados, atualizados }) => {
      console.log(`Biblioteca: ${criados} criados, ${atualizados} atualizados.`);
      console.log('Todos em RASCUNHO, sem autoria clínica. A interface exibe o aviso.');
    })
    .catch((erro: unknown) => {
      console.error(erro);
      process.exitCode = 1;
    })
    .finally(() => void prisma.$disconnect());
}

'use client';

/**
 * Termo de consentimento — versionado, lido antes de entrar no app.
 *
 * ADR-004: mesma soleira de `/entrar` — coluna de formulário à esquerda, painel
 * institucional com o shader da landing à direita. As três telas de entrada e o
 * consentimento são a mesma porta; aqui a coluna carrega o termo em vez de dois
 * campos, mas a composição é a mesma.
 *
 * O texto é escrito para quem está em tratamento, não para um jurídico. Fala
 * de LGPD, da finalidade do monitoramento e diz sem rodeio que os dados desta
 * fase são sintéticos e que o sistema não substitui atendimento.
 */

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { FundoOrganico } from '@/components/fundo-organico';
import { Botao, Cartao, Medida, Rotulo } from '@/componentes/sistema/primitivos';
import { useSessao } from '@/sistema/sessao';

const DESCRICAO_DA_VERSAO = 'Versão 1.0 · vigente desde junho de 2026';

export default function ConsentimentoPage() {
  const [concordo, setConcordo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const { aceitarConsentimento } = useSessao();
  const router = useRouter();

  async function aoConfirmar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!concordo) return;

    setEnviando(true);
    await new Promise((resolver) => setTimeout(resolver, 350));
    /* Registra a versão aceita antes de navegar — é o que destrava a Guarda. */
    aceitarConsentimento();
    router.replace('/app');
  }

  return (
    <main className="flex min-h-dvh bg-[var(--color-superficie)]">
      <div className="flex w-full flex-col justify-between bg-[var(--color-superficie)] px-6 py-8 sm:px-12 lg:w-[46%] lg:max-w-[38rem]">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-[0.5rem] bg-[var(--color-verde-profundo)] font-mono text-sm font-semibold text-[var(--color-lime)]">
            A
          </span>
          <span className="text-sm font-semibold tracking-tight text-[var(--color-texto)]">
            AUREA
          </span>
        </div>

        <div className="mx-auto w-full max-w-[34rem] py-10">
          <h1 className="text-[2rem] font-semibold leading-tight tracking-[-0.02em] text-[var(--color-texto)]">
            Termo de consentimento
          </h1>
          <p className="mt-2 text-[0.9375rem] leading-relaxed text-[var(--color-texto-suave)]">
            Leia com calma. Você pode voltar aqui sempre que quiser.
          </p>

          <Cartao className="mt-6 flex flex-col overflow-hidden">
            <div className="max-h-[20rem] overflow-y-auto border-b border-[var(--color-borda)] p-6">
              <div className="mb-5 flex items-center justify-between gap-4">
                <Rotulo>Monitoramento remoto de toxicidade</Rotulo>
                <Medida>{DESCRICAO_DA_VERSAO}</Medida>
              </div>

              <div className="flex flex-col gap-5 text-sm leading-relaxed text-[var(--color-texto-suave)]">
                <section className="flex flex-col gap-1.5">
                  <h2 className="text-base font-medium text-[var(--color-texto)]">
                    Para que serve este monitoramento
                  </h2>
                  <p>
                    O AUREA pergunta, todo dia, como você está passando durante a
                    quimioterapia. Suas respostas ajudam a equipe a perceber cedo um
                    efeito colateral que precise de atenção — o objetivo é encurtar a
                    distância entre o sintoma aparecer em casa e a equipe saber disso.
                  </p>
                </section>

                <section className="flex flex-col gap-1.5">
                  <h2 className="text-base font-medium text-[var(--color-texto)]">
                    Como seus dados são usados
                  </h2>
                  <p>
                    Os dados que você registra ficam associados ao seu tratamento e são
                    vistos pela equipe clínica responsável por você. Este uso segue a Lei
                    Geral de Proteção de Dados (Lei 13.709/2018): a finalidade é o cuidado
                    em saúde e a pesquisa clínica associada a este serviço, os dados não
                    são vendidos nem usados para outro fim, e você pode pedir acesso,
                    correção ou exclusão do que foi registrado a qualquer momento, falando
                    com a equipe.
                  </p>
                </section>

                <section className="flex flex-col gap-1.5">
                  <h2 className="text-base font-medium text-[var(--color-texto)]">
                    Nesta fase, os dados são sintéticos
                  </h2>
                  <p>
                    Enquanto o sistema está em validação, tudo que aparece nas telas —
                    nomes, respostas, históricos — é fictício, criado só para testar a
                    interface. Nenhuma informação real de paciente trafega por aqui ainda.
                    Você será avisado quando essa fase terminar e dados reais passarem a
                    ser usados.
                  </p>
                </section>

                <section className="flex flex-col gap-1.5">
                  <h2 className="text-base font-medium text-[var(--color-texto)]">
                    Isto não substitui atendimento
                  </h2>
                  <p>
                    Responder ao check-in diário não troca uma consulta, um pronto
                    atendimento ou uma ligação para a equipe. Se você sentir algo grave
                    ou tiver dúvida sobre um sintoma, procure o serviço diretamente —
                    não espere a próxima pergunta do sistema aparecer.
                  </p>
                </section>

                <section className="flex flex-col gap-1.5">
                  <h2 className="text-base font-medium text-[var(--color-texto)]">
                    Sua participação é voluntária
                  </h2>
                  <p>
                    Você pode deixar de participar a qualquer momento, sem que isso mude
                    o seu tratamento ou o cuidado que você recebe. Para retirar o
                    consentimento, fale com a equipe do serviço.
                  </p>
                </section>
              </div>
            </div>

            <form onSubmit={aoConfirmar} className="flex flex-col gap-4 p-6">
              <label className="flex items-start gap-3 text-sm text-[var(--color-texto)]">
                <input
                  type="checkbox"
                  checked={concordo}
                  onChange={(evento) => setConcordo(evento.target.checked)}
                  disabled={enviando}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-[var(--color-borda-forte)] accent-[var(--color-superficie-invertida)]"
                />
                <span>Li e concordo com os termos acima.</span>
              </label>
              <Botao type="submit" tamanho="amplo" disabled={!concordo || enviando}>
                {enviando ? 'Confirmando…' : 'Concordo e continuar'}
              </Botao>
            </form>
          </Cartao>
        </div>

        <p className="text-xs text-[var(--color-texto-fraco)]">
          Monitoramento remoto de toxicidade em quimioterapia.
        </p>
      </div>

      <aside
        aria-hidden
        className="relative hidden overflow-hidden bg-[var(--color-verde-profundo)] lg:block lg:flex-1"
      >
        <FundoOrganico escalas={[2.6, 2.2, 3.1, 2.4]} />
        <div className="grain absolute inset-0" />
        {/*
          Véu de contraste. O campo é animado: a mesma área passa de verde escuro a
          creme claro ao longo da deriva, e texto claro sobre ela fica ilegível em
          metade dos quadros. Um degradê fixo garante o contraste em qualquer estado
          — legibilidade não pode depender do instante em que a pessoa olhou.
        */}
        <div className="absolute inset-0 bg-gradient-to-t from-[rgba(20,32,26,0.72)] via-[rgba(20,32,26,0.28)] to-[rgba(20,32,26,0.12)]" />
        <div className="relative flex h-full flex-col justify-between px-12 py-12">
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.2em] text-[var(--color-creme)]/80">
            {'// consentimento e cuidado'}
          </p>

          <div className="max-w-[26rem]">
            <p className="display text-[3rem] text-[var(--color-creme)]">
              Seus dados.
              <br />
              Sua decisão, sempre.
            </p>
            <p className="mt-5 text-[0.9375rem] leading-relaxed text-[var(--color-creme)]/80">
              Você lê antes de decidir, e pode voltar a esta página sempre que quiser
              rever o que aceitou.
            </p>
          </div>

          <p className="text-[1.75rem] leading-tight text-[var(--color-creme)]">
            Obrigado por ler.
          </p>
        </div>
      </aside>
    </main>
  );
}

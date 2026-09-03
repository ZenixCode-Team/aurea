/**
 * Índice dos cadastros administrativos.
 *
 * Paciente, profissional, tratamento, ciclo e prescrição hoje só nascem por seed
 * no banco — não existe endpoint de escrita para nenhum deles. As cinco telas
 * abaixo existem para que o formulário já esteja pronto quando a Onda F ligar a
 * gravação. Até lá, cada uma guarda o que foi digitado em estado local e diz isso
 * com todas as letras.
 *
 * Composição conforme o ADR-004: cabeçalho com trilha e contexto, e uma grade de
 * cartões navegáveis — um por entidade — em vez de título solto sobre grade vazia.
 */

import Link from 'next/link';
import { CabecalhoDePainel } from '@/componentes/sistema/painel';
import { Aviso, Rotulo } from '@/componentes/sistema/primitivos';
/* Direto do módulo puro: esta página é componente de SERVIDOR e não pode chamar
   função exportada por módulo cliente. Ver o comentário em `juntar.ts`. */
import { juntar } from '@/componentes/sistema/juntar';

interface EntidadeDoCadastro {
  readonly href: string;
  readonly titulo: string;
  readonly descricao: string;
  readonly dependeDe: string;
}

const ENTIDADES: readonly EntidadeDoCadastro[] = [
  {
    href: '/admin/cadastros/pacientes',
    titulo: 'Pacientes',
    descricao: 'Dados da pessoa em tratamento: identificação, diagnóstico e contatos.',
    dependeDe: 'Não depende de nenhum outro cadastro.',
  },
  {
    href: '/admin/cadastros/equipe',
    titulo: 'Equipe',
    descricao: 'Profissionais e usuários do sistema, com função e permissões de acesso.',
    dependeDe: 'Não depende de nenhum outro cadastro.',
  },
  {
    href: '/admin/cadastros/tratamentos',
    titulo: 'Tratamentos',
    descricao: 'Liga um paciente a um protocolo e a um médico assistente.',
    dependeDe: 'Depende de Pacientes e do cadastro de protocolos (hoje só existe por seed).',
  },
  {
    href: '/admin/cadastros/ciclos',
    titulo: 'Ciclos',
    descricao: 'Registra a sessão realizada dentro de um tratamento e projeta a próxima.',
    dependeDe: 'Depende de Tratamentos e da duração de ciclo do protocolo.',
  },
  {
    href: '/admin/cadastros/prescricoes',
    titulo: 'Prescrições',
    descricao: 'Associa um medicamento, dose, via e posologia a um paciente.',
    dependeDe: 'Depende de Pacientes e do cadastro de medicamentos (hoje só existe por seed).',
  },
];

export default function PaginaDeCadastros() {
  return (
    <>
      <CabecalhoDePainel
        trilha={[{ rotulo: 'Administração' }, { rotulo: 'Cadastros' }]}
        titulo="Cadastros"
        descricao="Pacientes, equipe, tratamentos, ciclos e prescrições, as cinco entidades administrativas do AUREA."
      />

      <div className="mb-6">
        <Aviso tom="atencao" titulo="Nenhuma destas telas grava no servidor">
          A API ainda não tem endpoint de escrita para paciente, profissional, tratamento, ciclo
          ou prescrição; isso é escopo da Onda F. As cinco telas abaixo funcionam com estado
          local: o que você cadastrar fica só nesta aba, some ao recarregar a página, e nunca
          chega ao banco. É melhor uma tela honesta sobre isso do que um formulário que finge
          salvar.
        </Aviso>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ENTIDADES.map((entidade) => (
          <Link
            key={entidade.href}
            href={entidade.href}
            className={juntar(
              'group flex flex-col gap-2.5 rounded-[var(--radius-amplo)] border border-[var(--color-borda)]',
              'bg-[var(--color-superficie-alta)] p-5 shadow-[var(--sombra-cartao)]',
              'transition-all duration-150 hover:-translate-y-px hover:shadow-[var(--sombra-elevada)]',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <Rotulo>Cadastro</Rotulo>
              <span
                aria-hidden
                className="text-[var(--color-texto-fraco)] transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-[var(--color-texto)]"
              >
                →
              </span>
            </div>
            <h2 className="text-lg font-semibold text-[var(--color-texto)]">{entidade.titulo}</h2>
            <p className="text-sm leading-relaxed text-[var(--color-texto-suave)]">
              {entidade.descricao}
            </p>
            <p className="mt-auto pt-1 text-xs text-[var(--color-texto-fraco)]">
              {entidade.dependeDe}
            </p>
          </Link>
        ))}
      </div>
    </>
  );
}

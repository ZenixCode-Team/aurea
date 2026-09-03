'use client';

/**
 * E6 — Conta.
 *
 * ADR-004: cabeçalho com trilha + linha de indicadores + blocos, no lugar do
 * título solto sobre cartões soltos. Identidade e permissões do profissional,
 * mais os dois únicos comandos que fazem sentido aqui: trocar senha e sair.
 * Nada de configuração — isso é domínio do admin, não do plantão.
 */

import { useRouter } from 'next/navigation';
import { Bloco, CabecalhoDePainel, CartaoDeIndicador, LinhaDeIndicadores } from '@/componentes/sistema/painel';
import { Botao } from '@/componentes/sistema/primitivos';
import { useSessao } from '@/sistema/sessao';
import type { Permissao } from '@/sistema/tipos';

const ROTULO_DA_PERMISSAO: Record<Permissao, string> = {
  ATENDER_PLANTAO: 'Atender plantão',
  VER_HISTORICO_DE_PACIENTE: 'Ver histórico de paciente',
  REGISTRAR_INTERVENCAO: 'Registrar intervenção',
  EDITAR_ALGORITMO: 'Editar algoritmo',
  PUBLICAR_ALGORITMO: 'Publicar algoritmo',
  EDITAR_ORIENTACAO: 'Editar orientação',
  GERENCIAR_CADASTROS: 'Gerenciar cadastros',
  GERENCIAR_USUARIOS: 'Gerenciar usuários',
  EXPORTAR_CONJUNTO_DE_PESQUISA: 'Exportar conjunto de pesquisa',
};

export default function PaginaDeConta() {
  const { usuario, sair } = useSessao();
  const router = useRouter();

  if (!usuario) return null;

  return (
    <>
      <CabecalhoDePainel
        trilha={[{ rotulo: 'Você' }, { rotulo: 'Conta' }]}
        titulo="Conta"
        descricao="Identidade e permissões deste acesso."
      />

      <LinhaDeIndicadores>
        <CartaoDeIndicador rotulo="Perfil" valor="Enfermagem" apoio="papel deste acesso" />
        <CartaoDeIndicador
          rotulo="Permissões"
          valor={usuario.permissoes.length}
          apoio="concedidas a este acesso"
        />
      </LinhaDeIndicadores>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Bloco titulo="Identidade" descricao="Quem está com a sessão aberta.">
          <dl>
            <div className="flex items-baseline justify-between gap-4 border-b border-[var(--color-borda)] py-2.5">
              <dt className="text-sm text-[var(--color-texto-fraco)]">Nome</dt>
              <dd className="text-right text-sm text-[var(--color-texto)]">{usuario.nome}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 py-2.5">
              <dt className="text-sm text-[var(--color-texto-fraco)]">Perfil</dt>
              <dd className="text-right text-sm text-[var(--color-texto)]">Enfermagem</dd>
            </div>
          </dl>

          <div className="mt-4 flex flex-wrap gap-3 border-t border-[var(--color-borda)] pt-4">
            <Botao variante="secundario" onClick={() => router.push('/entrar/primeiro-acesso')}>
              Trocar senha
            </Botao>
            <Botao
              variante="secundario"
              onClick={() => {
                sair();
                router.replace('/entrar');
              }}
            >
              Sair
            </Botao>
          </div>
        </Bloco>

        <Bloco titulo="Permissões" descricao="O que este acesso pode fazer no sistema.">
          {usuario.permissoes.length === 0 ? (
            <p className="text-sm text-[var(--color-texto-suave)]">
              Nenhuma permissão associada a este acesso.
            </p>
          ) : (
            <ul className="flex flex-col">
              {usuario.permissoes.map((permissao, indice) => (
                <li
                  key={permissao}
                  className={
                    indice === usuario.permissoes.length - 1
                      ? 'py-2 text-sm text-[var(--color-texto)]'
                      : 'border-b border-[var(--color-borda)] py-2 text-sm text-[var(--color-texto)]'
                  }
                >
                  {ROTULO_DA_PERMISSAO[permissao]}
                </li>
              ))}
            </ul>
          )}
        </Bloco>
      </div>
    </>
  );
}

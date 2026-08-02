import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * Lint da API.
 *
 * O `package.json` declarava `lint` desde o começo e o eslint nunca esteve instalado
 * aqui — `pnpm lint` na raiz falhava com `command not found`, e como o hábito era rodar
 * o lint de dentro de `apps/web`, ninguém via. Resultado: a API nunca foi lintada.
 *
 * A configuração é deliberadamente enxuta. O que segura a qualidade neste projeto é o
 * TypeScript estrito e o `conformidade.mjs`; o lint aqui existe para pegar a classe de
 * erro que o compilador não pega — promessa ignorada, variável morta, `any` explícito.
 */
export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'prisma/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      /* Promessa não aguardada em rota de API é resposta enviada antes da escrita
         terminar. Erro, não aviso. */
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      /* `_` no começo marca parâmetro que existe por assinatura e não é usado —
         acontece nos handlers do Fastify. */
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
);

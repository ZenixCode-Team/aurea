# ADR-003 — Monorepo e núcleo da triagem

| | |
|---|---|
| Data | 2026-07-30 |
| Status | **aceito** |
| Decisor | João (negócio) · MAESTRO (técnica) |
| Substitui | **ADR-001 §3, apenas a linha "Repositórios"**. Todo o resto do ADR-001 continua valendo. |

---

## Contexto

O ADR-001 §3 fechou a stack e registrou `aurea-api` e `aurea-web` como **repositórios
separados**, com a justificativa de que a API seria consumida pelo app nativo na fase 2.

O João decidiu por **monorepo**. A decisão é dele e vale. O que mudou de ontem para hoje,
tecnicamente, foi a especificação do núcleo ficar clara: o contrato "resposta crua →
classificação" tem **três consumidores simultâneos hoje**, não dois amanhã.

---

## Decisão

Um repositório, `~/Projetos-Zenix/aurea`, com pnpm workspaces.

```
aurea/
├── apps/
│   ├── web/        Next 16 · a landing já construída
│   └── api/        Fastify 5 · Prisma · MySQL
└── packages/
    ├── contratos/  árvore do questionário · schemas Zod · tipos da classificação
    └── triagem/    o motor de classificação — função pura, sem I/O
```

### Por que o monorepo, e não os dois repositórios

O argumento de peso não é conveniência de desenvolvimento — é **duplicação de contrato**.

A árvore de sintomas e o formato da resposta crua são consumidos por:

1. **web** — para renderizar o questionário e tipar o formulário
2. **api** — para validar o envio e alimentar o motor
3. **o script de reprocessamento da dissertação** — para reclassificar o histórico
   inteiro quando os limiares mudarem

Em repositórios separados, ou se publica um pacote versionado a cada mudança de campo, ou
se mantém duas cópias do mesmo Zod. A segunda opção é literalmente o risco que o vault já
descreve em `Especificação completa`: *"duas cópias do mesmo conteúdo divergem sozinhas"*.
Divergir aqui não é inconsistência de estilo — é o aplicativo gravar resposta num campo
que o motor não lê, silenciosamente.

O argumento original do ADR-001 (a API servirá o app nativo na fase 2) **continua
verdadeiro e continua atendido**: a API é um serviço próprio, com deploy próprio, e o app
nativo consumirá HTTP igual. Monorepo é topologia de código-fonte, não de implantação.

### Custo assumido

Deploy na Coolify passa a apontar para subdiretórios do mesmo repositório em vez de dois
repositórios. É configuração, não arquitetura, e o `build` de cada app já é independente.

---

## O núcleo: onde mora o conhecimento clínico

Esta é a parte que não estava em nenhum ADR e é o que torna a regra 1 do ADR-001 real.

### `packages/triagem` — o motor não sabe o que é febre

`classificar(respostas, conjuntoDeLimiares, contexto)` é uma **função pura**: sem banco,
sem relógio, sem rede. Ela compara valores contra cortes que vieram da tabela. Não existe
um único número clínico dentro do programa.

Três consequências que valem a decisão:

- **Testável sem infraestrutura.** 20 testes rodam em 5 ms, sem MySQL.
- **Reprocessável.** Rodar o histórico inteiro sob um conjunto novo e comparar com o
  antigo é o experimento da dissertação. Com o motor acoplado ao banco, seria um segundo
  programa.
- **Explicável.** A saída carrega qual regra disparou, com que valor observado e com qual
  justificativa. Isso vai gravado em `classificacoes.explicacao` e é o que responde à
  banca "por que aquele dia foi amarelo".

### A fronteira: árvore é código, limiar é dado

| | Onde mora | Por quê |
|---|---|---|
| **Quais perguntas existem** e como se encadeiam | código, em `packages/contratos` | muda raramente; cada mudança exige tela, coluna e revisão clínica |
| **A partir de qual valor vira amarelo/vermelho** | dado, em `conjuntos_de_limiares` | muda dezenas de vezes na validação e não pode esperar deploy |

Transformar a árvore em dado significaria construir um montador de formulário, com campo
sem tipo e validação genérica. É um segundo produto e nada na especificação pede.

### As seis decisões em aberto viraram colunas

A `Triagem de sintomas` lista seis coisas que precisam ser decididas na tela 6. Cinco delas
**agora são configuração**, não código pendente:

| Decisão em aberto | Onde ela vive |
|---|---|
| 1. Corte de cada sintoma isolado | `regras_de_limiar.valor` |
| 2. Como sintomas se somam | `conjuntos_de_limiares.combinacao` |
| 3. Se o dia do ciclo entra na conta | `regras_de_limiar.diaDoCicloMinimo/Maximo` |
| 4. Se o protocolo muda o corte | `regras_de_limiar.protocoloId` |
| 5. Qual o efeito do antitérmico | `conjuntos_de_limiares.efeitoDoAntitermico` |
| 6. Como a resposta ausente é tratada | `conjuntos_de_limiares.tratamentoDeAbandono` |

O orientador define os valores; ninguém recompila nada.

---

## O conjunto `rascunho-0` — leia antes de mostrar para alguém da saúde

Existe um conjunto de limiares publicado no banco de desenvolvimento com
`validadoClinicamente = false`. **Nenhum número dele tem base clínica.**

- **Febre (37,8 e 38,5)** — são os dois primeiros valores da lista de exemplo da própria
  especificação original. Não são cortes propostos por ninguém: são os únicos números de
  temperatura que existem no material de origem, reaproveitados como referência rastreável
  em vez de palpite novo.
- **Todo o resto** — diarreia, vômito, dor e falta de ar não têm nenhum número no material
  de origem. Os valores existem para o motor ter o que comparar em demonstração. Zero
  informação clínica.

Toda classificação sai carimbada com `validadoClinicamente: false`, e a interface é
**obrigada** a exibir a marca. Apresentar a cor como conduta validada é o pior erro
possível deste produto.

---

## Três desvios da especificação, cada um recomendado pelo próprio vault

Precisam de confirmação clínica antes de rodar com paciente real:

1. **Febre vira entrada numérica** com uma casa decimal, no lugar da lista fixa de três
   valores. A lista não registra 38,0 nem 40,1 e o degrau entre 38,5 e 39,2 esconde
   justamente a faixa onde a conduta muda.
2. **Náusea ganha pergunta de porta.** Na especificação o ramo começava em "vomitou?", e
   náusea sem vômito ficava fora do sistema inteiro — apesar de a tela 7 dar como exemplo
   a orientação de náusea leve.
3. **Dor ganha lista fechada de localização.** A lista de locais é invenção deste build:
   não veio da especificação. Existe para que a localização possa virar regra, que é o uso
   defensável da árvore de dor.

---

## Decisões menores, registradas para não serem redecididas

**Sessão é token opaco, não JWT.** JWT não é revogável antes de expirar sem lista de
bloqueio — que é a mesma consulta ao banco que o token opaco já faz, com mais peças. Num
sistema que carrega diagnóstico oncológico, "derrubar esta sessão agora" precisa funcionar
no instante: aparelho perdido, desligamento de profissional, suspeita de acesso indevido.
O banco guarda o hash do token, nunca o token.

**Dia do ciclo é derivado, nunca coluna.** É a diferença entre a data do check-in e a data
da sessão de quimioterapia. Guardado em coluna, nasceria errado no dia seguinte. Quando
entra numa classificação, fica congelado dentro da explicação daquela classificação — que
é onde ele precisa ser imutável.

**"Pacientes do dia" é quem deveria ter respondido, não quem respondeu.** Se a lista
nascesse das respostas recebidas, o paciente que não conseguiu responder desapareceria da
tela — e ele é o caso de maior risco. A ordem é gravidade e depois tempo de silêncio, não
alfabética: ordem alfabética esconde o vermelho no meio da lista.

**Login não revela quem está cadastrado.** CPF inexistente e senha errada devolvem a mesma
mensagem, e o servidor gasta o mesmo tempo nos dois casos (comparação contra hash
descartável). Saber quem está na lista de pacientes oncológicos já é vazamento de dado de
saúde, mesmo sem abrir prontuário.

---

## Estado verificado

| Prova | Resultado |
|---|---|
| `pnpm -r typecheck` | 4 projetos, 0 erro |
| `pnpm -r test` | 20 testes do motor, 20 passando |
| `pnpm --filter @aurea/web build` | build de produção passa |
| Migração contra MySQL local | 28 tabelas criadas |
| `pnpm --filter @aurea/api prova` | 33 conferências, 33 passando |

A prova ponta a ponta roda contra a API real e cobre: login por CPF e por e-mail, recusa
sem enumeração de usuário, separação entre permissão de plantão e de algoritmo,
idempotência do check-in, validação contra a árvore, classificação verde e vermelha,
explicação com regra e valor, regra 8 (paciente com prescrição recebe o texto que nomeia o
remédio, paciente sem prescrição recebe o que não nomeia), isolamento entre pacientes,
ordenação do painel, ausência aparecendo como `SEM_RESPOSTA_HOJE`, e registro de
intervenção amarrado à sessão que gerou o alerta.

---

## Pendências que este ADR abre

1. **Testes automatizados da API.** A cobertura hoje é a prova de fumaça, que precisa do
   servidor no ar. O motor tem teste unitário; as rotas não.
2. **Regra 7 está pela metade.** `ParticipanteDePesquisa` existe e é a ponte para o código
   pseudonimizado, mas a separação entre base operacional e conjunto de pesquisa é
   **lógica, não física** — os dois saem do mesmo banco. Separação física é decisão do
   gate LGPD e precisa de ADR próprio.
3. **Exportação do conjunto de pesquisa** não existe ainda.
4. **Cadastro administrativo** (telas de admin para limiar, orientação, protocolo) não
   existe: hoje o conjunto entra por seed.
5. **O alerta continua sem dono e sem prazo.** A notificação vai para todos com permissão
   de plantão porque não existe regra de escala. Continua sendo decisão de segurança
   clínica, aberta desde o ADR-001.
6. **Nada foi commitado ainda.** O repositório existe, `git init` foi feito, zero commits.

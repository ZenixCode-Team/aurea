# ADR-001 — Plataforma, stack e topologia do AUREA

- **Data:** 2026-07-30
- **Status:** ACEITO
- **Decisor:** João Lopes (negócio) + MAESTRO (técnica)
- **Fontes:** `entregas/022-dossie-aurea.md` · vault `House/Mestrado/AUREA/*`

---

## Contexto

O AUREA é uma plataforma de monitoramento remoto de toxicidade em quimioterapia,
e é o produto tecnológico exigido pelo mestrado profissional do PPGITS/UFS.

Estado no momento da decisão:
- Especificação funcional completa (6 notas do vault, 1.030 linhas). **Zero código.**
- Zero decisão de engenharia registrada: sem stack, plataforma, design ou hospedagem.
- Três perfis com necessidades distintas: paciente (mobile), enfermagem (dashboard),
  administrador (CRUD).
- Prazo do programa: 24 meses máximo com produto validado. Edital projetado para
  ~setembro/2026 — o anteprojeto vale 50% da nota e a defesa oral 40%.
- Dois bloqueios não-técnicos abertos: Comitê de Ética (CEP) e LGPD. Sem CEP não
  pode existir dado de paciente real.
- O maior buraco funcional: **os limiares de risco (🟢🟡🔴) não existem**. Sem eles
  não há classificação — há telas.

**Alvo definido pelo João:** opção (c) — demo com dado sintético agora, evoluindo
para sistema real no serviço após o CEP. Não são dois produtos; é um produto com
dois estágios de dado.

---

## Decisão

### 1. Web-first. App nativo é canal de distribuição da fase 2.

Todas as três superfícies nascem na web. O app nativo (iOS/Android) só é considerado
depois de: limiares validados + CEP aprovado + produto rodando com paciente real.

**Por quê:**
- Painel da enfermagem e painel admin são intrinsecamente web. Web é obrigatória
  de qualquer forma — a única escolha real era sobre o paciente.
- O ciclo de feedback é o produto. Orientador, banca e enfermagem do serviço
  precisam abrir um link, não instalar um build.
- Os limiares vão mudar dezenas de vezes durante a validação clínica. Deploy web
  leva segundos; revisão de loja leva dias. Com app nativo, o cronograma do
  mestrado fica refém da Apple.
- Antes do CEP não existe usuário real. Publicar app para demonstrar algo que não
  pode ter usuário é gastar semanas em burocracia que não compra nada.

**Concessão aceita:** push notification nativo. Web push no iOS só funciona com a
PWA instalada na tela de início e é frágil. Mitigação decidida: canal de lembrete
por WhatsApp/SMS, que para o público-alvo (paciente oncológico, frequentemente
idoso) tem entrega melhor que push de qualquer forma. Canal definitivo fica para
ADR próprio.

### 2. Landing page é a porta de entrada única dos três perfis.

Um domínio, uma sessão, um deploy. A landing apresenta o produto e conduz ao login;
o login roteia por papel.

```
/                → landing pública (institucional + porta de entrada)
/entrar          → login único (CPF+senha para paciente, e-mail para profissional)
/app/*           → paciente        (PWA instalável, mobile-first)
/painel/*        → enfermagem      (dashboard + histórico + intervenção)
/admin/*         → administrador   (CRUD de protocolo, orientação, algoritmo…)
```

**Regra de UX que decorre disso e que é vinculante:** a landing é porta de entrada
para *descoberta e primeiro acesso*. Ela **não** entra no caminho diário do paciente.
Depois do primeiro acesso, a PWA instalada abre direto no check-in do dia. Paciente
debilitado não navega marketing todo dia para responder um questionário.

### 3. Stack — padrão ZenixCode, sem invenção.

| Camada | Escolha |
|---|---|
| Linguagem | TypeScript |
| Front | Next.js + React + Tailwind |
| Back | Node + Prisma + MySQL |
| Package manager | pnpm |
| Auth | Auth.js v5 |
| Validação | Zod + react-hook-form |
| Estado | Zustand |
| Testes | Vitest + Playwright |
| Deploy | Hostinger + Coolify |
| Repos | `aurea-api` e `aurea-web` separados |

**Por que repos separados** (e não server actions monolíticas): é o padrão já em
produção nos outros projetos do João, e a API vai ser consumida pelo app nativo na
fase 2. Escrever a API separada não é custo extra — é antecipar trabalho que seria
feito igual.

### 4. Regras duras de arquitetura — valem do primeiro commit.

Estas não são refinamento. São requisito, e a maioria vem do próprio vault:

1. **Limiares e algoritmo são dado versionado no banco, nunca código.**
   Isso destrava o build inteiro sem ter os números ainda: constrói-se app, painel
   e banco completos, e pluga-se o limiar quando o orientador definir CTCAE ou
   protocolo institucional. (`Triagem de sintomas.md:95`)
2. **A resposta crua do paciente é persistida sempre** — temperatura informada,
   número de episódios, uso de antitérmico. Sem ela não há reprocessamento
   histórico quando a regra mudar, e não há como validar o produto na dissertação.
   É o dado mais importante do banco. (`Modelo de dados.md:34`)
3. **Orientação também é versionada.** Classificação de março precisa continuar
   explicável com a regra que valia em março. (`Modelo de dados.md:57`)
4. **`Sintomas` é decomposta em `resposta de triagem` + `intervenção`.** A entidade
   original empilha resposta do paciente e ação da equipe numa linha só — autores,
   momentos e permissões diferentes. (`Modelo de dados.md:31`)
5. **Log de acesso desde o dia 1** — quem abriu o histórico de quem. Requisito LGPD.
6. **Permissão de editar algoritmo ≠ permissão de plantão.** Quem muda a regra de
   classificação muda o risco de todos os pacientes de uma vez.
7. **Base operacional separada do conjunto de pesquisa anonimizado.** Duas visões
   no mínimo. Entra na metodologia da dissertação.
8. **Orientação só nomeia medicamento que consta na prescrição registrada daquele
   paciente.** Nos outros casos, orienta sem nomear. Sair disso é conduta médica.
   (`Triagem de sintomas.md:125`)

---

## Consequências

**Positivas**
- Uma API serve web hoje e app nativo amanhã, sem retrabalho.
- Iteração do algoritmo em segundos, que é o que a validação clínica exige.
- Demo compartilhável por link — insumo direto da defesa oral (40% da nota).
- Documentação do build vira a seção de metodologia do anteprojeto (25 pts do barema).

**Negativas / dívidas assumidas**
- Push nativo fica de fora. Depende de canal alternativo (ADR futuro).
- Offline-first fica parcial: service worker + fila local na PWA resolve o caso
  comum, mas é inferior ao nativo. Aceitável enquanto o check-in é feito em casa.
- Biometria de login não existe na web com a mesma qualidade. Paciente digita CPF.
  Mitigar com sessão longa e "manter conectado".

**Gates que revisam esta decisão**
- **Gate CEP:** antes de qualquer dado real de paciente entrar no sistema.
- **Gate LGPD:** define onde o banco pode ser hospedado, quem é o controlador
  (pesquisador ou UFS) e o que a tela de primeiro acesso consente. **Pode invalidar
  a escolha de hospedagem (Hostinger)** — a decisão vale para a fase de dado
  sintético e será reavaliada aqui. Não bloqueia o início do build.
- **Gate limiares:** o motor de classificação é plugável até este gate fechar.

---

## Alternativas descartadas

| Alternativa | Por que não |
|---|---|
| App nativo primeiro (SwiftUI) | Cronograma refém de revisão de loja; sem usuário real antes do CEP; feedback de banca/enfermagem exige instalação |
| Cross-platform (React Native/Flutter) | Mesma penalidade de distribuição do nativo, sem o ganho de qualidade nativa; painel continuaria sendo web à parte |
| Landing separada do produto | Auth cross-domain sem benefício; João definiu a landing como porta única |
| Next server actions sem API separada | Contraria o padrão em produção do João e forçaria reescrever a API quando o app nativo entrar |

---

## Pendências abertas depois deste ADR

1. Direção visual — **não existe nenhuma referência no vault**. Nasce no Ritual de Briefing.
2. Canal de notificação (push PWA vs WhatsApp vs SMS) → ADR próprio.
3. Nome de domínio e significado da sigla AUREA → não definidos.
4. Cadência do check-in (diário por quantos dias do ciclo) → decisão de produto.
5. Regra de "sem resposta" (silêncio não é verde) → decisão de segurança clínica.
6. Cuidador como perfil de login → muda tabela de usuários e termo de consentimento.

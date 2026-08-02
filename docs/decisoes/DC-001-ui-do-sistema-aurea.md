# Decisões de Craft — UI do sistema AUREA

| | |
|---|---|
| Data | 2026-07-30 |
| Ref-base do app | **Brightharbor** (princípio, não mecanismo — a fotografia está banida) |
| Ref-base do painel | **Quicken · Twenty · Airtable** (refs do João, Mobbin) + Linear como disciplina de densidade + Raycast como lei de cor |
| Ritual | 8 perguntas respondidas · P1–P6 + P7/P8 internas |
| Escopo | app do paciente · painel da enfermagem · admin |

> A direção da landing (ADR-002) **não entra**. O `globals.css` já registra na linha 77: *"Display didone: só na landing. Do /app do paciente pra dentro usa-se grotesca — serif de alto contraste em corpo pequeno é falha de acessibilidade para quem lê no pior dia do ciclo."* Este DC é a direção de dentro.

---

## 🎨 Cores

**Regra mãe, e é a decisão mais importante deste documento:**
**cor saturada é reservada a risco.** Verde, âmbar e vermelho não decoram nada — são a classificação. Todo o resto da interface vive em neutro quente.

É onde eu **não** sigo as refs do João. No Quicken, cada categoria tem um ícone colorido arbitrário (verde, roxo, ciano, rosa, azul). Aqui isso custaria a leitura do alerta: a enfermeira perde o vermelho no meio do arco-íris. Sigo a **forma** dos refs — pill, card, KPI, rail — e prendo a **cor**.

### Neutros (novos tokens, derivados dos que já existem)

```css
--painel-canvas:     #f7f5ee;  /* creme dessaturado — menos amarelo que o da landing */
--painel-superficie: #ffffff;  /* card */
--painel-borda:      #e6e2d5;  /* hairline — a profundidade vem daqui, não de sombra */
--painel-rail:       #f0e9dc;  /* sidebar warm-tinted — INVIOLÁVEL marcado pelo João */
```

O app do paciente usa `--color-creme` (#fbf9ef) que já existe, com card branco.

### A escala de risco, como pill (padrão Airtable: fundo pálido + texto escuro da mesma família)

| Estado | fundo | texto | marcador |
|---|---|---|---|
| 🟢 Verde | `#e7efe0` | `#2f4a33` | `--color-sage` #7a8b53 |
| 🟡 Âmbar | `#fbf0dc` | `#7a5518` | `--color-ambar` #e8a33d |
| 🔴 Vermelho | `#f8e5e1` | `#7d2418` | `--color-terracota` #c2452d |
| ⚪ Sem resposta | `#eceae4` | `#4a5a4e` | hachura diagonal, **não cor chapada** |

**Por que "sem resposta" tem hachura e não cor:** silêncio não é verde e não pode parecer resolvido. As duas causas mais prováveis são opostas — a pessoa está bem e esqueceu, ou está mal demais para responder. Um preenchimento chapado leria como "estado conhecido". A hachura lê como *pendente*, que é a verdade.

---

## ✏️ Tipografia

Nenhuma fonte nova. A triad já está montada em `globals.css`.

| Papel | Fonte | Onde |
|---|---|---|
| Display didone | `--font-display` | **proibido de `/app` pra dentro** |
| UI | Geist Sans | app e painel |
| Números e dado clínico | Geist Mono + `font-variant-numeric: tabular-nums` | temperatura, episódios, dia do ciclo, contadores |
| Rótulo | `.rotulo` (mono, 11px, tracking .18em) | reaproveitado como está |

**Escala do app do paciente** — mínimos, não sugestões:
- pergunta: 28px / 1.25
- corpo e opção: 20px
- ajuda: 17px
- alvo de toque: **56px de altura mínima**, 12px de gap entre alvos

**Escala do painel:** UI 14px, KPI 40px peso 600, rótulo do KPI 12px.

---

## 🎬 Motion — Patamar 2 como arquitetura, orçamento contido

O João marcou Patamar 2 (Deep Combine). Aplico como **capacidade montada**, não como intensidade uniforme. A intensidade segue a P3 (discreto refinado), e o orçamento é gasto onde não machuca.

| Superfície | O que anima | Como |
|---|---|---|
| **Questionário** | só a troca de pergunta | fade + translateY 8px · 240ms · `--ease-saida`. Mais nada. Quem está enjoado responde num ambiente parado. |
| **Resultado** | aqui mora o Deep Combine | `gsap.to()` dirigindo `useMotionValue` para o campo cromático entrar por trás do resultado · pill com spring FM · `AnimatePresence` segurando o unmount enquanto a timeline GSAP fecha |
| **Painel** | entrada e mudança de estado | stagger 40ms na lista · transição de cor do marcador em 400ms quando a classificação muda ao vivo |
| **Admin** | nada | CRUD não anima |

`useGSAP({ scope: ref })` obrigatório em todo componente com timeline — cleanup é requisito, não zelo.

**🔴 Achado a corrigir:** `globals.css` linhas 115–124 zera motion em `prefers-reduced-motion` (`0.01ms`). O ADR-002 decidiu **desacelerar para 25%, não congelar** — congelar torna a identidade invisível para quem tem "Reduzir movimento" ligado. A regra atual contradiz o ADR. Precisa virar redução proporcional.

---

## 📦 Profundidade

Borda hairline de 1px + contraste com o canvas. **Sombra quase zero** — no máximo `0 1px 2px rgba(20,32,26,.04)` no card elevado. É o chassi comum das três refs do João: Quicken, Twenty e Airtable fazem idêntico, e nenhum usa sombra pesada.

Raio: 14px no card, 10px no controle, pill total no status.

---

## 🖼️ Componentes-signature

1. **Pill de risco** — o único elemento com cor saturada em toda a interface.
2. **Linha de paciente do painel** — marcador vertical à esquerda na cor do risco · nome · dia do ciclo · o **valor observado em mono** (`38,9 °C`) · tempo desde a última resposta. Densa, uma linha por paciente, ordenada por gravidade e depois por silêncio — nunca alfabética.
3. **Faixa de KPI** — quatro números no topo do painel, padrão Airtable: vermelhos · âmbares · sem resposta · monitorados hoje. Número grande, rótulo pequeno.
4. **Cartão de pergunta** — uma pergunta por tela, alvo grande, sem barra de progresso numérica (contador de passo em pontos, não "3 de 12", que desanima).
5. **Bloco de explicação** — a regra que disparou, escrita em linguagem de enfermagem. Na bancada de teste isso é JSON; no painel vira frase: *"Temperatura 38,9 °C — acima do corte de 38,5 °C"*, com a versão do conjunto de limiares ao lado.
6. **Selo de conjunto não validado** — enquanto `validadoClinicamente = false`, faixa âmbar persistente. Não é banner descartável.

---

## 🚫 Anti-padrões conscientemente quebrados

| Regra do vault | Quebrada | Justificativa |
|---|---|---|
| Ativação 1 — *motion expressivo por padrão* | sim, no questionário | Náusea e sensibilidade vestibular. O ADR-001 já registra o paciente respondendo no pior dia do ciclo. |
| Ativação 5 — *cor signature por seção* | sim, em toda a interface | Cor aqui é classificação de risco. Cromático narrativo destruiria a leitura clínica. |
| Refs do João — *chip colorido por categoria* (Quicken) | sim | Mesmo motivo. Sigo a forma, prendo a cor. |

**Anti-refs do João, travadas:** sem app de bem-estar (nada de gradiente pastel, streak, confete ao concluir check-in) · sem emoji ou escala de carinha (infantiliza adulto doente e não é dado classificável) · sem cara de IA ou dashboard de métrica decorativa (o AUREA não usa IA e não pode parecer que usa).

---

## ✅ Checklist anti-esqueleto — adaptado para UI de aplicação

- [ ] O resultado tem entrada com peso próprio (é o momento do produto)
- [ ] Os KPI do painel têm hierarquia real, não quatro caixas iguais
- [ ] Painel e app se reconhecem como família (rail warm ↔ canvas creme) sem serem a mesma tela
- [ ] Profundidade explícita por borda, não por contraste de fundo apenas
- [ ] A cor varia **por estado clínico**, nunca por seção
- [ ] Alvo de toque ≥56px e texto ≥20px no app, verificados no aparelho
- [ ] Foco visível em tudo que é navegável por teclado (a enfermagem opera no teclado)
- [ ] `prefers-reduced-motion` desacelera, não congela

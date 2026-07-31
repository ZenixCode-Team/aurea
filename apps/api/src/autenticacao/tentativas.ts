/**
 * Contagem de tentativas de login malsucedidas, por identificador.
 *
 * Existe porque o `keyGenerator` do `@fastify/rate-limit` roda no `onRequest`, antes de
 * o corpo da requisição ser analisado: `requisicao.body` é `undefined` lá dentro. A
 * chave que eu achava que era `entrar:<ip>:<cpf>` era, na prática, sempre
 * `entrar:<ip>:sem-alvo` — o alvo nunca entrava.
 *
 * O efeito era pior que não ter limite nenhum:
 *
 *   - quinze erros de digitação de um paciente devolviam 429 no login CORRETO da
 *     enfermagem de plantão, porque num serviço atrás de NAT todo mundo compartilha o
 *     IP. Negação de serviço contra quem está trabalhando;
 *   - e em produção, com `trustProxy`, o IP vem do `X-Forwarded-For`, que o cliente
 *     escolhe: força bruta com IP forjado passava inteira.
 *
 * Duas contagens separadas resolvem coisas diferentes. O limite por IP, que fica no
 * plugin, contém tráfego automatizado de uma origem. Este aqui protege a CONTA, que é
 * o que importa quando o atacante troca de origem à vontade.
 *
 * Conta só FALHA. Login que dá certo zera — quem sabe a senha não é ameaça, e gastar
 * orçamento de quem acerta é o que transformava o limite em incômodo para o paciente.
 */

const JANELA_EM_MS = 5 * 60 * 1000;
const FALHAS_ATE_BLOQUEAR = 8;

interface Registro {
  falhas: number;
  primeiraFalhaEm: number;
}

const porIdentificador = new Map<string, Registro>();

/**
 * Normaliza o identificador para que variação de escrita não crie balde novo.
 * `ADMIN@aurea.local`, `admin@aurea.local` e `123.456.789-09` precisam cair no mesmo
 * lugar que suas formas canônicas — senão o contorno é trivial.
 */
export function chaveDoAlvo(identificador: string): string {
  return identificador.trim().toLowerCase().replace(/[.\-\s]/g, '');
}

function registroVigente(chave: string, agora: number): Registro | undefined {
  const registro = porIdentificador.get(chave);
  if (!registro) return undefined;

  if (agora - registro.primeiraFalhaEm > JANELA_EM_MS) {
    porIdentificador.delete(chave);
    return undefined;
  }

  return registro;
}

export function estaBloqueado(identificador: string, agora = Date.now()): boolean {
  const registro = registroVigente(chaveDoAlvo(identificador), agora);
  return registro !== undefined && registro.falhas >= FALHAS_ATE_BLOQUEAR;
}

export function segundosAteLiberar(identificador: string, agora = Date.now()): number {
  const registro = registroVigente(chaveDoAlvo(identificador), agora);
  if (!registro) return 0;
  return Math.max(0, Math.ceil((registro.primeiraFalhaEm + JANELA_EM_MS - agora) / 1000));
}

export function registrarFalha(identificador: string, agora = Date.now()): void {
  const chave = chaveDoAlvo(identificador);
  const registro = registroVigente(chave, agora);

  if (!registro) {
    porIdentificador.set(chave, { falhas: 1, primeiraFalhaEm: agora });
    return;
  }

  registro.falhas += 1;
}

export function limparTentativas(identificador: string): void {
  porIdentificador.delete(chaveDoAlvo(identificador));
}

/** Só para teste. */
export function esquecerTudo(): void {
  porIdentificador.clear();
}

/**
 * Remove registros vencidos. Sem isto, o mapa cresce com cada identificador já tentado
 * — inclusive os inventados por quem varre CPF, que é justamente quem não deveria
 * conseguir consumir memória do servidor.
 */
export function agendarLimpezaDeTentativas(): () => void {
  const intervalo = setInterval(() => {
    const agora = Date.now();
    for (const [chave, registro] of porIdentificador) {
      if (agora - registro.primeiraFalhaEm > JANELA_EM_MS) porIdentificador.delete(chave);
    }
  }, JANELA_EM_MS);

  intervalo.unref?.();
  return () => clearInterval(intervalo);
}

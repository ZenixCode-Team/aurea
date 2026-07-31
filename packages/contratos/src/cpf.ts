/**
 * Validação de CPF — dígito verificador, não só formato.
 *
 * Mora em `contratos` porque a API valida no login e o formulário da web valida
 * antes de enviar. Duas implementações divergem, e divergir aqui significa a tela
 * aceitar um CPF que o servidor recusa, no pior dia do ciclo do paciente.
 */

/** Só os dígitos. `123.456.789-09` e `12345678909` são o mesmo CPF. */
export function normalizarCpf(entrada: string): string {
  return entrada.replace(/\D/g, '');
}

export function cpfEhValido(entrada: string): boolean {
  const cpf = normalizarCpf(entrada);

  if (cpf.length !== 11) return false;

  // Sequência de dígito repetido passa no cálculo do verificador mas é inválida
  // por convenção da Receita. 11111111111 é o caso clássico.
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const digitos = cpf.split('').map(Number);

  for (let posicao = 9; posicao < 11; posicao += 1) {
    const peso = posicao + 1;
    let soma = 0;

    for (let indice = 0; indice < posicao; indice += 1) {
      soma += (digitos[indice] as number) * (peso - indice);
    }

    const esperado = ((soma * 10) % 11) % 10;
    if (digitos[posicao] !== esperado) return false;
  }

  return true;
}

/** Formata para exibição. Entrada inválida volta como veio. */
export function formatarCpf(entrada: string): string {
  const cpf = normalizarCpf(entrada);
  if (cpf.length !== 11) return entrada;
  return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
}

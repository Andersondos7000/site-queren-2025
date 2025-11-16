/**
 * Utilitários para validação e formatação de CPF
 */

/**
 * Remove caracteres não numéricos do CPF
 */
export function limparCpf(cpf: string): string {
  return cpf.replace(/[^\d]/g, '');
}

/**
 * Formata CPF com pontos e hífen
 */
export function formatarCpf(cpf: string): string {
  const cpfLimpo = limparCpf(cpf);
  
  if (cpfLimpo.length !== 11) {
    return cpf; // Retorna o valor original se não tiver 11 dígitos
  }
  
  return cpfLimpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

/**
 * Valida se um CPF é válido usando o algoritmo de verificação
 */
export function validarCpf(cpf: string): boolean {
  const cpfLimpo = limparCpf(cpf);
  
  // Verificar se tem 11 dígitos
  if (cpfLimpo.length !== 11) {
    return false;
  }
  
  // Verificar se todos os dígitos são iguais
  if (/^(\d)\1{10}$/.test(cpfLimpo)) {
    return false;
  }
  
  // Calcular primeiro dígito verificador
  let soma = 0;
  for (let i = 0; i < 9; i++) {
    soma += parseInt(cpfLimpo.charAt(i)) * (10 - i);
  }
  let resto = 11 - (soma % 11);
  let digitoVerificador1 = resto < 2 ? 0 : resto;
  
  // Verificar primeiro dígito
  if (parseInt(cpfLimpo.charAt(9)) !== digitoVerificador1) {
    return false;
  }
  
  // Calcular segundo dígito verificador
  soma = 0;
  for (let i = 0; i < 10; i++) {
    soma += parseInt(cpfLimpo.charAt(i)) * (11 - i);
  }
  resto = 11 - (soma % 11);
  let digitoVerificador2 = resto < 2 ? 0 : resto;
  
  // Verificar segundo dígito
  return parseInt(cpfLimpo.charAt(10)) === digitoVerificador2;
}

/**
 * Gera um CPF válido aleatório (apenas para testes)
 */
export function gerarCpfValido(): string {
  // Gerar 9 primeiros dígitos aleatórios
  const primeirosDigitos = Array.from({ length: 9 }, () => 
    Math.floor(Math.random() * 10)
  );
  
  // Calcular primeiro dígito verificador
  let soma = 0;
  for (let i = 0; i < 9; i++) {
    soma += primeirosDigitos[i] * (10 - i);
  }
  let resto = 11 - (soma % 11);
  const digitoVerificador1 = resto < 2 ? 0 : resto;
  
  // Calcular segundo dígito verificador
  soma = 0;
  for (let i = 0; i < 9; i++) {
    soma += primeirosDigitos[i] * (11 - i);
  }
  soma += digitoVerificador1 * 2;
  resto = 11 - (soma % 11);
  const digitoVerificador2 = resto < 2 ? 0 : resto;
  
  // Montar CPF completo
  const cpfCompleto = [
    ...primeirosDigitos,
    digitoVerificador1,
    digitoVerificador2
  ].join('');
  
  return formatarCpf(cpfCompleto);
}

/**
 * Valida e retorna mensagem de erro se CPF for inválido
 */
export function validarCpfComMensagem(cpf: string): string | null {
  if (!cpf || cpf.trim() === '') {
    return 'CPF é obrigatório';
  }
  
  const cpfLimpo = limparCpf(cpf);
  
  if (cpfLimpo.length !== 11) {
    return 'CPF deve ter 11 dígitos';
  }
  
  if (!validarCpf(cpf)) {
    return 'CPF inválido';
  }
  
  return null; // CPF válido
}
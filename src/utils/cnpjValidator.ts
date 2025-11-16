/**
 * Utilitários para validação e formatação de CNPJ
 */

/** Remove caracteres não numéricos do CNPJ */
export function limparCnpj(cnpj: string): string {
  return cnpj.replace(/[^\d]/g, '');
}

/** Formata CNPJ com pontos, barra e hífen */
export function formatarCnpj(cnpj: string): string {
  const cnpjLimpo = limparCnpj(cnpj);
  if (cnpjLimpo.length !== 14) return cnpj;
  return cnpjLimpo.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

/**
 * Valida CNPJ utilizando o algoritmo de dígitos verificadores
 * Referência: cálculo padrão de CNPJ
 */
export function validarCnpj(cnpj: string): boolean {
  const cnpjLimpo = limparCnpj(cnpj);
  if (cnpjLimpo.length !== 14) return false;

  // Rejeita sequências de dígitos iguais
  if (/^(\d)\1{13}$/.test(cnpjLimpo)) return false;

  const calcDv = (base: string, pesos: number[]) => {
    const soma = base.split('').reduce((acc, d, i) => acc + parseInt(d, 10) * pesos[i], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  // Primeiro dígito verificador
  const dv1 = calcDv(cnpjLimpo.slice(0, 12), [5,4,3,2,9,8,7,6,5,4,3,2]);
  if (dv1 !== parseInt(cnpjLimpo.charAt(12), 10)) return false;

  // Segundo dígito verificador
  const dv2 = calcDv(cnpjLimpo.slice(0, 13), [6,5,4,3,2,9,8,7,6,5,4,3,2]);
  if (dv2 !== parseInt(cnpjLimpo.charAt(13), 10)) return false;

  return true;
}

/** Valida e retorna mensagem de erro se CNPJ for inválido */
export function validarCnpjComMensagem(cnpj: string): string | null {
  if (!cnpj || cnpj.trim() === '') return 'CNPJ é obrigatório';
  const cnpjLimpo = limparCnpj(cnpj);
  if (cnpjLimpo.length !== 14) return 'CNPJ deve ter 14 dígitos';
  if (!validarCnpj(cnpj)) return 'CNPJ inválido';
  return null;
}
// Helpers para tratamento seguro de erros de autenticação.
//
// Aqui ficam centralizadas as mensagens genéricas e a sanitização para não
// vazar informação sobre existência de contas, estado de confirmação ou
// detalhes internos do GoTrue para um atacante que faz enumeração de
// e-mails/credenciais.

/**
 * Converte um erro lançado pelo SDK Supabase numa mensagem segura para o
 * usuário. Mensagens cruas do GoTrue do tipo "invalid credentials" podem
 * diferenciar e-mail existente de inexistente; nós usamos sempre o mesmo
 * texto para ambos e mapeamos apenas casos conhecidos (rate-limit, rede).
 */
export function sanitizeAuthError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const lc = msg.toLowerCase();
  if (
    lc.includes("invalid login") ||
    lc.includes("invalid credentials") ||
    lc.includes("email not confirmed") ||
    lc.includes("invalid password") ||
    lc.includes("invalid email")
  ) {
    return "Credenciais inválidas ou e-mail não confirmado. Verifique os dados e tente novamente, ou use o link de convite/redefinição.";
  }
  if (lc.includes("rate limit") || lc.includes("too many")) {
    return "Muitas tentativas em pouco tempo. Aguarde alguns minutos antes de tentar novamente.";
  }
  if (lc.includes("network") || lc.includes("fetch") || lc.includes("econn")) {
    return "Não foi possível contatar o servidor. Verifique sua conexão e tente novamente.";
  }
  return "Não foi possível prosseguir. Verifique os dados e tente novamente.";
}

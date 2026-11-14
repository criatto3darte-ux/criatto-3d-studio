// Política de senha forte do onboarding.
//
// Requisitos:
//   1. Mínimo de 12 caracteres.
//   2. Pelo menos 3 das 4 classes de caracteres:
//        - letra minúscula (a-z)
//        - letra maiúscula (A-Z)
//        - dígito (0-9)
//        - símbolo/não-alfanumérico
//
// A política é propositalmente verificável no cliente para feedback imediato,
// mas a validação final é feita pelo servidor Supabase.
export interface PasswordRequirements {
  minLength: number;
  requiredClasses: number;
}

export const PASSWORD_POLICY: PasswordRequirements = {
  minLength: 12,
  requiredClasses: 3,
};

export interface PasswordCheck {
  ok: boolean;
  lengthOk: boolean;
  hasLower: boolean;
  hasUpper: boolean;
  hasDigit: boolean;
  hasSymbol: boolean;
  classCount: number;
  classesOk: boolean;
}

const CLASSES = {
  lower: /[a-z]/,
  upper: /[A-Z]/,
  digit: /[0-9]/,
  symbol: /[^A-Za-z0-9]/,
};

export function checkPassword(pw: string): PasswordCheck {
  const hasLower = CLASSES.lower.test(pw);
  const hasUpper = CLASSES.upper.test(pw);
  const hasDigit = CLASSES.digit.test(pw);
  const hasSymbol = CLASSES.symbol.test(pw);
  const classCount =
    (hasLower ? 1 : 0) + (hasUpper ? 1 : 0) + (hasDigit ? 1 : 0) + (hasSymbol ? 1 : 0);
  const lengthOk = pw.length >= PASSWORD_POLICY.minLength;
  const classesOk = classCount >= PASSWORD_POLICY.requiredClasses;
  return {
    ok: lengthOk && classesOk,
    lengthOk,
    hasLower,
    hasUpper,
    hasDigit,
    hasSymbol,
    classCount,
    classesOk,
  };
}

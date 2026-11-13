import { useState } from "react";
import { Button } from "@/shared/ui/Button";
import { DemoNotice } from "@/shared/ui/DemoNotice";
import { acceptRecoveredDemoData, useDemoStorageStatus } from "./repository";

export function StorageNotice({ admin = false }: { admin?: boolean }) {
  const status = useDemoStorageStatus();
  const [confirm, setConfirm] = useState(false);
  if (!status.readError && !status.writeError && !status.issues.length && !status.rejected) return null;
  return <div role="alert">
    <DemoNotice>{status.writeError
      ? "Não foi possível salvar neste navegador. As alterações estão somente na memória e podem se perder ao recarregar."
      : status.readError ? "Não foi possível ler os dados salvos. Os dados disponíveis são temporários."
      : status.recoveryRequired ? "Há dados locais inconsistentes. Apenas os dados seguros estão disponíveis; o conteúdo original foi preservado e a gravação está bloqueada."
      : status.rejected ? "Alteração inválida descartada. Revise os campos antes de salvar."
      : "Dados seguros recuperados na memória; o conteúdo original ainda não foi substituído."}</DemoNotice>
    {admin && status.issues.length > 0 && <details><summary>Detalhes da recuperação ({status.issues.length})</summary><ul>{status.issues.map((issue, i) => <li key={i}>{issue}</li>)}</ul></details>}
    {admin && status.recoveryRequired && <>
      {!confirm ? <Button variant="outline" onClick={() => setConfirm(true)}>Revisar substituição dos dados locais</Button> : <>
        <p>Ao confirmar, o próximo salvamento poderá substituir o conteúdo original pelos dados seguros disponíveis. Registros inválidos não serão restaurados.</p>
        <Button onClick={() => { acceptRecoveredDemoData(); setConfirm(false); }}>Permitir salvar dados recuperados</Button>
        <Button variant="outline" onClick={() => setConfirm(false)}>Cancelar</Button>
      </>}
    </>}
  </div>;
}
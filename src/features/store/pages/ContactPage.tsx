import type { ReactNode } from "react";
import { AtSign, Mail, MessageCircle, Music2 } from "lucide-react";
import { storeConfig } from "@/shared/config/store.config";
import { PageHeader } from "../components/Section";
import styles from "./InfoPages.module.css";

interface Channel { name: string; icon: ReactNode; value: string; href: string }

function channels(): Channel[] {
  const c = storeConfig;
  return [
    { name: "WhatsApp", icon: <MessageCircle size={28} />, value: c.whatsappNumber, href: c.whatsappNumber ? `https://wa.me/${c.whatsappNumber}` : "" },
    { name: "E-mail", icon: <Mail size={28} />, value: c.email, href: c.email ? `mailto:${c.email}` : "" },
    { name: "Instagram", icon: <AtSign size={28} />, value: c.social.instagram, href: c.social.instagram },
    { name: "TikTok", icon: <Music2 size={28} />, value: c.social.tiktok, href: c.social.tiktok },
  ];
}

export function ContactPage() {
  const list = channels();
  const anyConfigured = list.some((c) => c.value);
  return (
    <div className="container">
      <PageHeader eyebrow="Atendimento" title="Contato" text="Fale com a Criatto 3D pelos canais abaixo." />
      <ul className={styles.channels}>
        {list.map((c) => (
          <li key={c.name}>
            {c.href ? (
              <a className={styles.channel} href={c.href} target="_blank" rel="noopener noreferrer">
                {c.icon}<div><div className={styles.channelName}>{c.name}</div><div className={styles.muted}>{c.value}</div></div>
              </a>
            ) : (
              <div className={styles.channel} aria-disabled="true">
                {c.icon}<div><div className={styles.channelName}>{c.name}</div><div className={styles.muted}>Ainda não configurado</div></div>
              </div>
            )}
          </li>
        ))}
      </ul>
      {!anyConfigured && <p className={styles.muted} style={{ marginTop: 16 }}>Os canais oficiais serão exibidos assim que forem informados pela Criatto 3D.</p>}
    </div>
  );
}

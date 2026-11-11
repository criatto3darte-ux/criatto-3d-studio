import {
  BarChart3, Boxes, Home, Image, Layers, Package, Settings, ShoppingCart, Tag, Users, WandSparkles, type LucideIcon,
} from "lucide-react";

export interface AdminNavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  subtitle: string;
}

export const adminNav: AdminNavItem[] = [
  { to: "/admin", label: "Painel", icon: Home, subtitle: "Gerencie sua loja, pedidos, produtos e muito mais." },
  { to: "/admin/pedidos", label: "Pedidos", icon: ShoppingCart, subtitle: "Acompanhe pedidos iniciados pelo WhatsApp." },
  { to: "/admin/produtos", label: "Produtos", icon: Package, subtitle: "Cadastre e edite o catálogo da loja." },
  { to: "/admin/categorias", label: "Categorias", icon: Layers, subtitle: "Organize as categorias exibidas na loja." },
  { to: "/admin/clientes", label: "Clientes", icon: Users, subtitle: "Clientes registrados internamente pela equipe." },
  { to: "/admin/cupons", label: "Cupons e Promoções", icon: Tag, subtitle: "Crie cupons e campanhas promocionais." },
  { to: "/admin/estoque", label: "Estoque", icon: Boxes, subtitle: "Controle quantidades de pronta entrega." },
  { to: "/admin/personalizacoes", label: "Personalizações", icon: WandSparkles, subtitle: "Analise solicitações de peças personalizadas." },
  { to: "/admin/banners", label: "Banners", icon: Image, subtitle: "Gerencie os banners da página inicial." },
  { to: "/admin/relatorios", label: "Relatórios", icon: BarChart3, subtitle: "Indicadores demonstrativos de pedidos e vendas." },
  { to: "/admin/configuracoes", label: "Configurações", icon: Settings, subtitle: "Dados da loja, WhatsApp, entrega e mensagens." },
];

export function findAdminNav(pathname: string): AdminNavItem {
  const clean = pathname.replace(/\/$/, "") || "/admin";
  return (
    [...adminNav].sort((a, b) => b.to.length - a.to.length).find((i) => clean === i.to || clean.startsWith(i.to + "/")) ?? adminNav[0]!
  );
}

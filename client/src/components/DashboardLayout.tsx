import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/useMobile";
import { Activity, BarChart3, BookOpenText, Bot, Boxes, ClipboardList, LayoutDashboard, LogOut, PanelLeft, ReceiptText, Route, UsersRound } from "lucide-react";
import { useLocation } from "wouter";

const menuItems = [
  { icon: LayoutDashboard, label: "Visão geral", path: "/", roles: ["administrador", "gestor", "contabilista", "rh", "comercial", "logistica", "funcionario"] },
  { icon: ReceiptText, label: "Financeiro", path: "/financeiro", roles: ["administrador", "gestor", "contabilista"] },
  { icon: BookOpenText, label: "Contabilidade", path: "/contabilidade", roles: ["administrador", "gestor", "contabilista"] },
  { icon: BarChart3, label: "Comercial", path: "/comercial", roles: ["administrador", "gestor", "contabilista", "comercial", "logistica"] },
  { icon: Boxes, label: "Logística", path: "/logistica", roles: ["administrador", "gestor", "comercial", "logistica"] },
  { icon: UsersRound, label: "Recursos Humanos", path: "/recursos-humanos", roles: ["administrador", "gestor", "rh"] },
  { icon: Bot, label: "WILLY", path: "/willy", roles: ["administrador", "gestor", "contabilista", "rh", "comercial", "logistica"] },
  { icon: ClipboardList, label: "Auditoria", path: "/auditoria", roles: ["administrador", "gestor", "contabilista"] },
];

export default function DashboardLayout({ children, companyName, roleLabel, role }: { children: React.ReactNode; companyName: string; roleLabel: string; role?: string }) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const allowedItems = role ? menuItems.filter(item => item.roles.includes(role)) : menuItems;
  const activeItem = allowedItems.find(item => item.path === location) ?? allowedItems[0];

  return <SidebarProvider defaultOpen>
    <Sidebar collapsible="icon" className="border-r border-slate-800 bg-[#0B1626] text-slate-200">
      <SidebarHeader className="h-[84px] justify-center px-3">
        <div className="flex items-center gap-3 px-2 group-data-[collapsible=icon]:justify-center">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#35D0A0] to-[#4B78FF] font-bold text-[#071322] shadow-[0_12px_28px_rgba(53,208,160,.22)]">N</div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden"><p className="font-display text-lg font-semibold tracking-[.08em] text-white">NEXORA</p><p className="truncate text-[10px] font-medium uppercase tracking-[.17em] text-slate-500">Enterprise OS</p></div>
        </div>
      </SidebarHeader>
      <SidebarContent className="px-2 py-4">
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[.18em] text-slate-500 group-data-[collapsible=icon]:hidden">Operação</p>
        <SidebarMenu>
          {allowedItems.map(item => <SidebarMenuItem key={item.path}>
            <SidebarMenuButton isActive={item.path === location} onClick={() => setLocation(item.path)} tooltip={item.label} className="h-10 rounded-xl text-slate-400 hover:bg-white/7 hover:text-white data-[active=true]:bg-[#1A3A44] data-[active=true]:text-[#83F0CA]">
              <item.icon className="h-[18px] w-[18px]" /><span>{item.label}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>)}
        </SidebarMenu>
        <div className="mx-2 mt-6 rounded-xl border border-white/8 bg-white/5 p-3 group-data-[collapsible=icon]:hidden"><div className="mb-2 flex items-center gap-2 text-xs font-medium text-[#83F0CA]"><Activity className="h-3.5 w-3.5" />Sistema operacional</div><p className="text-xs leading-5 text-slate-400">Os módulos partilham dados num único fluxo empresarial.</p></div>
      </SidebarContent>
      <SidebarFooter className="p-3">
        <DropdownMenu><DropdownMenuTrigger asChild><button className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-white/7 group-data-[collapsible=icon]:justify-center"><Avatar className="h-8 w-8 border border-white/10"><AvatarFallback className="bg-slate-700 text-xs text-white">{user?.name?.slice(0, 1).toUpperCase() ?? "U"}</AvatarFallback></Avatar><div className="min-w-0 group-data-[collapsible=icon]:hidden"><p className="truncate text-xs font-medium text-white">{user?.name ?? "Utilizador"}</p><p className="truncate text-[11px] text-slate-500">{roleLabel}</p></div></button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={logout} className="text-destructive"><LogOut className="mr-2 h-4 w-4" />Terminar sessão</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
      </SidebarFooter>
    </Sidebar>
    <SidebarInset className="bg-[#F4F7FB]">
      <header className="sticky top-0 z-20 flex h-[84px] items-center justify-between border-b border-slate-200/80 bg-[#F4F7FB]/90 px-5 backdrop-blur xl:px-9">
        <div className="flex items-center gap-3"><SidebarTrigger className="rounded-xl bg-white shadow-sm lg:hidden" /><div><p className="text-sm font-medium text-slate-500">{companyName}</p><h1 className="font-display text-xl font-semibold tracking-tight text-[#102039]">{activeItem.label}</h1></div></div>
        <div className="flex items-center gap-3"><div className="hidden rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 sm:block"><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[#35D0A0]" />Sincronizado</div><button onClick={() => setLocation("/willy")} className="flex items-center gap-2 rounded-xl bg-[#102039] px-3 py-2 text-xs font-semibold text-white shadow-[0_8px_20px_rgba(16,32,57,.16)] transition-transform active:scale-95"><Bot className="h-4 w-4 text-[#83F0CA]" /><span className="hidden sm:inline">Perguntar ao WILLY</span></button></div>
      </header>
      {isMobile && <div className="border-b bg-white px-5 py-2 text-xs font-medium text-slate-500">{activeItem.label}</div>}
      <main className="min-h-[calc(100vh-84px)] px-5 py-6 xl:px-9 xl:py-8">{children}</main>
    </SidebarInset>
  </SidebarProvider>;
}

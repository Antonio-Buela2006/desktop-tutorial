import { useState } from "react";
import { T, useI18n } from "../lib/i18n";
import { Link, NavLink, Outlet } from "react-router-dom";
import { Menu, Moon, Sun, X } from "lucide-react";
import { useTheme } from "./AppLayout";
import { cx } from "../components/ui";

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" className={cx("flex items-center gap-2 font-semibold tracking-tight", className)} aria-label="Nexora — início">
      <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden><rect width="32" height="32" rx="8" fill="#4338ca" /><path d="M9 23V9l14 14V9" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
      <span className="text-lg"><T>Nexora</T></span>
    </Link>
  );
}

const links = [
  ["/funcionalidades", "Funcionalidades"],
  ["/modulos", "Módulos"],
  ["/precos", "Planos"],
  ["/seguranca", "Segurança"],
  ["/faq", "FAQ"],
  ["/contacto", "Contacto"],
];

export function PublicLayout() {
  const [open, setOpen] = useState(false);
  const { dark, toggle } = useTheme();
  const { lang, setLang, tr } = useI18n();
  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
          <Logo />
          <nav className="hidden gap-5 md:flex" aria-label="Site">
            {links.map(([to, l]) => (
              <NavLink key={to} to={to} className={({ isActive }) => cx("text-sm", isActive ? "font-semibold text-brand-700 dark:text-brand-100" : "text-slate-600 hover:text-slate-900 dark:text-slate-300")}>{tr(l)}</NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <select aria-label={tr("Idioma")} className="rounded-md border-0 bg-transparent px-1 py-1 text-xs" value={lang} onChange={(e) => setLang(e.target.value as any)}>
              <option value="pt">PT</option><option value="en">EN</option>
            </select>
            <button onClick={toggle} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Alternar tema">{dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button>
            <Link to="/login" className="hidden rounded-lg px-3 py-2 text-sm font-medium hover:bg-slate-100 sm:block dark:hover:bg-slate-800"><T>Entrar</T></Link>
            <Link to="/registo" className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"><T>Experimentar 14 dias</T></Link>
            <button className="p-2 md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">{open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
          </div>
        </div>
        {open && (
          <nav className="border-t border-slate-200 px-4 py-2 md:hidden dark:border-slate-800">
            {[...links, ["/login", "Entrar"]].map(([to, l]) => <Link key={to} to={to} onClick={() => setOpen(false)} className="block py-2 text-sm">{tr(l)}</Link>)}
          </nav>
        )}
      </header>
      <main className="flex-1"><Outlet /></main>
      <footer className="border-t border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 text-sm sm:grid-cols-4">
          <div><Logo /><p className="mt-2 muted"><T>Gestão empresarial modular, multiempresa e assistida por IA, para PME.</T></p></div>
          <div><p className="font-semibold"><T>Produto</T></p><ul className="mt-2 space-y-1 muted"><li><Link to="/funcionalidades"><T>Funcionalidades</T></Link></li><li><Link to="/modulos"><T>Módulos</T></Link></li><li><Link to="/precos"><T>Planos</T></Link></li></ul></div>
          <div><p className="font-semibold"><T>Empresa</T></p><ul className="mt-2 space-y-1 muted"><li><Link to="/sobre"><T>Sobre</T></Link></li><li><Link to="/contacto"><T>Contacto e suporte</T></Link></li><li><Link to="/faq"><T>Perguntas frequentes</T></Link></li></ul></div>
          <div><p className="font-semibold"><T>Legal</T></p><ul className="mt-2 space-y-1 muted"><li><Link to="/legal/termos"><T>Termos de serviço</T></Link></li><li><Link to="/legal/privacidade"><T>Privacidade</T></Link></li><li><Link to="/legal/cookies"><T>Cookies</T></Link></li><li><Link to="/admin"><T>Portal Nexora</T></Link></li></ul></div>
        </div>
        <p className="pb-6 text-center text-xs muted">© {new Date().getFullYear()} Nexora. Documentos legais em revisão profissional — versão provisória.</p>
      </footer>
    </div>
  );
}

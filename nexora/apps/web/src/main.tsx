import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./index.css";
import { I18nProvider } from "./lib/i18n";
import { PublicLayout } from "./layouts/PublicLayout";
import { AppLayout } from "./layouts/AppLayout";
import { Loading } from "./components/ui";
import { About, Contact, Faq, Features, Home, Legal, Modules, Pricing, SecurityPage } from "./pages/public/Site";
import { AcceptInvite, Forgot, Login, MfaVerify, ResetPassword, SandboxCheckout, Signup } from "./pages/public/Auth";

// Divisão de bundles: a aplicação autenticada e o portal admin carregam sob pedido.
const B = () => import("./pages/app/Business");
const C = () => import("./pages/app/Company");
const G = () => import("./pages/app/Governance");
const Dashboard = lazy(() => B().then((m) => ({ default: m.Dashboard })));
const Customers = lazy(() => B().then((m) => ({ default: m.Customers })));
const Products = lazy(() => B().then((m) => ({ default: m.Products })));
const Sales = lazy(() => B().then((m) => ({ default: m.Sales })));
const Finance = lazy(() => B().then((m) => ({ default: m.Finance })));
const Employees = lazy(() => C().then((m) => ({ default: m.Employees })));
const UsersPage = lazy(() => C().then((m) => ({ default: m.UsersPage })));
const Roles = lazy(() => C().then((m) => ({ default: m.Roles })));
const Settings = lazy(() => C().then((m) => ({ default: m.Settings })));
const Billing = lazy(() => import("./pages/app/Billing").then((m) => ({ default: m.Billing })));
const AIPage = lazy(() => import("./pages/app/AI").then((m) => ({ default: m.AIPage })));
const Audit = lazy(() => G().then((m) => ({ default: m.Audit })));
const Exports = lazy(() => G().then((m) => ({ default: m.Exports })));
const Trash = lazy(() => G().then((m) => ({ default: m.Trash })));
const Notifications = lazy(() => G().then((m) => ({ default: m.Notifications })));
const Security = lazy(() => G().then((m) => ({ default: m.Security })));
const A = () => import("./pages/admin/Admin");
const AdminLogin = lazy(() => A().then((m) => ({ default: m.AdminLogin })));
const AdminLayout = lazy(() => A().then((m) => ({ default: m.AdminLayout })));
const AdminOverview = lazy(() => A().then((m) => ({ default: m.AdminOverview })));
const AdminPlans = lazy(() => A().then((m) => ({ default: m.AdminPlans })));
const AdminModules = lazy(() => A().then((m) => ({ default: m.AdminModules })));
const AdminPayments = lazy(() => A().then((m) => ({ default: m.AdminPayments })));
const AdminSettings = lazy(() => A().then((m) => ({ default: m.AdminSettings })));
const AdminSupport = lazy(() => A().then((m) => ({ default: m.AdminSupport })));
const AdminAudit = lazy(() => A().then((m) => ({ default: m.AdminAudit })));
const Admin2fa = lazy(() => A().then((m) => ({ default: m.Admin2fa })));

const qc = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false } } });

function NotFound() {
  return <div className="p-10 text-center"><h1 className="text-2xl font-semibold">Página não encontrada</h1><a href="/" className="mt-4 inline-block underline">Voltar ao início</a></div>;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={qc}>
      <I18nProvider>
        <BrowserRouter>
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route element={<PublicLayout />}>
                <Route index element={<Home />} />
                <Route path="funcionalidades" element={<Features />} />
                <Route path="modulos" element={<Modules />} />
                <Route path="precos" element={<Pricing />} />
                <Route path="seguranca" element={<SecurityPage />} />
                <Route path="sobre" element={<About />} />
                <Route path="contacto" element={<Contact />} />
                <Route path="faq" element={<Faq />} />
                <Route path="legal/:doc" element={<Legal />} />
                <Route path="login" element={<Login />} />
                <Route path="login/2fa" element={<MfaVerify />} />
                <Route path="registo" element={<Signup />} />
                <Route path="recuperar" element={<Forgot />} />
                <Route path="reset-password" element={<ResetPassword />} />
                <Route path="invite" element={<AcceptInvite />} />
                <Route path="checkout/sandbox" element={<SandboxCheckout />} />
              </Route>
              <Route path="app" element={<AppLayout />}>
                <Route index element={<Dashboard />} />
                <Route path="customers" element={<Customers />} />
                <Route path="products" element={<Products />} />
                <Route path="sales" element={<Sales />} />
                <Route path="finance" element={<Finance />} />
                <Route path="employees" element={<Employees />} />
                <Route path="users" element={<UsersPage />} />
                <Route path="roles" element={<Roles />} />
                <Route path="billing" element={<Billing />} />
                <Route path="settings" element={<Settings />} />
                <Route path="ai" element={<AIPage />} />
                <Route path="audit" element={<Audit />} />
                <Route path="exports" element={<Exports />} />
                <Route path="trash" element={<Trash />} />
                <Route path="notifications" element={<Notifications />} />
                <Route path="security" element={<Security />} />
              </Route>
              <Route path="admin/login" element={<AdminLogin />} />
              <Route path="admin" element={<AdminLayout />}>
                <Route index element={<AdminOverview />} />
                <Route path="plans" element={<AdminPlans />} />
                <Route path="modules" element={<AdminModules />} />
                <Route path="payments" element={<AdminPayments />} />
                <Route path="settings" element={<AdminSettings />} />
                <Route path="support" element={<AdminSupport />} />
                <Route path="audit" element={<AdminAudit />} />
                <Route path="2fa" element={<Admin2fa />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </I18nProvider>
    </QueryClientProvider>
  </StrictMode>,
);

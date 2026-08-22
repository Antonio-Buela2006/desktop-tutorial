import { TRPCError } from "@trpc/server";

export const businessRoles = [
  "administrador",
  "gestor",
  "contabilista",
  "rh",
  "comercial",
  "logistica",
  "funcionario",
] as const;

export type BusinessRole = (typeof businessRoles)[number];

export type Permission =
  | "dashboard.view"
  | "finance.view"
  | "finance.manage"
  | "accounting.view"
  | "accounting.manage"
  | "crm.view"
  | "crm.manage"
  | "sales.manage"
  | "hr.view"
  | "hr.manage"
  | "logistics.view"
  | "logistics.manage"
  | "willy.view"
  | "willy.chat"
  | "audit.view"
  | "team.manage"
  | "settings.manage";

const allPermissions: Permission[] = [
  "dashboard.view", "finance.view", "finance.manage", "accounting.view", "accounting.manage",
  "crm.view", "crm.manage", "sales.manage", "hr.view", "hr.manage", "logistics.view",
  "logistics.manage", "willy.view", "willy.chat", "audit.view", "team.manage", "settings.manage",
];

const rolePermissions: Record<BusinessRole, Permission[]> = {
  administrador: allPermissions,
  gestor: ["dashboard.view", "finance.view", "accounting.view", "crm.view", "hr.view", "logistics.view", "willy.view", "willy.chat", "audit.view"],
  contabilista: ["dashboard.view", "finance.view", "finance.manage", "accounting.view", "accounting.manage", "crm.view", "willy.view", "audit.view"],
  rh: ["dashboard.view", "hr.view", "hr.manage", "willy.view"],
  comercial: ["dashboard.view", "crm.view", "crm.manage", "sales.manage", "logistics.view", "willy.view"],
  logistica: ["dashboard.view", "crm.view", "logistics.view", "logistics.manage", "willy.view"],
  funcionario: ["dashboard.view"],
};

export function can(role: BusinessRole, permission: Permission) {
  return rolePermissions[role].includes(permission);
}

export function assertPermission(role: BusinessRole, permission: Permission) {
  if (!can(role, permission)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Não tem permissão para executar esta ação.",
    });
  }
}

export const roleLabels: Record<BusinessRole, string> = {
  administrador: "Administrador",
  gestor: "Gestor/Diretor",
  contabilista: "Contabilista",
  rh: "Recursos Humanos",
  comercial: "Comercial",
  logistica: "Logística",
  funcionario: "Funcionário",
};

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Calendar,
  FileText,
  HeartPulse,
  Home,
  LogOut,
  type LucideIcon,
  MessageCircle,
  Target,
  Users,
  Wallet,
} from "lucide-react";
import clsx from "clsx";

type SidebarUser = {
  name: string | null | undefined;
  email: string | null | undefined;
};

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const clinicalNav: NavItem[] = [
  { href: "/inicio", label: "Início", icon: Home },
  { href: "/pacientes", label: "Pacientes", icon: Users },
  { href: "/objetivos-progresso", label: "Objetivos e Progresso", icon: Target },
  { href: "/temas-recorrentes", label: "Temas Recorrentes", icon: MessageCircle },
  { href: "/evolucao-registrada", label: "Evolução Registrada", icon: FileText },
];

const practiceNav: NavItem[] = [
  { href: "/financeiro", label: "Financeiro", icon: Wallet },
  { href: "/agenda", label: "Agenda", icon: Calendar },
  { href: "/saude-pratica", label: "Saúde da Prática", icon: HeartPulse },
];

export function Sidebar({ user }: { user: SidebarUser }) {
  const pathname = usePathname();
  const displayName = user.name ?? "Você";
  const displayEmail = user.email ?? "";

  return (
    <aside className="w-64 shrink-0 bg-sidebar border-r border-primary-100/70 px-5 py-7 flex flex-col">
      <div className="px-2 mb-9">
        <h1 className="font-display text-3xl text-primary leading-none">
          Auren Care
        </h1>
        <p className="text-[11px] text-ink-muted mt-1.5 tracking-wider uppercase">
          Cuidando de quem cuida
        </p>
      </div>

      <nav className="flex-1 space-y-7">
        <NavGroup label="Clínico" items={clinicalNav} pathname={pathname} />
        <NavGroup label="Prática" items={practiceNav} pathname={pathname} />
      </nav>

      <div className="mt-6 px-3 py-2.5 rounded-xl bg-white/70 border border-primary-100/70 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink truncate">{displayName}</p>
          {displayEmail && (
            <p className="text-xs text-ink-muted truncate">{displayEmail}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-ink-muted hover:text-primary p-1.5 rounded-md hover:bg-primary/10 transition shrink-0"
          aria-label="Sair"
          title="Sair"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}

function NavGroup({
  label,
  items,
  pathname,
}: {
  label: string;
  items: NavItem[];
  pathname: string;
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-ink-muted px-3 mb-2">
        {label}
      </p>
      <ul className="space-y-0.5">
        {items.map(({ href, label: itemLabel, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                className={clsx(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition",
                  active
                    ? "bg-primary text-white shadow-soft"
                    : "text-ink hover:bg-primary/10",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                <span>{itemLabel}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

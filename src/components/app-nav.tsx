"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/incomes", label: "Ingresos" },
  { href: "/categories", label: "Categorias" },
  { href: "/expenses", label: "Gastos" },
  { href: "/expense-control", label: "Control de gastos" },
  { href: "/history", label: "Historial" },
  { href: "/settings", label: "Configuracion" }
];

export function AppNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/unlock");
  }

  return (
    <aside className="app-nav">
      <div className="brand">
        <img alt="Cuenta Zen" className="brand-logo" src="/brand/cuenta-zen-mark.svg" />
        <div>
          <h1>Cuenta Zen</h1>
          <p>Tu billetera en equilibrio</p>
        </div>
      </div>

      <nav className="nav-links">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link key={item.href} className={`nav-link ${isActive ? "active" : ""}`} href={item.href}>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div style={{ marginTop: "20px", display: "grid", gap: "10px" }}>
        <ThemeToggle />
        <button className="btn btn-secondary" onClick={logout} type="button">
          Bloquear
        </button>
      </div>
    </aside>
  );
}

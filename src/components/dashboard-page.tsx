"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatCurrency } from "@/lib/currency";

type ContributorKey = "JOHAN" | "WENDY";

type ContributorExpenseDetail = {
  id: string;
  categoryName: string;
  spentAt: string;
  amount: number;
  currency: "CRC" | "USD";
  owner: "JOHAN" | "WENDY" | "AMBOS";
  shareCRC: number;
  comment: string | null;
};

type ContributorSummary = {
  incomeMonthlyCRC: number;
  incomeBiweeklyCRC: number;
  expenseMonthlyCRC: number;
  expenseBiweeklyCRC: number;
  balanceMonthlyCRC: number;
  balanceBiweeklyCRC: number;
  carryoverAdjustmentCRC: number;
  expenseDetails: ContributorExpenseDetail[];
};

type ContributorsPayload = {
  activeFortnight: 1 | 2;
  JOHAN: ContributorSummary;
  WENDY: ContributorSummary;
};

type DashboardPayload = {
  settings: { exchangeRate: number };
  month: {
    id: string;
    monthStart: string;
    monthKey: string;
    status: "OPEN" | "CLOSED";
  };
  totals: {
    totalIncomeCRC: number;
    totalExpenseCRC: number;
    balanceCRC: number;
    projectedExpenseCRC: number;
    projectedBalanceCRC: number;
    globalConsumptionPercent: number;
    globalIndicator: "green" | "yellow" | "red";
  };
  categories: Array<{
    id: string;
    name: string;
    type: "FIJO" | "VARIABLE" | "IMPREVISTA";
    owner: "JOHAN" | "WENDY" | "AMBOS";
    currency: "CRC" | "USD";
    budget: number;
    spent: number;
    available: number;
    consumedPercent: number;
    alertsEnabled: boolean;
    alertColor: "green" | "yellow" | "red";
    biweeklyControl: boolean;
    biweekly: {
      budget: number;
      spent: number;
      available: number;
      projectedMonthly: number;
      fortnight: 1 | 2;
    } | null;
  }>;
  contributors: ContributorsPayload;
};

function indicatorLabel(indicator: "green" | "yellow" | "red") {
  if (indicator === "green") {
    return "Saludable";
  }
  if (indicator === "yellow") {
    return "Atencion";
  }
  return "Critico";
}

function ownerLabel(owner: "JOHAN" | "WENDY" | "AMBOS") {
  if (owner === "JOHAN") {
    return "Johan";
  }
  if (owner === "WENDY") {
    return "Wendy";
  }
  return "Ambos";
}

export function DashboardPage() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionType, setActionType] = useState<"CLOSE" | "PRECLOSE" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"GENERAL" | ContributorKey>("GENERAL");
  const [detailsOpen, setDetailsOpen] = useState<Record<ContributorKey, boolean>>({
    JOHAN: false,
    WENDY: false
  });

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);

    const response = await fetch("/api/dashboard", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error ?? "No se pudo cargar el dashboard");
      setLoading(false);
      return;
    }

    setData(payload);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const monthLabel = useMemo(() => {
    if (!data) {
      return "";
    }

    const date = new Date(data.month.monthStart);
    return date.toLocaleDateString("es-CR", { month: "long", year: "numeric", timeZone: "UTC" });
  }, [data]);

  const dashboardTabs: Array<{ key: "GENERAL" | ContributorKey; label: string }> = [
    { key: "GENERAL", label: "General" },
    { key: "JOHAN", label: "Johan" },
    { key: "WENDY", label: "Wendy" }
  ];

  async function handleCloseMonth() {
    if (!window.confirm("Se cerrara el mes actual y se abrira automaticamente el siguiente. Continuar?")) {
      return;
    }

    setActionType("CLOSE");
    setActionLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/months/close", { method: "POST" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error ?? "No se pudo cerrar el mes");
        return;
      }

      await loadDashboard();
      setSuccess("Mes cerrado y siguiente mes abierto.");
    } catch {
      setError("No se pudo cerrar el mes. Intenta de nuevo.");
    } finally {
      setActionLoading(false);
      setActionType(null);
    }
  }

  async function handlePreclose() {
    setActionType("PRECLOSE");
    setActionLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/months/preclose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error ?? "No se pudo generar el precierre");
        return;
      }

      const label =
        payload?.monthKey && payload?.fortnight
          ? `Precierre quincenal generado (${payload.monthKey} Q${payload.fortnight}).`
          : "Precierre quincenal generado.";
      setSuccess(label);
      await loadDashboard();
    } catch {
      setError("No se pudo generar el precierre. Intenta de nuevo.");
    } finally {
      setActionLoading(false);
      setActionType(null);
    }
  }

  function renderContributorSection(owner: ContributorKey) {
    if (!data) {
      return null;
    }

    const summary = data.contributors[owner];
    const stats = [
      { label: "Ingreso mensual", value: summary.incomeMonthlyCRC },
      { label: "Ingreso quincenal", value: summary.incomeBiweeklyCRC },
      { label: "Gastos mensuales", value: summary.expenseMonthlyCRC },
      { label: "Gasto quincenal", value: summary.expenseBiweeklyCRC },
      { label: "Saldo disponible mensual", value: summary.balanceMonthlyCRC },
      { label: "Saldo disponible quincenal", value: summary.balanceBiweeklyCRC }
    ];
    const carryoverNote =
      summary.carryoverAdjustmentCRC === 0
        ? null
        : summary.carryoverAdjustmentCRC > 0
          ? `Se suma ${formatCurrency(summary.carryoverAdjustmentCRC, "CRC")} del precierre anterior.`
          : `Se resta ${formatCurrency(Math.abs(summary.carryoverAdjustmentCRC), "CRC")} del precierre anterior.`;

    return (
      <section className="page-section">
        <div className="section-header">
          <div>
            <h2 className="section-title">
              Dashboard {ownerLabel(owner)} ({monthLabel})
            </h2>
            <p className="section-subtitle">Quincena activa: Q{data.contributors.activeFortnight}</p>
          </div>
        </div>

        <div className="grid-cards grid-3">
          {stats.map((stat) => (
            <article className="stat-card" key={stat.label}>
              <p className="stat-label">{stat.label}</p>
              <p className="stat-value">{formatCurrency(stat.value, "CRC")}</p>
            </article>
          ))}
        </div>

        <div className="btn-row">
          <button
            className="btn btn-secondary"
            onClick={() =>
              setDetailsOpen((prev) => ({
                ...prev,
                [owner]: !prev[owner]
              }))
            }
            type="button"
          >
            {detailsOpen[owner] ? "Ocultar detalles" : "Ver detalles"}
          </button>
        </div>

        {detailsOpen[owner] ? (
          summary.expenseDetails.length === 0 ? (
            <>
              {carryoverNote ? (
                <p className="muted" style={{ marginTop: "10px" }}>
                  {carryoverNote}
                </p>
              ) : null}
              <p className="muted" style={{ marginTop: carryoverNote ? "6px" : "10px" }}>
                No hay gastos registrados para este mes.
              </p>
            </>
          ) : (
            <div className="details-list" style={{ marginTop: "12px" }}>
              {carryoverNote ? <p className="muted">{carryoverNote}</p> : null}
              {summary.expenseDetails.map((detail) => (
                <div className="detail-card" key={detail.id}>
                  <div className="detail-row">
                    <span className="detail-label">Fecha</span>
                    <span className="detail-value">
                      {new Date(detail.spentAt).toLocaleDateString("es-CR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric"
                      })}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Categoria</span>
                    <span className="detail-value">{detail.categoryName}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Monto asignado</span>
                    <span className="detail-value">{formatCurrency(detail.shareCRC, "CRC")}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Monto original</span>
                    <span className="detail-value">
                      {formatCurrency(detail.amount, detail.currency)}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Pagado por</span>
                    <span className="detail-value">{ownerLabel(detail.owner)}</span>
                  </div>
                  {detail.comment ? <p className="detail-note">{detail.comment}</p> : null}
                </div>
              ))}
            </div>
          )
        ) : null}
      </section>
    );
  }

  if (loading) {
    return (
      <section className="page-section">
        <p>Cargando dashboard...</p>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="page-section">
        <p>No se pudo cargar la informacion.</p>
      </section>
    );
  }

  return (
    <div style={{ display: "grid", gap: "14px" }}>
      <div className="tab-row">
        {dashboardTabs.map((tab) => (
          <button
            key={tab.key}
            className={`tab-btn ${activeTab === tab.key ? "active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "GENERAL" ? (
        <>
      <section className="page-section">
        <div className="section-header">
          <div>
            <h2 className="section-title">Dashboard ({monthLabel})</h2>
            <p className="section-subtitle">
              Mes {data.month.status === "OPEN" ? "abierto" : "cerrado"} | Tipo de cambio:{" "}
              {formatCurrency(data.settings.exchangeRate, "CRC")} por USD
            </p>
          </div>

          <span className={`semaphore ${data.totals.globalIndicator}`}>
            {indicatorLabel(data.totals.globalIndicator)}
          </span>
        </div>

        <div className="grid-cards">
          <article className="stat-card">
            <p className="stat-label">Ingresos del mes</p>
            <p className="stat-value">{formatCurrency(data.totals.totalIncomeCRC, "CRC")}</p>
          </article>
          <article className="stat-card">
            <p className="stat-label">Gastos acumulados</p>
            <p className="stat-value">{formatCurrency(data.totals.totalExpenseCRC, "CRC")}</p>
          </article>
          <article className="stat-card">
            <p className="stat-label">Saldo disponible</p>
            <p className="stat-value">{formatCurrency(data.totals.balanceCRC, "CRC")}</p>
          </article>
          <article className="stat-card">
            <p className="stat-label">Proyeccion fin de mes</p>
            <p className="stat-value">{formatCurrency(data.totals.projectedBalanceCRC, "CRC")}</p>
          </article>
        </div>

        <div className="btn-row">
          <button
            className="btn btn-primary"
            disabled={actionLoading || data.month.status !== "OPEN"}
            onClick={handleCloseMonth}
            type="button"
          >
            {actionLoading && actionType === "CLOSE" ? "Cerrando..." : "Cerrar mes"}
          </button>
          <button
            className="btn btn-secondary"
            disabled={actionLoading || data.month.status !== "OPEN"}
            onClick={handlePreclose}
            type="button"
          >
            {actionLoading && actionType === "PRECLOSE" ? "Generando..." : "Generar precierre quincenal"}
          </button>
        </div>

        {error ? <p className="error-box">{error}</p> : null}
        {success ? <p style={{ color: "var(--ok)", marginTop: "10px" }}>{success}</p> : null}
      </section>

      <section className="page-section">
        <div className="section-header">
          <div>
            <h2 className="section-title">Control por categoria</h2>
            <p className="section-subtitle">
              Alertas globales: amarillo (&gt;=98% ingresos consumidos), rojo (&gt;=100%).
            </p>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Categoria</th>
                <th>Presupuesto</th>
                <th>Gastado</th>
                <th>Disponible</th>
                <th>% Consumido</th>
                <th>Alerta</th>
                <th>Control quincenal</th>
              </tr>
            </thead>
            <tbody>
              {data.categories.length === 0 ? (
                <tr>
                  <td colSpan={7}>No hay categorias activas para este mes.</td>
                </tr>
              ) : (
                data.categories.map((category) => (
                  <tr key={category.id}>
                    <td>{category.name}</td>
                    <td>{formatCurrency(category.budget, category.currency)}</td>
                    <td>{formatCurrency(category.spent, category.currency)}</td>
                    <td>{formatCurrency(category.available, category.currency)}</td>
                    <td className={`alert-text-${category.alertColor}`}>
                      {category.consumedPercent.toFixed(1)}%
                    </td>
                    <td>
                      {category.alertsEnabled ? (
                        <span className={`inline-tag alert-text-${category.alertColor}`}>Activa</span>
                      ) : (
                        <span className="inline-tag muted">Desactivada</span>
                      )}
                    </td>
                    <td>
                      {!category.biweeklyControl || !category.biweekly ? (
                        <span className="muted">No</span>
                      ) : (
                        <div>
                          <div>
                            Q{category.biweekly.fortnight} presupuesto:{" "}
                            {formatCurrency(category.biweekly.budget, category.currency)}
                          </div>
                          <div>
                            Q{category.biweekly.fortnight} gastado:{" "}
                            {formatCurrency(category.biweekly.spent, category.currency)}
                          </div>
                          <div>
                            Q{category.biweekly.fortnight} disponible:{" "}
                            {formatCurrency(category.biweekly.available, category.currency)}
                          </div>
                          <div className="muted">
                            Proy mensual: {formatCurrency(category.biweekly.projectedMonthly, category.currency)}
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
        </>
      ) : (
        renderContributorSection(activeTab)
      )}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { formatCurrency } from "@/lib/currency";

type HistoryItem = {
  id: string;
  monthStart: string;
  monthKey: string;
  status: "OPEN" | "CLOSED";
  totalIncomeCRC: number;
  totalExpenseCRC: number;
  balanceCRC: number;
};

type SummaryPayload = {
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
    currency: "CRC" | "USD";
    budget: number;
    spent: number;
    available: number;
    consumedPercent: number;
    alertColor: "green" | "yellow" | "red";
  }>;
};

export function HistoryPage() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [selectedMonthId, setSelectedMonthId] = useState<string>("");
  const [summary, setSummary] = useState<SummaryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadHistory() {
    setLoading(true);
    setError(null);
    const response = await fetch("/api/months/history", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error ?? "No se pudo cargar el historial");
      setLoading(false);
      return;
    }

    setHistory(payload);
    if (payload.length > 0) {
      setSelectedMonthId((prev) => prev || payload[0].id);
    }
    setLoading(false);
  }

  useEffect(() => {
    void loadHistory();
  }, []);

  useEffect(() => {
    if (!selectedMonthId) {
      return;
    }

    const run = async () => {
      const response = await fetch(`/api/months/${selectedMonthId}/summary`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "No se pudo cargar el detalle del mes");
        return;
      }
      setSummary(payload);
    };

    void run();
  }, [selectedMonthId]);

  const chart = useMemo(() => {
    const ordered = [...history].reverse();
    const max = ordered.reduce((acc, item) => Math.max(acc, item.totalExpenseCRC, item.totalIncomeCRC), 1);

    return ordered.map((item) => ({
      ...item,
      expenseHeight: Math.max(8, (item.totalExpenseCRC / max) * 140),
      incomeHeight: Math.max(8, (item.totalIncomeCRC / max) * 140)
    }));
  }, [history]);

  return (
    <div style={{ display: "grid", gap: "14px" }}>
      <section className="page-section">
        <div className="section-header">
          <div>
            <h2 className="section-title">Historial mensual</h2>
            <p className="section-subtitle">Comparativo de ingresos y gastos por mes.</p>
          </div>
        </div>

        {loading ? (
          <p>Cargando historial...</p>
        ) : history.length === 0 ? (
          <p>No hay meses registrados todavia.</p>
        ) : (
          <>
            <div className="kpi-chart">
              {chart.map((item) => (
                <div key={item.id} style={{ display: "grid", gap: "4px", alignItems: "end" }}>
                  <div
                    className="kpi-bar"
                    style={{
                      height: `${item.incomeHeight}px`,
                      background: "color-mix(in srgb, var(--ok) 85%, white 15%)"
                    }}
                    title={`Ingresos ${formatCurrency(item.totalIncomeCRC, "CRC")}`}
                  />
                  <div
                    className="kpi-bar"
                    style={{
                      height: `${item.expenseHeight}px`,
                      background: "color-mix(in srgb, var(--warning) 85%, white 15%)"
                    }}
                    title={`Gastos ${formatCurrency(item.totalExpenseCRC, "CRC")}`}
                  />
                </div>
              ))}
            </div>
            <div className="month-legend">
              {chart.map((item) => (
                <span key={item.id}>
                  {new Date(item.monthStart).toLocaleDateString("es-CR", {
                    month: "short",
                    year: "2-digit",
                    timeZone: "UTC"
                  })}
                </span>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="page-section">
        <div className="section-header">
          <h2 className="section-title">Comparacion de meses</h2>
          <select onChange={(event) => setSelectedMonthId(event.target.value)} value={selectedMonthId}>
            {history.map((item) => (
              <option key={item.id} value={item.id}>
                {item.monthKey} ({item.status === "OPEN" ? "Abierto" : "Cerrado"})
              </option>
            ))}
          </select>
        </div>

        {summary ? (
          <>
            <div className="grid-cards">
              <article className="stat-card">
                <p className="stat-label">Ingresos</p>
                <p className="stat-value">{formatCurrency(summary.totals.totalIncomeCRC, "CRC")}</p>
              </article>
              <article className="stat-card">
                <p className="stat-label">Gastos</p>
                <p className="stat-value">{formatCurrency(summary.totals.totalExpenseCRC, "CRC")}</p>
              </article>
              <article className="stat-card">
                <p className="stat-label">Saldo</p>
                <p className="stat-value">{formatCurrency(summary.totals.balanceCRC, "CRC")}</p>
              </article>
              <article className="stat-card">
                <p className="stat-label">% Consumo</p>
                <p className="stat-value">{summary.totals.globalConsumptionPercent.toFixed(1)}%</p>
              </article>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Categoria</th>
                    <th>Presupuesto</th>
                    <th>Gastado</th>
                    <th>Disponible</th>
                    <th>%</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.categories.map((category) => (
                    <tr key={category.id}>
                      <td>{category.name}</td>
                      <td>{formatCurrency(category.budget, category.currency)}</td>
                      <td>{formatCurrency(category.spent, category.currency)}</td>
                      <td>{formatCurrency(category.available, category.currency)}</td>
                      <td className={`alert-text-${category.alertColor}`}>{category.consumedPercent.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="muted">Selecciona un mes para ver detalle.</p>
        )}
        {error ? <p className="error-box">{error}</p> : null}
      </section>
    </div>
  );
}

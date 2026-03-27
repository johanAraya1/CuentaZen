"use client";

import { useEffect, useMemo, useState } from "react";
import { formatCurrency } from "@/lib/currency";

type ControlCategory = {
  id: string;
  name: string;
  currency: "CRC" | "USD";
  monthlyBudget: number;
  biweeklyControl: boolean;
  spentQ1: number;
  spentQ2: number;
  difference: number;
};

type ExpenseControlPayload = {
  month: {
    id: string;
    status: "OPEN" | "CLOSED";
    monthStart: string;
  };
  categories: ControlCategory[];
};

function periodLabel(biweeklyControl: boolean) {
  return biweeklyControl ? "Quincenal" : "Mensual";
}

export function ExpenseControlPage() {
  const [data, setData] = useState<ExpenseControlPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const monthLabel = useMemo(() => {
    if (!data) {
      return "";
    }

    return new Date(data.month.monthStart).toLocaleDateString("es-CR", {
      month: "long",
      year: "numeric",
      timeZone: "UTC"
    });
  }, [data]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/expense-control", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "No se pudo cargar");
        setLoading(false);
        return;
      }

      setData(payload);
      setLoading(false);
    }

    void loadData();
  }, []);

  if (loading) {
    return (
      <section className="page-section">
        <p>Cargando control de gastos...</p>
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
    <section className="page-section">
      <div className="section-header">
        <div>
          <h2 className="section-title">Control de gastos ({monthLabel})</h2>
          <p className="section-subtitle">
            Comparativo mensual con detalle por quincena (Q1/Q2).
          </p>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Gasto</th>
              <th>Presupuesto</th>
              <th>Periodo</th>
              <th>Gastado Q1</th>
              <th>Gastado Q2</th>
              <th>Diferencia</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {data.categories.length === 0 ? (
              <tr>
                <td colSpan={7}>No hay categorias activas para este mes.</td>
              </tr>
            ) : (
              data.categories.map((category) => {
                const healthy = category.difference >= 0;
                return (
                  <tr key={category.id}>
                    <td>{category.name}</td>
                    <td>{formatCurrency(category.monthlyBudget, category.currency)}</td>
                    <td>{periodLabel(category.biweeklyControl)}</td>
                    <td>{formatCurrency(category.spentQ1, category.currency)}</td>
                    <td>{formatCurrency(category.spentQ2, category.currency)}</td>
                    <td className={healthy ? "alert-text-green" : "alert-text-red"}>
                      {formatCurrency(category.difference, category.currency)}
                    </td>
                    <td>
                      <button
                        className={`btn ${healthy ? "btn-primary" : "btn-danger"}`}
                        style={{ cursor: "default" }}
                        type="button"
                      >
                        {healthy ? "Saludable" : "No saludable"}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {error ? <p className="error-box">{error}</p> : null}
    </section>
  );
}

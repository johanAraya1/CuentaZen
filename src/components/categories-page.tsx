"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { formatCurrency } from "@/lib/currency";

type CategoryType = "FIJO" | "VARIABLE" | "IMPREVISTA";
type CategoryOwner = "JOHAN" | "WENDY" | "AMBOS";
type Scope = "TEMPLATE" | "ONE_OFF";

type CategoryRecord = {
  id: string;
  scope: Scope;
  monthId?: string;
  name: string;
  type: CategoryType;
  owner: CategoryOwner;
  monthlyBudget: number;
  currency: "CRC" | "USD";
  biweeklyControl: boolean;
  alertsEnabled: boolean;
  alertPercentage: number;
  isActive: boolean;
};

type CategoriesPayload = {
  month: {
    id: string;
    monthStart: string;
    status: "OPEN" | "CLOSED";
  };
  templates: CategoryRecord[];
  oneOffCategories: CategoryRecord[];
};

type FormState = {
  id?: string;
  scope: Scope;
  name: string;
  type: CategoryType;
  owner: CategoryOwner;
  monthlyBudget: string;
  currency: "CRC" | "USD";
  biweeklyControl: boolean;
  alertsEnabled: boolean;
  alertPercentage: string;
  isActive: boolean;
};

const EMPTY_FORM: FormState = {
  scope: "TEMPLATE",
  name: "",
  type: "VARIABLE",
  owner: "AMBOS",
  monthlyBudget: "",
  currency: "CRC",
  biweeklyControl: false,
  alertsEnabled: true,
  alertPercentage: "80",
  isActive: true
};

function ownerLabel(owner: CategoryOwner) {
  if (owner === "JOHAN") {
    return "Johan";
  }
  if (owner === "WENDY") {
    return "Wendy";
  }
  return "Ambos";
}

function typeLabel(type: CategoryType) {
  if (type === "FIJO") {
    return "Fijo";
  }
  if (type === "VARIABLE") {
    return "Variable";
  }
  return "Imprevista";
}

export function CategoriesPage() {
  const [payload, setPayload] = useState<CategoriesPayload | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const monthLabel = useMemo(() => {
    if (!payload) {
      return "";
    }
    return new Date(payload.month.monthStart).toLocaleDateString("es-CR", {
      month: "long",
      year: "numeric",
      timeZone: "UTC"
    });
  }, [payload]);

  async function loadData() {
    setLoading(true);
    setError(null);

    const response = await fetch("/api/categories", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "No se pudo cargar");
      setLoading(false);
      return;
    }

    setPayload(data);
    setLoading(false);
  }

  useEffect(() => {
    void loadData();
  }, []);

  function startEdit(item: CategoryRecord) {
    setForm({
      id: item.id,
      scope: item.scope,
      name: item.name,
      type: item.type,
      owner: item.owner,
      monthlyBudget: `${item.monthlyBudget}`,
      currency: item.currency,
      biweeklyControl: item.biweeklyControl,
      alertsEnabled: item.alertsEnabled,
      alertPercentage: `${item.alertPercentage}`,
      isActive: item.isActive
    });
  }

  function resetForm() {
    setForm(EMPTY_FORM);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    if (form.id && form.scope === "TEMPLATE" && form.type === "IMPREVISTA") {
      setError("Una categoria template no puede convertirse a imprevista. Crea una nueva como imprevista.");
      setSaving(false);
      return;
    }

    const finalScope: Scope = form.type === "IMPREVISTA" ? "ONE_OFF" : form.scope;

    const body = {
      name: form.name,
      type: form.type,
      owner: form.owner,
      monthlyBudget: Number(form.monthlyBudget),
      currency: form.currency,
      biweeklyControl: form.biweeklyControl,
      alertsEnabled: form.alertsEnabled,
      alertPercentage: Number(form.alertPercentage),
      isActive: form.isActive,
      scope: finalScope
    };

    const url = form.id
      ? form.scope === "ONE_OFF"
        ? `/api/month-categories/${form.id}`
        : `/api/categories/${form.id}`
      : "/api/categories";
    const method = form.id ? "PUT" : "POST";

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error ?? "No se pudo guardar");
      setSaving(false);
      return;
    }

    await loadData();
    resetForm();
    setSaving(false);
  }

  async function removeItem(item: CategoryRecord) {
    const label = item.scope === "ONE_OFF" ? "imprevista del mes" : "template";
    if (!window.confirm(`Eliminar esta categoria ${label}?`)) {
      return;
    }

    const url =
      item.scope === "ONE_OFF" ? `/api/month-categories/${item.id}` : `/api/categories/${item.id}`;
    const response = await fetch(url, { method: "DELETE" });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error ?? "No se pudo eliminar");
      return;
    }

    await loadData();
  }

  if (loading) {
    return (
      <section className="page-section">
        <p>Cargando categorias...</p>
      </section>
    );
  }

  if (!payload) {
    return (
      <section className="page-section">
        <p>No se pudo cargar la informacion.</p>
      </section>
    );
  }

  return (
    <div style={{ display: "grid", gap: "14px" }}>
      <section className="page-section">
        <div className="section-header">
          <div>
            <h2 className="section-title">Categorias</h2>
            <p className="section-subtitle">
              Templates: mes abierto + futuros. Imprevistas: solo para {monthLabel}.
            </p>
          </div>
        </div>

        <form onSubmit={onSubmit}>
          <div className="form-grid">
            <label>
              Nombre
              <input
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                required
                value={form.name}
              />
            </label>
            <label>
              Tipo
              <select
                disabled={form.scope === "ONE_OFF"}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, type: event.target.value as CategoryType }))
                }
                value={form.type}
              >
                <option value="FIJO">Fijo</option>
                <option value="VARIABLE">Variable</option>
                <option value="IMPREVISTA">Imprevista (solo este mes)</option>
              </select>
            </label>
            <label>
              Pagado por
              <select
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, owner: event.target.value as CategoryOwner }))
                }
                value={form.owner}
              >
                <option value="JOHAN">Johan</option>
                <option value="WENDY">Wendy</option>
                <option value="AMBOS">Ambos</option>
              </select>
            </label>
            <label>
              Presupuesto mensual
              <input
                min={0}
                onChange={(event) => setForm((prev) => ({ ...prev, monthlyBudget: event.target.value }))}
                required
                step="0.01"
                type="number"
                value={form.monthlyBudget}
              />
            </label>
          </div>

          <div className="form-grid" style={{ marginTop: "10px" }}>
            <label>
              Moneda
              <select
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, currency: event.target.value as "CRC" | "USD" }))
                }
                value={form.currency}
              >
                <option value="CRC">CRC</option>
                <option value="USD">USD</option>
              </select>
            </label>
            <div style={{ display: "flex", alignItems: "end", gap: "16px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <input
                  checked={form.biweeklyControl}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      biweeklyControl: event.target.checked
                    }))
                  }
                  type="checkbox"
                />
                Control quincenal
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <input
                  checked={form.isActive}
                  onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                  type="checkbox"
                />
                Activa
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <input
                  checked={form.alertsEnabled}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      alertsEnabled: event.target.checked
                    }))
                  }
                  type="checkbox"
                />
                Activar alerta
              </label>
            </div>
            <label>
              Alerta % {form.alertsEnabled ? "" : "(desactivada)"}
              <input
                disabled={!form.alertsEnabled}
                max={200}
                min={1}
                onChange={(event) => setForm((prev) => ({ ...prev, alertPercentage: event.target.value }))}
                required={form.alertsEnabled}
                type="number"
                value={form.alertPercentage}
              />
            </label>
            <label>
              Alcance
              <select
                disabled={form.type === "IMPREVISTA" || form.scope === "ONE_OFF"}
                onChange={(event) => setForm((prev) => ({ ...prev, scope: event.target.value as Scope }))}
                value={form.type === "IMPREVISTA" ? "ONE_OFF" : form.scope}
              >
                <option value="TEMPLATE">Template (recurrente)</option>
                <option value="ONE_OFF">Solo este mes</option>
              </select>
            </label>
          </div>

          <div className="btn-row" style={{ marginTop: "10px" }}>
            <button className="btn btn-primary" disabled={saving} type="submit">
              {form.id ? "Actualizar" : "Crear"}
            </button>
            {form.id ? (
              <button className="btn btn-secondary" onClick={resetForm} type="button">
                Cancelar edicion
              </button>
            ) : null}
          </div>
        </form>
        {error ? <p className="error-box">{error}</p> : null}
      </section>

      <section className="page-section">
        <h2 className="section-title">Gastos recurrentes</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Tipo</th>
                <th>Pagado por</th>
                <th>Presupuesto</th>
                <th>Control quincenal</th>
                <th>Alerta</th>
                <th>Activa</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {payload.templates.length === 0 ? (
                <tr>
                  <td colSpan={8}>Sin templates</td>
                </tr>
              ) : (
                payload.templates.map((item) => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>{typeLabel(item.type)}</td>
                    <td>{ownerLabel(item.owner)}</td>
                    <td>{formatCurrency(item.monthlyBudget, item.currency)}</td>
                    <td>{item.biweeklyControl ? "Si" : "No"}</td>
                    <td>{item.alertsEnabled ? `${item.alertPercentage}%` : "No"}</td>
                    <td>{item.isActive ? "Si" : "No"}</td>
                    <td className="cell-actions">
                      <button className="btn btn-secondary" onClick={() => startEdit(item)} type="button">
                        Editar
                      </button>
                      <button className="btn btn-danger" onClick={() => removeItem(item)} type="button">
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="page-section">
        <h2 className="section-title">Imprevistas del mes ({monthLabel})</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Pagado por</th>
                <th>Presupuesto</th>
                <th>Alerta</th>
                <th>Activa</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {payload.oneOffCategories.length === 0 ? (
                <tr>
                  <td colSpan={6}>Sin categorias imprevistas para este mes</td>
                </tr>
              ) : (
                payload.oneOffCategories.map((item) => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>{ownerLabel(item.owner)}</td>
                    <td>{formatCurrency(item.monthlyBudget, item.currency)}</td>
                    <td>{item.alertsEnabled ? `${item.alertPercentage}%` : "No"}</td>
                    <td>{item.isActive ? "Si" : "No"}</td>
                    <td className="cell-actions">
                      <button className="btn btn-secondary" onClick={() => startEdit(item)} type="button">
                        Editar
                      </button>
                      <button className="btn btn-danger" onClick={() => removeItem(item)} type="button">
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

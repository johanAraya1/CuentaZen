"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { formatCurrency } from "@/lib/currency";

type IncomeOwner = "JOHAN" | "WENDY";

type IncomeTemplate = {
  id: string;
  name: string;
  amount: number;
  currency: "CRC" | "USD";
  frequency: "MENSUAL" | "QUINCENAL";
  owner: IncomeOwner;
  isActive: boolean;
};

type FormState = {
  id?: string;
  name: string;
  amount: string;
  currency: "CRC" | "USD";
  frequency: "MENSUAL" | "QUINCENAL";
  owner: IncomeOwner;
  isActive: boolean;
};

const EMPTY_FORM: FormState = {
  name: "",
  amount: "",
  currency: "CRC",
  frequency: "MENSUAL",
  owner: "JOHAN",
  isActive: true
};

function ownerLabel(owner: IncomeOwner) {
  return owner === "JOHAN" ? "Johan" : "Wendy";
}

export function IncomesPage() {
  const [templates, setTemplates] = useState<IncomeTemplate[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = useMemo(
    () =>
      templates
        .filter((item) => item.isActive)
        .reduce((sum, item) => sum + (item.frequency === "QUINCENAL" ? item.amount * 2 : item.amount), 0),
    [templates]
  );

  async function loadData() {
    setLoading(true);
    setError(null);
    const response = await fetch("/api/income-templates", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error ?? "No se pudo cargar");
      setLoading(false);
      return;
    }

    setTemplates(payload);
    setLoading(false);
  }

  useEffect(() => {
    void loadData();
  }, []);

  function startEdit(item: IncomeTemplate) {
    setForm({
      id: item.id,
      name: item.name,
      amount: `${item.amount}`,
      currency: item.currency,
      frequency: item.frequency,
      owner: item.owner,
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

    const payload = {
      name: form.name,
      amount: Number(form.amount),
      currency: form.currency,
      frequency: form.frequency,
      owner: form.owner,
      isActive: form.isActive
    };

    const method = form.id ? "PUT" : "POST";
    const url = form.id ? `/api/income-templates/${form.id}` : "/api/income-templates";
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
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

  async function removeTemplate(id: string) {
    if (!window.confirm("Eliminar este template de ingreso?")) {
      return;
    }

    const response = await fetch(`/api/income-templates/${id}`, { method: "DELETE" });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error ?? "No se pudo eliminar");
      return;
    }

    await loadData();
  }

  return (
    <div style={{ display: "grid", gap: "14px" }}>
      <section className="page-section">
        <div className="section-header">
          <div>
            <h2 className="section-title">Templates de ingresos</h2>
            <p className="section-subtitle">Los cambios aplican al mes abierto y a los meses futuros.</p>
          </div>
          <span className="inline-tag">Activos proyectados: {formatCurrency(total, "CRC")}*</span>
        </div>

        <form onSubmit={onSubmit}>
          <div className="form-grid">
            <label>
              Descripcion
              <input
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                required
                value={form.name}
              />
            </label>
            <label>
              Dueno
              <select
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, owner: event.target.value as IncomeOwner }))
                }
                value={form.owner}
              >
                <option value="JOHAN">Johan</option>
                <option value="WENDY">Wendy</option>
              </select>
            </label>
            <label>
              Monto
              <input
                min={0}
                onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
                required
                step="0.01"
                type="number"
                value={form.amount}
              />
            </label>
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
            <label>
              Frecuencia
              <select
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    frequency: event.target.value as "MENSUAL" | "QUINCENAL"
                  }))
                }
                value={form.frequency}
              >
                <option value="MENSUAL">Mensual</option>
                <option value="QUINCENAL">Quincenal</option>
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
            <label style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--muted)" }}>
              <input
                checked={form.isActive}
                onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                type="checkbox"
              />
              Activo
            </label>
          </div>
        </form>

        {error ? <p className="error-box">{error}</p> : null}
      </section>

      <section className="page-section">
        <div className="section-header">
          <h2 className="section-title">Listado</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Descripcion</th>
                <th>Dueno</th>
                <th>Monto</th>
                <th>Frecuencia</th>
                <th>Activo</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6}>Cargando...</td>
                </tr>
              ) : templates.length === 0 ? (
                <tr>
                  <td colSpan={6}>Sin templates</td>
                </tr>
              ) : (
                templates.map((item) => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>{ownerLabel(item.owner)}</td>
                    <td>{formatCurrency(item.amount, item.currency)}</td>
                    <td>{item.frequency === "MENSUAL" ? "Mensual" : "Quincenal"}</td>
                    <td>{item.isActive ? "Si" : "No"}</td>
                    <td className="cell-actions">
                      <button className="btn btn-secondary" onClick={() => startEdit(item)} type="button">
                        Editar
                      </button>
                      <button className="btn btn-danger" onClick={() => removeTemplate(item.id)} type="button">
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="section-subtitle">* Total simple sin conversion de moneda para referencia rapida.</p>
      </section>
    </div>
  );
}

"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { formatCurrency } from "@/lib/currency";

type CategoryOwner = "JOHAN" | "WENDY" | "AMBOS";
type Contributor = "JOHAN" | "WENDY" | "AMBOS";

type CategoryOption = {
  id: string;
  name: string;
  type: "FIJO" | "VARIABLE" | "IMPREVISTA";
  owner: CategoryOwner;
  currency: "CRC" | "USD";
  monthlyBudget: number;
  biweeklyControl: boolean;
  isOneOff: boolean;
  totalSpent: number;
  remainingToSettle: number;
  isFixedMonthly: boolean;
  isSettled: boolean;
};

type ExpenseItem = {
  id: string;
  monthId: string;
  categoryId: string;
  categoryName: string;
  categoryOwner: CategoryOwner;
  categoryType: "FIJO" | "VARIABLE" | "IMPREVISTA";
  categoryCurrency: "CRC" | "USD";
  categoryIsFixedMonthly: boolean;
  amount: number;
  currency: "CRC" | "USD";
  paidBy: Contributor;
  spentAt: string;
  comment: string | null;
};

type ExpensesPayload = {
  month: {
    id: string;
    status: "OPEN" | "CLOSED";
    monthStart: string;
    preclosures: Array<{
      id: string;
      fortnight: number;
      generatedAt: string;
    }>;
  };
  categories: CategoryOption[];
  expenses: ExpenseItem[];
};

type FormState = {
  id?: string;
  categoryId: string;
  amount: string;
  currency: "CRC" | "USD";
  paidBy: Contributor;
  comment: string;
};

const EMPTY_FORM: FormState = {
  categoryId: "",
  amount: "",
  currency: "CRC",
  paidBy: "JOHAN",
  comment: ""
};

const TABS: Array<{ key: CategoryOwner; label: string }> = [
  { key: "JOHAN", label: "Johan" },
  { key: "WENDY", label: "Wendy" },
  { key: "AMBOS", label: "Ambos" }
];

type MovementView = "MONTHLY" | "BIWEEKLY";

const MOVEMENT_TABS: Array<{ key: MovementView; label: string }> = [
  { key: "MONTHLY", label: "Mensual" },
  { key: "BIWEEKLY", label: "Quincenal" }
];

type QuickFormState = {
  categoryId: string;
  amount: string;
  spentAt: string;
};

function localDateInputValue(date = new Date()) {
  const copy = new Date(date.getTime());
  copy.setMinutes(copy.getMinutes() - copy.getTimezoneOffset());
  return copy.toISOString().slice(0, 10);
}

function tabPaidBy(tab: CategoryOwner): Contributor {
  return tab;
}

export function ExpensesPage() {
  const [data, setData] = useState<ExpensesPayload | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [quickForm, setQuickForm] = useState<QuickFormState>({
    categoryId: "",
    amount: "",
    spentAt: localDateInputValue()
  });
  const [activeTab, setActiveTab] = useState<CategoryOwner>("AMBOS");
  const [movementView, setMovementView] = useState<MovementView>("MONTHLY");
  const [movementViewMode, setMovementViewMode] = useState<"TABLE" | "CARDS">("TABLE");
  const [movementFilter, setMovementFilter] = useState("");
  const [showFullForm, setShowFullForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [quickSaving, setQuickSaving] = useState(false);
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

  const tabCategories = useMemo(
    () => data?.categories.filter((category) => category.owner === activeTab) ?? [],
    [data, activeTab]
  );
  const fixedMonthlyCategories = useMemo(
    () => tabCategories.filter((category) => category.isFixedMonthly),
    [tabCategories]
  );
  const manualCategories = useMemo(
    () => tabCategories.filter((category) => !category.isFixedMonthly),
    [tabCategories]
  );
  const tabExpenses = useMemo(
    () => data?.expenses.filter((expense) => expense.categoryOwner === activeTab) ?? [],
    [data, activeTab]
  );

  const biweeklyMeta = useMemo(() => {
    if (!data) {
      return { label: "Q1", cutoff: null as number | null };
    }

    const firstPreclosure = data.month.preclosures.find((item) => item.fortnight === 1);
    if (!firstPreclosure) {
      return { label: "Q1", cutoff: null as number | null };
    }

    return { label: "Q2", cutoff: new Date(firstPreclosure.generatedAt).getTime() };
  }, [data]);

  const movementExpenses = useMemo(() => {
    if (movementView === "MONTHLY") {
      return tabExpenses;
    }
    const cutoff = biweeklyMeta.cutoff;
    if (cutoff === null) {
      return tabExpenses;
    }
    return tabExpenses.filter((expense) => new Date(expense.spentAt).getTime() >= cutoff);
  }, [movementView, tabExpenses, biweeklyMeta]);

  const filteredMovementExpenses = useMemo(() => {
    const term = movementFilter.trim().toLowerCase();
    if (!term) {
      return movementExpenses;
    }
    return movementExpenses.filter((expense) => {
      const comment = expense.comment?.toLowerCase() ?? "";
      return (
        expense.categoryName.toLowerCase().includes(term) ||
        comment.includes(term) ||
        expense.paidBy.toLowerCase().includes(term)
      );
    });
  }, [movementExpenses, movementFilter]);

  async function loadData() {
    setLoading(true);
    setError(null);
    const response = await fetch("/api/expenses", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error ?? "No se pudo cargar");
      setLoading(false);
      return;
    }

    setData(payload);
    setLoading(false);
  }

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (manualCategories.length === 0) {
      setForm((prev) => ({ ...prev, categoryId: "" }));
      setQuickForm((prev) => ({ ...prev, categoryId: "" }));
      return;
    }

    setForm((prev) => ({
      ...prev,
      categoryId:
        manualCategories.find((category) => category.id === prev.categoryId)?.id ??
        manualCategories[0].id
    }));
    setQuickForm((prev) => ({
      ...prev,
      categoryId:
        manualCategories.find((category) => category.id === prev.categoryId)?.id ??
        manualCategories[0].id
    }));
  }, [manualCategories]);

  function resetForm() {
    setForm({
      ...EMPTY_FORM,
      categoryId: manualCategories[0]?.id ?? "",
      paidBy: tabPaidBy(activeTab)
    });
  }

  function resetQuickForm() {
    setQuickForm({
      categoryId: manualCategories[0]?.id ?? "",
      amount: "",
      spentAt: localDateInputValue()
    });
  }

  function startEdit(item: ExpenseItem) {
    setShowFullForm(true);
    setForm({
      id: item.id,
      categoryId: item.categoryId,
      amount: `${item.amount}`,
      currency: item.currency,
      paidBy: item.paidBy,
      comment: item.comment ?? ""
    });
  }

  async function onQuickSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuickSaving(true);
    setError(null);

    const selectedCategory = manualCategories.find((category) => category.id === quickForm.categoryId);
    const payload = {
      categoryId: quickForm.categoryId,
      amount: Number(quickForm.amount),
      currency: selectedCategory?.currency ?? "CRC",
      paidBy: tabPaidBy(activeTab),
      comment: "",
      spentAt: quickForm.spentAt
    };

    const response = await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error ?? "No se pudo guardar");
      setQuickSaving(false);
      return;
    }

    await loadData();
    resetQuickForm();
    setQuickSaving(false);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      categoryId: form.categoryId,
      amount: Number(form.amount),
      currency: form.currency,
      paidBy: tabPaidBy(activeTab),
      comment: form.comment
    };
    const method = form.id ? "PUT" : "POST";
    const url = form.id ? `/api/expenses/${form.id}` : "/api/expenses";
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

  async function markFixedAsPaid(categoryId: string) {
    setSaving(true);
    setError(null);
    const response = await fetch("/api/expenses/fixed-pay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        categoryId,
        paidBy: tabPaidBy(activeTab)
      })
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error ?? "No se pudo registrar el pago fijo");
      setSaving(false);
      return;
    }

    await loadData();
    setSaving(false);
  }

  async function removeItem(id: string) {
    if (!window.confirm("Eliminar este gasto?")) {
      return;
    }

    const response = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
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
        <p>Cargando gastos...</p>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="page-section">
        <p>No se pudo cargar la pagina.</p>
      </section>
    );
  }

  return (
    <div style={{ display: "grid", gap: "14px" }}>
      <section className="page-section">
        <div className="section-header">
          <div>
            <h2 className="section-title">Gastos del mes ({monthLabel})</h2>
            <p className="section-subtitle">
              Estado: {data.month.status === "OPEN" ? "Abierto" : "Cerrado"} | Captura por pestañas
            </p>
          </div>
        </div>

        <div className="tab-row" style={{ marginBottom: "12px" }}>
          {TABS.map((tab) => (
            <button
              key={tab.key}
              className={`tab-btn ${activeTab === tab.key ? "active" : ""}`}
              onClick={() => {
                setActiveTab(tab.key);
                setForm((prev) => ({
                  ...prev,
                  paidBy: tabPaidBy(tab.key)
                }));
              }}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="quick-panel">
          <div className="quick-header">
            <div>
              <h3>Agregar rapido</h3>
              <p className="muted">Categoria, monto y fecha. Ideal para registrar en segundos.</p>
            </div>
            <button
              className="btn btn-secondary"
              onClick={() => setShowFullForm((prev) => !prev)}
              type="button"
            >
              {showFullForm ? "Ocultar opciones" : "Ver mas opciones"}
            </button>
          </div>
          <form onSubmit={onQuickSubmit}>
            <div className="form-grid quick-grid">
              <label>
                Categoria
                <select
                  disabled={data.month.status === "CLOSED" || manualCategories.length === 0}
                  onChange={(event) => setQuickForm((prev) => ({ ...prev, categoryId: event.target.value }))}
                  required
                  value={quickForm.categoryId}
                >
                  {manualCategories.length === 0 ? (
                    <option value="">Sin categorias manuales</option>
                  ) : (
                    manualCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))
                  )}
                </select>
              </label>
              <label>
                Monto
                <input
                  disabled={data.month.status === "CLOSED"}
                  min={0}
                  onChange={(event) => setQuickForm((prev) => ({ ...prev, amount: event.target.value }))}
                  required
                  step="0.01"
                  type="number"
                  value={quickForm.amount}
                />
              </label>
              <label>
                Fecha
                <input
                  disabled={data.month.status === "CLOSED"}
                  onChange={(event) => setQuickForm((prev) => ({ ...prev, spentAt: event.target.value }))}
                  required
                  type="date"
                  value={quickForm.spentAt}
                />
              </label>
            </div>

            <div className="btn-row" style={{ marginTop: "10px" }}>
              <button
                className="btn btn-primary"
                disabled={
                  data.month.status === "CLOSED" ||
                  quickSaving ||
                  manualCategories.length === 0 ||
                  quickForm.categoryId.trim().length === 0
                }
                type="submit"
              >
                {quickSaving ? "Guardando..." : "Guardar rapido"}
              </button>
              <button className="btn btn-secondary" onClick={resetQuickForm} type="button">
                Limpiar
              </button>
            </div>
          </form>
        </div>

        <h3 style={{ marginBottom: "8px" }}>Fijos mensuales</h3>
        <div className="table-wrap" style={{ marginBottom: "14px" }}>
          <table>
            <thead>
              <tr>
                <th>Categoria</th>
                <th>Presupuesto</th>
                <th>Gastado</th>
                <th>Pendiente</th>
                <th>Estado</th>
                <th>Accion</th>
              </tr>
            </thead>
            <tbody>
              {fixedMonthlyCategories.length === 0 ? (
                <tr>
                  <td colSpan={6}>No hay categorias fijas mensuales en esta pestaña.</td>
                </tr>
              ) : (
                fixedMonthlyCategories.map((category) => (
                  <tr key={category.id} className={category.isSettled ? "row-paid" : ""}>
                    <td>{category.name}</td>
                    <td>{formatCurrency(category.monthlyBudget, category.currency)}</td>
                    <td>{formatCurrency(category.totalSpent, category.currency)}</td>
                    <td>{formatCurrency(category.remainingToSettle, category.currency)}</td>
                    <td>{category.isSettled ? "Pagado" : "Pendiente"}</td>
                    <td>
                      <button
                        className="btn btn-primary"
                        disabled={data.month.status === "CLOSED" || saving || category.isSettled}
                        onClick={() => markFixedAsPaid(category.id)}
                        type="button"
                      >
                        Marcar pagado
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {showFullForm ? (
          <>
            <h3 style={{ marginBottom: "8px" }}>Gasto manual (variables/imprevistos)</h3>
            <form onSubmit={onSubmit}>
              <div className="form-grid">
                <label>
                  Categoria
                  <select
                    disabled={data.month.status === "CLOSED" || manualCategories.length === 0}
                    onChange={(event) => setForm((prev) => ({ ...prev, categoryId: event.target.value }))}
                    required
                    value={form.categoryId}
                  >
                    {manualCategories.length === 0 ? (
                      <option value="">Sin categorias manuales</option>
                    ) : (
                      manualCategories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))
                    )}
                  </select>
                </label>
                <label>
                  Monto
                  <input
                    disabled={data.month.status === "CLOSED"}
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
                    disabled={data.month.status === "CLOSED"}
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
                  Pagado por
                  <select
                    disabled
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, paidBy: event.target.value as Contributor }))
                    }
                    value={tabPaidBy(activeTab)}
                  >
                    <option value="JOHAN">Johan</option>
                    <option value="WENDY">Wendy</option>
                    <option value="AMBOS">Ambos</option>
                  </select>
                </label>
              </div>

              <div className="form-grid two-col" style={{ marginTop: "10px" }}>
                <label style={{ gridColumn: "1 / -1" }}>
                  Comentario (opcional)
                  <textarea
                    disabled={data.month.status === "CLOSED"}
                    onChange={(event) => setForm((prev) => ({ ...prev, comment: event.target.value }))}
                    value={form.comment}
                  />
                </label>
              </div>

              <div className="btn-row" style={{ marginTop: "10px" }}>
                <button
                  className="btn btn-primary"
                  disabled={
                    data.month.status === "CLOSED" ||
                    saving ||
                    manualCategories.length === 0 ||
                    form.categoryId.trim().length === 0
                  }
                  type="submit"
                >
                  {form.id ? "Actualizar gasto" : "Registrar gasto"}
                </button>
                {form.id ? (
                  <button className="btn btn-secondary" onClick={resetForm} type="button">
                    Cancelar edicion
                  </button>
                ) : null}
              </div>
            </form>
          </>
        ) : (
          <p className="muted" style={{ marginTop: "8px" }}>
            Necesitas moneda o comentario? Usa &quot;Ver mas opciones&quot;.
          </p>
        )}

        {error ? <p className="error-box">{error}</p> : null}
      </section>

      <section className="page-section">
        <div className="section-header" style={{ marginBottom: "10px" }}>
          <div>
            <h2 className="section-title">Movimientos ({TABS.find((tab) => tab.key === activeTab)?.label})</h2>
            <p className="section-subtitle">
              Vista {movementView === "MONTHLY" ? "mensual" : `quincenal (${biweeklyMeta.label})`}.
            </p>
          </div>
        </div>

        <div className="tab-row" style={{ marginBottom: "12px" }}>
          {MOVEMENT_TABS.map((tab) => (
            <button
              key={tab.key}
              className={`tab-btn ${movementView === tab.key ? "active" : ""}`}
              onClick={() => setMovementView(tab.key)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="table-controls">
          <input
            placeholder="Filtrar por categoria, comentario o pagado por..."
            value={movementFilter}
            onChange={(event) => setMovementFilter(event.target.value)}
          />
          <div className="toggle-group">
            <button
              className={`btn btn-secondary ${movementViewMode === "TABLE" ? "active" : ""}`}
              onClick={() => setMovementViewMode("TABLE")}
              type="button"
            >
              Tabla
            </button>
            <button
              className={`btn btn-secondary ${movementViewMode === "CARDS" ? "active" : ""}`}
              onClick={() => setMovementViewMode("CARDS")}
              type="button"
            >
              Tarjetas
            </button>
          </div>
        </div>

        {movementViewMode === "TABLE" ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Categoria</th>
                  <th>Monto</th>
                  <th>Pagado por</th>
                  <th>Comentario</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredMovementExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      {movementExpenses.length === 0
                        ? "No hay gastos registrados para esta vista."
                        : "No hay resultados con ese filtro."}
                    </td>
                  </tr>
                ) : (
                  filteredMovementExpenses.map((item) => (
                    <tr key={item.id} className={item.categoryIsFixedMonthly ? "row-paid" : ""}>
                      <td>
                        {new Date(item.spentAt).toLocaleDateString("es-CR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric"
                        })}
                      </td>
                      <td>{item.categoryName}</td>
                      <td>{formatCurrency(item.amount, item.currency)}</td>
                      <td>
                        {item.paidBy === "JOHAN" ? "Johan" : item.paidBy === "WENDY" ? "Wendy" : "Ambos"}
                      </td>
                      <td>{item.comment ?? "-"}</td>
                      <td>{item.categoryIsFixedMonthly ? "Pagado (fijo)" : "Pagado"}</td>
                      <td className="cell-actions">
                        <button
                          className="btn btn-secondary"
                          disabled={data.month.status === "CLOSED"}
                          onClick={() => startEdit(item)}
                          type="button"
                        >
                          Editar
                        </button>
                        <button
                          className="btn btn-danger"
                          disabled={data.month.status === "CLOSED"}
                          onClick={() => removeItem(item.id)}
                          type="button"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="cards-list">
            {filteredMovementExpenses.length === 0 ? (
              <p className="muted">
                {movementExpenses.length === 0
                  ? "No hay gastos registrados para esta vista."
                  : "No hay resultados con ese filtro."}
              </p>
            ) : (
              filteredMovementExpenses.map((item) => (
                <article className={`card-item ${item.categoryIsFixedMonthly ? "row-paid" : ""}`} key={item.id}>
                  <div className="card-row">
                    <span className="card-title">{item.categoryName}</span>
                    <span className="card-amount">{formatCurrency(item.amount, item.currency)}</span>
                  </div>
                  <div className="card-row">
                    <span className="muted">
                      {new Date(item.spentAt).toLocaleDateString("es-CR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric"
                      })}
                    </span>
                    <span className="inline-tag">{item.categoryIsFixedMonthly ? "Fijo" : "Manual"}</span>
                  </div>
                  <div className="card-row">
                    <span className="muted">Pagado por</span>
                    <span>{item.paidBy === "JOHAN" ? "Johan" : item.paidBy === "WENDY" ? "Wendy" : "Ambos"}</span>
                  </div>
                  {item.comment ? <p className="card-note">{item.comment}</p> : null}
                  <div className="card-actions">
                    <button
                      className="btn btn-secondary"
                      disabled={data.month.status === "CLOSED"}
                      onClick={() => startEdit(item)}
                      type="button"
                    >
                      Editar
                    </button>
                    <button
                      className="btn btn-danger"
                      disabled={data.month.status === "CLOSED"}
                      onClick={() => removeItem(item.id)}
                      type="button"
                    >
                      Eliminar
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        )}
      </section>
    </div>
  );
}

"use client";

import { FormEvent, useEffect, useState } from "react";

export function SettingsPage() {
  const [exchangeRate, setExchangeRate] = useState("");
  const [newKey, setNewKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadSettings() {
    setLoading(true);
    setError(null);
    const response = await fetch("/api/settings", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error ?? "No se pudo cargar la configuracion");
      setLoading(false);
      return;
    }

    setExchangeRate(`${payload.exchangeRate}`);
    setLoading(false);
  }

  useEffect(() => {
    void loadSettings();
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    const response = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        exchangeRate: Number(exchangeRate),
        newGlobalKey: newKey
      })
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error ?? "No se pudo actualizar");
      setSaving(false);
      return;
    }

    setExchangeRate(`${payload.exchangeRate}`);
    setNewKey("");
    setSuccess("Configuracion actualizada.");
    setSaving(false);
  }

  if (loading) {
    return (
      <section className="page-section">
        <p>Cargando configuracion...</p>
      </section>
    );
  }

  return (
    <section className="page-section">
      <div className="section-header">
        <div>
          <h2 className="section-title">Configuracion</h2>
          <p className="section-subtitle">Tipo de cambio y clave global de acceso.</p>
        </div>
      </div>

      <form onSubmit={onSubmit}>
        <div className="form-grid two-col">
          <label>
            Tipo de cambio (CRC por USD)
            <input
              min={1}
              onChange={(event) => setExchangeRate(event.target.value)}
              required
              step="0.01"
              type="number"
              value={exchangeRate}
            />
          </label>
          <label>
            Nueva clave global (opcional)
            <input
              onChange={(event) => setNewKey(event.target.value)}
              placeholder="Dejar vacio para mantener clave"
              type="password"
              value={newKey}
            />
          </label>
        </div>

        <div className="btn-row" style={{ marginTop: "12px" }}>
          <button className="btn btn-primary" disabled={saving} type="submit">
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </form>

      {error ? <p className="error-box">{error}</p> : null}
      {success ? <p style={{ color: "var(--ok)", marginTop: "10px" }}>{success}</p> : null}
    </section>
  );
}

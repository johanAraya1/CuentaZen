"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function UnlockPage() {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch("/api/auth/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key })
    });
    const data = await response.json();

    if (!response.ok) {
      setError(data.error ?? "No se pudo validar la clave");
      setLoading(false);
      return;
    }

    router.replace("/");
    router.refresh();
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <h1>Ingresar</h1>
        <p>Introduce la clave global para acceder a Casita en Orden.</p>

        <form onSubmit={onSubmit}>
          <label>
            Clave global
            <input
              autoComplete="off"
              disabled={loading}
              onChange={(event) => setKey(event.target.value)}
              type="password"
              value={key}
            />
          </label>

          <div className="btn-row" style={{ marginTop: "12px" }}>
            <button className="btn btn-primary" disabled={loading || key.trim().length === 0} type="submit">
              {loading ? "Validando..." : "Entrar"}
            </button>
          </div>
        </form>

        {error ? <p className="error-box">{error}</p> : null}
      </div>
    </div>
  );
}

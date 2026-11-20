"use client";

import { FormEvent, useEffect, useState } from "react";
import type { Branch } from "@/lib/branches";
import { branchLocation } from "@/lib/branch-contact";
import { DEFAULT_TEMPLATE } from "@/lib/whatsapp";

export function SettingsTab() {
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/admin/settings").then((r) => (r.ok ? r.json() : null)).then((s) => {
      if (!s) return;
      setTemplate(s.whatsappTemplate || DEFAULT_TEMPLATE); setBranches(s.branches ?? []);
    });
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/admin/settings", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ whatsappTemplate: template, branches })
    });
    setMessage(response.ok ? "Guardado." : "No se pudo guardar. Revisá los datos.");
  }

  // las direcciones son fijas: solo se editan los números
  const updateNumber = (index: number, value: string) =>
    setBranches(branches.map((branch, i) => (i === index ? { ...branch, whatsapp: value } : branch)));

  return <form className="product-form" onSubmit={save}>
    <p>AJUSTES</p>
    <h1>WhatsApp</h1>
    <h2>WhatsApp</h2>
    <label>Mensaje (usá {"{nombre}"}, {"{sku}"} y {"{link}"})
      <textarea value={template} onChange={(e) => setTemplate(e.target.value)} rows={3} />
    </label>

    <h2>Sucursales</h2>
    {branches.map((branch, index) => <fieldset key={branch.name} className="branch-numbers">
      <legend>{branch.name}</legend>
      <p className="branch-fixed-place">{branchLocation(branch)}</p>
      <label>WhatsApp (ej. 5491154560043)
        <input value={branch.whatsapp} onChange={(e) => updateNumber(index, e.target.value.replace(/[^\d+\s-]/g, ""))} inputMode="tel" />
      </label>
    </fieldset>)}

    <button type="submit">Guardar</button>
    <small>{message}</small>
  </form>;
}

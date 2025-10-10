"use client";
import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle"|"sending"|"sent"|"error">("idle");

  async function requestMagic() {
    if (!email) return;
    setStatus("sending");
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/magic/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-semibold mb-4">Entre no Zenbild</h1>

      <label className="block text-sm mb-2">E-mail</label>
      <input
        className="w-full border rounded-lg p-3 mb-3"
        type="email"
        placeholder="voce@exemplo.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <button
        className="w-full rounded-xl p-3 font-medium border shadow"
        onClick={requestMagic}
        disabled={status === "sending"}
      >
        {status === "sending" ? "Enviando..." : "Receber link mágico"}
      </button>

      {status === "sent" && (
        <p className="text-sm text-gray-600 mt-3">
          Se o e-mail existir, você receberá um link de acesso que expira em 15 minutos.
        </p>
      )}

      <div className="mt-6 text-sm">
        <a className="underline" href="/demo">Continuar como convidado</a>
      </div>
    </div>
  );
}

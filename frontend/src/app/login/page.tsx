"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

function PersistRedirectTarget() {
  const searchParams = useSearchParams();
  const nextParam = searchParams.get("next");

  useEffect(() => {
    const isSafePath = nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//");
    if (isSafePath) {
      document.cookie = `post_login_redirect=${encodeURIComponent(nextParam)}; path=/`;
    } else {
      document.cookie = "post_login_redirect=; path=/; max-age=0";
    }
  }, [nextParam]);

  return null;
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [needsAccountConfirmation, setNeedsAccountConfirmation] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function requestMagic(createIfMissing = false) {
    if (!email) return;
    setErrorMessage(null);
    setNeedsAccountConfirmation(false);
    setStatus("sending");
    try {
      const apiBaseUrl = (
        process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
      ).replace(/\/+$/, "");
      const res = await fetch(`${apiBaseUrl}/auth/magic/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, create_if_missing: createIfMissing }),
      });
      const data = await res.json().catch(() => ({}));

      if (data?.reason === "user_not_found" && !createIfMissing) {
        setNeedsAccountConfirmation(true);
        setStatus("idle");
        return;
      }

      if (!res.ok || !data?.ok) {
        const detail = data?.detail ?? "Não foi possível enviar o link.";
        throw new Error(detail);
      }

      setStatus("sent");
    } catch (error) {
      setStatus("error");
      setErrorMessage(
        error instanceof Error ? error.message : "Erro ao solicitar o link mágico."
      );
    }
  }

  return (
    <div className="mx-auto max-w-md p-6">
      <Suspense fallback={null}>
        <PersistRedirectTarget />
      </Suspense>
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
        onClick={() => requestMagic(false)}
        disabled={status === "sending"}
      >
        {status === "sending" ? "Enviando..." : "Receber link mágico"}
      </button>

      {status === "sent" && (
        <p className="text-sm text-gray-600 mt-3">
          Se o e-mail existir, você receberá um link de acesso que expira em 15 minutos.
        </p>
      )}

      {needsAccountConfirmation && (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="mb-3">
            Não encontramos uma conta com este e-mail. Deseja criar uma nova conta e enviar o link de acesso?
          </p>
          <button
            className="w-full rounded-lg border border-amber-400 bg-white px-4 py-2 font-medium text-amber-900 hover:bg-amber-100"
            onClick={() => requestMagic(true)}
            disabled={status === "sending"}
          >
            Criar conta e enviar link
          </button>
        </div>
      )}

      {status === "error" && errorMessage && (
        <p className="mt-3 text-sm text-red-600">{errorMessage}</p>
      )}

      <div className="mt-6 text-sm">
        <a className="underline" href="/demo">Continuar como convidado</a>
      </div>
    </div>
  );
}

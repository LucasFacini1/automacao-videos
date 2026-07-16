"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

/**
 * Link mágico, não senha.
 *
 * A usuária final é a tia do Lucas, no celular. Senha = ela esquece = ela
 * liga pro Lucas. É exatamente o problema que o sistema existe pra resolver.
 */
export function FormLogin() {
  const [email, setEmail] = useState("");
  const [estado, setEstado] = useState<"parado" | "enviando" | "enviado">("parado");
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEstado("enviando");

    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });

    if (error) {
      setErro(error.message);
      setEstado("parado");
      return;
    }
    setEstado("enviado");
  }

  if (estado === "enviado") {
    return (
      <div className="text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10 text-2xl">
          ✉️
        </div>
        <h1 className="mt-4 text-xl font-semibold">Olhe seu email</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Mandamos um link para <span className="font-medium text-foreground">{email}</span>.
          <br />
          Toque nele e você já entra — não tem senha.
        </p>
        <Button
          variant="ghost"
          className="mt-5"
          onClick={() => {
            setEstado("parado");
            setEmail("");
          }}
        >
          Usar outro email
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={enviar}>
      <h1 className="text-2xl font-semibold tracking-tight">Entrar</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Digite seu email. Mandamos um link e você entra sem senha.
      </p>

      <div className="mt-6 space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          placeholder="voce@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-12 text-base"
        />
      </div>

      {erro && <p className="mt-3 text-sm text-destructive">{erro}</p>}

      <Button
        type="submit"
        size="lg"
        disabled={estado === "enviando" || !email}
        className="mt-5 h-12 w-full text-base"
      >
        {estado === "enviando" ? "Enviando..." : "Receber link"}
      </Button>
    </form>
  );
}

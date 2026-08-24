"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

/**
 * Dois caminhos:
 *  - senha: funciona já, sem depender do provedor de email. É como o Lucas
 *    entra pra desenvolver/usar agora.
 *  - link mágico: pra produção (a tia entra sem senha). Depende do email estar
 *    configurado no Supabase.
 */
export function FormLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [modo, setModo] = useState<"senha" | "link">("senha");
  const [estado, setEstado] = useState<"parado" | "enviando" | "link_enviado">("parado");
  const [erro, setErro] = useState<string | null>(null);

  async function entrarComSenha(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEstado("enviando");

    const { error } = await createClient().auth.signInWithPassword({ email, password: senha });
    if (error) {
      setErro(traduzir(error.message));
      setEstado("parado");
      return;
    }
    router.push("/");
    router.refresh();
  }

  async function enviarLink(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEstado("enviando");

    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setErro(traduzir(error.message));
      setEstado("parado");
      return;
    }
    setEstado("link_enviado");
  }

  if (estado === "link_enviado") {
    return (
      <div className="text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10 text-2xl">
          ✉️
        </div>
        <h1 className="mt-4 text-xl font-semibold">Olhe seu email</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Mandamos um link para <span className="font-medium text-foreground">{email}</span>.
          <br />
          Toque nele e você entra — sem senha.
        </p>
        <Button variant="ghost" className="mt-5" onClick={() => setEstado("parado")}>
          Voltar
        </Button>
      </div>
    );
  }

  const enviar = modo === "senha" ? entrarComSenha : enviarLink;

  return (
    <form onSubmit={enviar}>
      <h1 className="text-2xl font-semibold tracking-tight">Entrar</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {modo === "senha" ? "Seu email e senha." : "Digite seu email; mandamos um link pra entrar."}
      </p>

      <div className="mt-6 space-y-4">
        <div className="space-y-2">
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

        {modo === "senha" && (
          <div className="space-y-2">
            <Label htmlFor="senha">Senha</Label>
            <Input
              id="senha"
              type="password"
              autoComplete="current-password"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="h-12 text-base"
            />
          </div>
        )}
      </div>

      {erro && <p className="mt-3 text-sm text-destructive">{erro}</p>}

      <Button
        type="submit"
        size="lg"
        disabled={estado === "enviando" || !email || (modo === "senha" && !senha)}
        className="mt-5 h-12 w-full text-base"
      >
        {estado === "enviando" ? "..." : modo === "senha" ? "Entrar" : "Receber link"}
      </Button>

      <Button
        type="button"
        variant="link"
        onClick={() => {
          setModo(modo === "senha" ? "link" : "senha");
          setErro(null);
        }}
        className="mt-4 w-full text-muted-foreground underline"
      >
        {modo === "senha" ? "Entrar sem senha (link no email)" : "Entrar com senha"}
      </Button>
    </form>
  );
}

function traduzir(msg: string): string {
  if (/invalid login credentials/i.test(msg)) return "Email ou senha errados.";
  if (/email not confirmed/i.test(msg)) return "Email ainda não confirmado.";
  if (/rate limit/i.test(msg)) return "Muitas tentativas. Espere um pouco.";
  return msg;
}

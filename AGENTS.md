<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# automacao-videos

**Leia [PLAN.md](PLAN.md) antes de qualquer mudança de arquitetura.** As decisões já
tomadas estão lá com o porquê. PT-BR sempre, com o dono do projeto e nos comentários.

## Armadilhas que já custaram tempo

**shadcn aqui usa Base UI, não Radix.** Não existe `asChild` — é `render={<Link/>}`. E
quando o `render` não é um `<button>`, precisa de `nativeButton={false}` junto, ou o
componente monta e o browser reclama em runtime. **O `tsc` passa nos dois casos.**
Verifique no browser, não no typecheck.

**Tailwind 4:** configuração por CSS em `src/app/globals.css`. Não existe
`tailwind.config.js`.

**Turbopack e a raiz:** existe um `package-lock.json` solto em `C:\Users\lucas`
(resquício de um `git init` na home). Sem o `turbopack.root` fixado no `next.config.ts`,
o Next elege a pasta pessoal inteira como workspace. Não remova esse config.

**Worker: nunca `--watch`.** O reload mata o processo no meio de uma geração de vídeo e
o job fica preso em `rodando` até o `destravar_jobs()` liberar (15 min).

## Invariantes do produto

**A referência da persona é congelada** (PLAN.md §3.1). Nunca aponte
`persona.ref_image_url` para "a imagem base mais recente" — isso realimenta a geração e
a persona vira outra pessoa em algumas dezenas de produtos, sem nenhum passo isolado
parecer errado. Trocar é ação deliberada no setup da conta.

**O gate de aprovação é obrigatório.** `analisar()` recusa imagem que não esteja
`aprovada`. Imagem custa ~R$0,72, vídeo ~R$5,40 — errar barato é o ponto. Não contorne.

**Boilerplate vs direção** (PLAN.md §5). Se o campo seria idêntico entre uma peça e
outra, é boilerplate e fica em `src/lib/formatos.ts`. Se muda com a peça, é direção e
quem escreve é o Claude, olhando a imagem base. Não deixe o modelo reescrever o
negative nem as constraints.

**Zero jargão na interface.** A usuária final é a tia do dono, no celular, e o objetivo
é ela usar sozinha. "Criando a foto", não "gerando imagem". Nunca "prompt", "IA", "job",
"gerar". Custo sempre aparece antes de confirmar.

## Comandos

```bash
npm run dev            # dashboard
npm run worker         # worker (outro terminal; sem --watch)
npm test               # testes da costura do prompt (não precisa de chave)
npm run testar:imagem  # smoke da imagem base (precisa só da GOOGLE_API_KEY)
```

## Estado

`src/lib/mock.ts` é temporário — some quando as telas forem ligadas no Supabase.
RLS está desativado; ligar antes de qualquer usuário além dos três conhecidos.

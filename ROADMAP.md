# Roadmap — de MVP a SaaS

Documento vivo de continuidade. O [PLAN.md](PLAN.md) descreve **como** o sistema
funciona hoje; este aqui descreve **para onde vai** e **em que ordem**.

Marque `[x]` conforme fechar. Cada épico tem um "porquê" — a razão de existir — pra
não virar lista de afazeres sem norte.

---

## Onde estamos (o que já funciona, de verdade)

- Login (senha + link mágico), multi-conta por usuário
- Persona congelada por conta (referência com o closet)
- Pipeline real ponta a ponta: foto do produto → imagem base (Nano Banana Pro) →
  **aprovação** → direção + copy PT-BR (Gemini Flash-Lite) → vídeo (Veo 3.1 Fast)
- Fila no Postgres + worker; tela do produto reflete o estado do banco
- Dashboard funcional, exclusão de conta/produto, custo mostrado antes de gerar

**Testado com dinheiro real:** um MP4 de 8s saiu ponta a ponta. É produto, não maquete.

---

## As 3 decisões que só você toma

Estas moldam todo o resto. Recomendo fechar antes de investir pesado.

1. **Modelo de cobrança.** Cada imagem custa ~R$0,72 e cada vídeo ~R$5,40 — isso sai
   do **seu** bolso hoje. Num SaaS com vários usuários, sem cobrança você banca a conta
   do Google de todo mundo e quebra. Ver Épico 2. **Recomendo créditos** (a pessoa
   compra um pacote, cada geração consome), porque casa custo com receita geração a
   geração — melhor que assinatura fixa pra um produto de custo variável.

2. **Marca.** Nome, domínio, identidade. "Studio" é provisório. Isso destrava landing
   page, e-mails, e o "algo único" que você quer. Ver Épico 3.

3. **Público-alvo.** Só afiliadas de moda? Ou qualquer nicho (o schema já é genérico)?
   Isso muda copy, formatos e marketing. Não bloqueia código, mas orienta prioridade.

---

## Épico 1 — Fundação (pré-requisito de ter QUALQUER usuário externo)

**Por quê:** hoje só funciona com o teu PC ligado. Nenhum usuário de fora existe até
isto estar de pé. É o gargalo real, antes de qualquer feature bonita.

- [ ] Deploy do dashboard na **Vercel** (envs de produção)
- [ ] Deploy do **worker na Railway** (processo 24/7, não a tua máquina)
- [ ] Envs de produção separadas de dev (projeto Supabase de prod, ou schema separado)
- [ ] `destravar_jobs()` rodando no boot do worker de prod (já existe, garantir)
- [ ] **Observabilidade:** capturar erros (Sentry ou similar) no dashboard e no worker —
      hoje um job que falha só aparece no log local
- [ ] Health check do worker (saber se caiu) + alerta
- [ ] Notificação "seu vídeo ficou pronto" (e-mail ou push) — o worker leva minutos,
      a pessoa não fica olhando a tela

## Épico 2 — Monetização (o que vira negócio)

**Por quê:** sem isto, é hobby caro. Cada geração é custo real; a receita tem que
entrar antes ou junto do gasto.

- [ ] Decidir: **créditos** (recomendado) vs assinatura vs híbrido
- [ ] Tabela de saldo/créditos por usuário; débito atômico a cada geração
- [ ] **Gate de saldo:** recusar geração sem crédito suficiente (antes de chamar a API,
      não depois de gastar)
- [ ] Integração de pagamento (Stripe internacional, ou **Asaas/Mercado Pago** pra PIX no
      Brasil — PIX é quase obrigatório aqui)
- [ ] Tela de saldo + histórico de consumo (transparência: quanto cada vídeo custou)
- [ ] Margem: definir o preço de venda do crédito acima do custo (Veo + Nano + Flash)
- [ ] Teto de gasto por usuário / alerta de saldo baixo
- [ ] Webhooks de pagamento (confirmação assíncrona) + idempotência

## Épico 3 — Design, navegação e marca (o "algo único")

**Por quê:** é o que você pediu e o que faz parecer produto, não script. Mas vem depois
da fundação — polir algo que ninguém consegue usar é otimizar no vazio.

- [ ] **App shell com menu lateral** (desktop): navegação entre contas, produtos,
      biblioteca, configurações, saldo. Colapsável no mobile (drawer)
- [ ] Trocador de conta rápido no topo da sidebar (multi-conta é o coração do produto)
- [ ] Identidade visual definitiva: logo, paleta própria, um traço memorável
- [ ] **Onboarding guiado** no primeiro uso (criar conta → persona → primeiro produto)
- [ ] Estados de loading/erro/vazio consistentes e caprichados
- [ ] Dark mode (os tokens já suportam; falta revisar)
- [ ] Revisão visual real (a atual foi feita sem eu conseguir ver — precisa teu olho)
- [ ] Microinterações: transições, feedback de ação, skeleton no lugar de spinner

## Épico 4 — Publicação no TikTok (fecha o ciclo)

**Por quê:** hoje entrega o MP4 e a legenda; a pessoa posta na mão. Automatizar isto é o
pulo pra "quase sozinho".

- [ ] Estudar de novo a **Content Posting API** (já pesquisado: *draft mode* não exige
      auditoria; *direct post* exige — começar por draft)
- [ ] **OAuth do TikTok por conta** (cada @ conecta o próprio perfil)
- [ ] Fase 1: empurrar pro **rascunho** do TikTok + notificar ("é só tocar em publicar")
- [ ] **Agendamento:** escolher data/hora; job dispara no horário
- [ ] Sugestão de melhores horários de postagem
- [ ] Legendas: já geradas (Flash-Lite) — refinar edição/aprovação antes de postar
- [ ] Fase 2: pedir auditoria pro *direct post* (publicação direta, sem toque)
- [ ] Fila de publicação com status (agendado / postado / falhou)

## Épico 5 — Biblioteca de formatos

**Por quê:** você quer mais que os 3 atuais (dancinhas, movimento, desfilando). O shape
já mapeia 1:1 pra tabela — é migração, não refatoração.

- [ ] Migrar `src/lib/formatos.ts` pra tabela `formato` (editável sem deploy)
- [ ] Novos formatos: dancinha, desfile, close no tecido, before/after
- [ ] Talvez: formatos por nicho (moda ≠ casa ≠ beleza)
- [ ] Preview do que cada formato faz (exemplo visual)

## Épico 6 — Confiança e conformidade (não é opcional no Brasil)

**Por quê:** você lida com **rostos e imagens de pessoas** (personas IA). Isso é risco
legal e reputacional real. Melhor tratar antes de escalar.

- [ ] **LGPD:** política de privacidade, termos de uso, consentimento
- [ ] Consentimento de uso de imagem (a foto da "modelo" é de alguém real?)
- [ ] Moderação: impedir uso pra gerar imagem de pessoas sem consentimento
- [ ] **RLS de verdade** ou hardening do acesso: hoje é `service_role` + filtro por
      `user_id` no servidor. Funciona, mas com muitos usuários vale endurecer o
      isolamento (policies, ou auditoria do acesso)
- [ ] Rate limiting / anti-abuso (alguém pode torrar crédito/dinheiro num loop)
- [ ] Exclusão de dados sob pedido (direito do titular, LGPD)

## Épico 7 — Crescimento

**Por quê:** depois que o produto se sustenta, atrair e reter.

- [ ] Landing page de venda (o que é, pra quem, quanto custa)
- [ ] Planos/tiers (trial grátis com X créditos?)
- [ ] Programa de indicação (afiliadas indicam afiliadas — combina com o público)
- [ ] Analytics: quais vídeos performam (se integrar métricas do TikTok)
- [ ] Suporte / central de ajuda

---

## Backlog de polimento (dívida técnica, sem pressa)

- [ ] **Consolidar e otimizar os scripts** (`scripts/*.ts`, npm scripts) — hoje são
      meio ad-hoc (Lucas pediu pra lembrar)
- [ ] Testes além da costura do prompt (ações, dados, worker)
- [ ] Isolar o provedor de IA atrás de uma interface (trocar Veo/Gemini sem espalhar)
- [ ] Retry mais esperto no worker (backoff por tipo de erro)
- [ ] Limpeza de imagens base rejeitadas (storage acumula)
- [ ] i18n se um dia sair do Brasil

---

## Ordem sugerida

```
1. Épico 1 (fundação)  ─┐
2. Épico 2 (cobrança)   ├─ sem os dois, não há SaaS
3. Épico 3 (design)    ─┘  (o que você pediu; vem sobre a fundação)
4. Épico 4 (TikTok)        fecha o ciclo "quase sozinho"
5. Épicos 5–7              features e crescimento, conforme tração
   Épico 6 em paralelo:    conformidade acompanha o crescimento, não espera o fim
```

O impulso natural é começar pelo design (Épico 3), porque é o visível. Mas um produto
lindo que só roda no teu PC e que você banca do próprio bolso não é SaaS. Fundação e
cobrança primeiro; o design entra logo em seguida e rende muito mais sobre uma base que
aguenta usuário de verdade.

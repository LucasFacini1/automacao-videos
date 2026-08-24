/**
 * Valores de motion compartilhados — pra nenhum componente inventar o próprio
 * número mágico de spring. Segue o skill apple-design (.claude/skills/apple-design):
 * criticamente amortecido (sem bounce) é o padrão pra UI que não veio de gesto
 * (nada aqui é arrastado pelo dedo) — bounce fica reservado pra interação com
 * momentum, que este app ainda não tem.
 */
import type { Transition, Variants } from "motion/react";

/** Spring padrão: sem overshoot, assentamento rápido. Damping 1.0 / response ~0.4. */
export const springSuave: Transition = { type: "spring", bounce: 0, duration: 0.4 };

/**
 * Entrada/saída de item de lista (card de vídeo, card de produto). Sobe de
 * leve + aparece; some encolhendo — nunca corta seco. `layout` no componente
 * que usa isso faz os vizinhos deslizarem pro lugar quando um item some.
 */
export const itemLista: Variants = {
  entra: { opacity: 0, y: 8, scale: 0.98 },
  presente: { opacity: 1, y: 0, scale: 1, transition: springSuave },
  sai: { opacity: 0, scale: 0.96, transition: { duration: 0.15 } },
};

/** Barra que aparece condicionalmente (ex.: seleção em lote) — desliza de cima. */
export const barraSuspensa: Variants = {
  entra: { opacity: 0, y: -8, height: 0 },
  presente: { opacity: 1, y: 0, height: "auto", transition: springSuave },
  sai: { opacity: 0, y: -8, height: 0, transition: { duration: 0.15 } },
};

/**
 * Troca entre "telas" de um mesmo fluxo (ex.: aguardando → aprovar → escolher
 * vídeos → biblioteca). Só fade + leve deslocamento vertical — sem scale, pra
 * não distorcer imagens/formulários grandes que ocupam o bloco inteiro.
 */
export const trocaDeTela: Variants = {
  entra: { opacity: 0, y: 6 },
  presente: { opacity: 1, y: 0, transition: springSuave },
  sai: { opacity: 0, y: -6, transition: { duration: 0.15 } },
};

/**
 * Erro que o worker NÃO deve retentar.
 *
 * Alguns erros são determinísticos: o filtro de conteúdo do gerador barra a
 * mesma foto+prompt toda vez. Retentar só queima minutos (cada tentativa de
 * vídeo leva ~1min) e termina no mesmo lugar. Estes falham na hora.
 *
 * `mensagemUsuario` é o texto sem jargão que vai pra tela (a tia lê isso). O
 * `message` técnico fica no log e no job, pra depuração.
 */
export class ErroSemRetentar extends Error {
  constructor(
    message: string,
    readonly mensagemUsuario?: string,
  ) {
    super(message);
    this.name = "ErroSemRetentar";
  }
}

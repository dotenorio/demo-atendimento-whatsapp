/**
 * Contadores por dia guardados na memória do servidor.
 *
 * Bastam para a demo pública: cada instância da Vercel tem os seus, então o limite real fica
 * um pouco acima do configurado. Para um cliente com muito tráfego, troque por um contador
 * compartilhado (Upstash Redis ou uma tabela no Supabase) mantendo esta mesma interface.
 */

export class ContadorDiario {
  private dia = "";
  private contagem = new Map<string, number>();

  constructor(
    private readonly limite: number,
    /** Evita a memória crescer sem fim se alguém mandar de muitos IPs. */
    private readonly maxChaves = 50_000,
  ) {}

  private virarDia(agora: Date) {
    const hoje = agora.toISOString().slice(0, 10);
    if (hoje !== this.dia) {
      this.dia = hoje;
      this.contagem.clear();
    }
  }

  /** Conta mais um uso. Devolve false (e não conta) se o limite do dia já foi atingido. */
  usar(chave: string, agora = new Date()): boolean {
    this.virarDia(agora);
    const atual = this.contagem.get(chave) ?? 0;
    if (atual >= this.limite) return false;
    if (!this.contagem.has(chave) && this.contagem.size >= this.maxChaves) return false;
    this.contagem.set(chave, atual + 1);
    return true;
  }
}

/** IP de quem chamou. Na Vercel, o primeiro item de x-forwarded-for é o IP real do visitante. */
export function ipDaRequisicao(req: Request): string {
  const encaminhado = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return encaminhado || req.headers.get("x-real-ip") || "desconhecido";
}

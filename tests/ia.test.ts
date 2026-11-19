import { describe, expect, it } from "vitest";
import { configuracao as config } from "@/config/atendimento";
import { esquemaResposta, paraMensagensDaApi, promptDoSistema } from "@/lib/motor/ia";
import { reais } from "@/lib/texto";

describe("IA: prompt e formato", () => {
  it("o prompt traz os preços, o horário e o que passar para a equipe", () => {
    const p = promptDoSistema(config);
    for (const s of config.servicos) expect(p).toContain(reais(s.precoAPartirDe!));
    expect(p).toContain(config.negocio.horarios);
    expect(p).toContain(config.encaminharParaEquipe[0]);
    expect(p).toContain(config.atendente.nome);
  });

  it("o prompt não muda entre chamadas (para aproveitar o cache)", () => {
    expect(promptDoSistema(config)).toBe(promptDoSistema(config));
  });

  it("converte o histórico e começa sempre pelo paciente", () => {
    const m = paraMensagensDaApi(
      [
        { de: "robo", texto: "mensagem antiga do robô" },
        { de: "paciente", texto: "oi" },
        { de: "robo", texto: "olá!" },
      ],
      "quanto custa?",
    );
    expect(m).toEqual([
      { role: "user", content: "oi" },
      { role: "assistant", content: "olá!" },
      { role: "user", content: "quanto custa?" },
    ]);
  });

  it("o esquema só aceita tratamentos e períodos da configuração", () => {
    const e = esquemaResposta(config);
    expect(e.safeParse({ resposta: "ok", acao: "agendar_avaliacao", tratamento: "implante", periodo: "tarde" }).success).toBe(true);
    expect(e.safeParse({ resposta: "ok", acao: "nenhuma", tratamento: null, periodo: null }).success).toBe(true);
    expect(e.safeParse({ resposta: "ok", acao: "nenhuma", tratamento: "botox", periodo: null }).success).toBe(false);
    expect(e.safeParse({ resposta: "ok", acao: "apagar_tudo", tratamento: null, periodo: null }).success).toBe(false);
  });
});

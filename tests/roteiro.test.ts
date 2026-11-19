import { describe, expect, it } from "vitest";
import { configuracao as config } from "@/config/atendimento";
import { frases, responderComRoteiro } from "@/lib/motor/roteiro";
import { contem, normalizar, reais } from "@/lib/texto";
import type { Mensagem } from "@/lib/tipos";

const responder = (msg: string, historico: Mensagem[] = [], nome = "Ana (simulador)") => responderComRoteiro(config, historico, msg, nome);
const f = frases(config);

describe("texto", () => {
  it("normaliza acentos e caixa", () => {
    expect(normalizar("  Avaliação  AMANHÃ ")).toBe("avaliacao amanha");
  });
  it("palavras curtas precisam aparecer inteiras", () => {
    expect(contem("boa noite", "oi")).toBe(false);
    expect(contem("oi tudo bem", "oi")).toBe(true);
    expect(contem("esta sangrando", "sangr")).toBe(true);
  });
  it("formata reais sem centavos", () => {
    expect(reais(2900)).toBe("R$ 2.900");
  });
});

describe("roteiro sem IA", () => {
  it("cumprimenta usando o primeiro nome, sem o '(simulador)'", () => {
    const r = responder("Oi, boa tarde!");
    expect(r.texto).toContain("Olá, Ana!");
    expect(r.texto).toContain(config.atendente.nome);
    expect(r.origem).toBe("roteiro");
  });

  it("responde o preço 'a partir de' do serviço citado e oferece a avaliação", () => {
    const r = responder("Quanto custa o clareamento?");
    expect(r.texto).toContain("R$ 690");
    expect(r.texto).toContain(f.oferta);
    expect(r.acao).toBe("nenhuma");
    expect(r.tratamento).toBe("clareamento"); // o CRM já recebe o tratamento de interesse
  });

  it("sem serviço citado, lista os preços", () => {
    const r = responder("qual o valor dos tratamentos?");
    for (const s of config.servicos) expect(r.texto).toContain(reais(s.precoAPartirDe!));
  });

  it("preço da consulta não vira pedido de agendamento", () => {
    const r = responder("Quanto custa a consulta?");
    expect(r.texto).toContain("gratuita");
    expect(r.texto).not.toContain(f.perguntaPeriodo);
  });

  it("horário, endereço, pagamento e convênio saem da configuração", () => {
    expect(responder("Qual o horário de vocês?").texto).toContain(config.negocio.horarios);
    expect(responder("Onde fica a clínica?").texto).toContain(config.negocio.endereco);
    expect(responder("Aceitam convênio?").texto).toContain("Não atendemos convênio");
    expect(responder("dá pra parcelar?").texto).toContain("12x");
  });

  it("responde perguntas frequentes", () => {
    expect(responder("tenho medo, dói muito?").texto).toContain("anestesia");
  });

  it("fluxo de agendamento: pede o período e depois confirma com tratamento e período", () => {
    const h: Mensagem[] = [];
    const p1 = "Quanto custa implante?";
    const r1 = responder(p1, h);
    h.push({ de: "paciente", texto: p1 }, { de: "robo", texto: r1.texto });

    const r2 = responder("sim, quero", h);
    expect(r2.texto).toContain(f.perguntaPeriodo);
    expect(r2.texto).toContain("implante");
    h.push({ de: "paciente", texto: "sim, quero" }, { de: "robo", texto: r2.texto });

    const r3 = responder("De manhã é melhor", h);
    expect(r3.acao).toBe("agendar_avaliacao");
    expect(r3.tratamento).toBe("implante");
    expect(r3.periodo).toBe("manha");
    expect(r3.texto).toContain("de manhã");
  });

  it("aceita 'tanto faz' como período", () => {
    const r1 = responder("Quero agendar uma avaliação");
    const r2 = responder("tanto faz", [
      { de: "paciente", texto: "Quero agendar uma avaliação" },
      { de: "robo", texto: r1.texto },
    ]);
    expect(r2.acao).toBe("agendar_avaliacao");
    expect(r2.periodo).toBeUndefined();
  });

  it("'não' depois da oferta encerra com educação", () => {
    const r1 = responder("quanto custa lente?");
    const r2 = responder("não, obrigado", [
      { de: "paciente", texto: "quanto custa lente?" },
      { de: "robo", texto: r1.texto },
    ]);
    expect(r2.acao).toBe("nenhuma");
    expect(r2.texto).not.toContain(f.perguntaPeriodo);
  });

  it("urgência e pedidos fora do escopo vão para a equipe", () => {
    expect(responder("estou com dor forte e o rosto inchado").acao).toBe("falar_com_equipe");
    expect(responder("preciso remarcar minha consulta").acao).toBe("falar_com_equipe");
    expect(responder("quero falar com um atendente").acao).toBe("falar_com_equipe");
  });

  it("não entendeu: explica o que sabe fazer", () => {
    const r = responder("qual a capital da Mongólia?");
    expect(r.texto).toContain("não entendi");
    expect(r.acao).toBe("nenhuma");
  });
});

import { describe, expect, it } from "vitest";
import { configuracao as config } from "@/config/atendimento";
import { historicoDoCrm, registrarNoCrm, textoDaTroca, trocaParaMensagens, type ConfigCrm } from "@/lib/crm";
import type { Resposta } from "@/lib/tipos";

const crm: ConfigCrm = { url: "https://crm.exemplo", chave: "chave-teste", painel: "https://crm.exemplo" };

/** fetch falso que guarda as chamadas e responde na ordem dada. */
function fetchFalso(respostas: { status?: number; corpo: unknown }[]) {
  const chamadas: { url: string; metodo: string; corpo?: Record<string, unknown>; auth?: string }[] = [];
  const f = (async (url: string, init?: RequestInit) => {
    const headers = init?.headers as Record<string, string>;
    chamadas.push({ url, metodo: init?.method ?? "GET", corpo: init?.body ? JSON.parse(String(init.body)) : undefined, auth: headers?.Authorization });
    const r = respostas.shift() ?? { corpo: {} };
    return new Response(JSON.stringify(r.corpo), { status: r.status ?? 200 });
  }) as unknown as typeof fetch;
  return { f, chamadas };
}

const resposta = (extra: Partial<Resposta> = {}): Resposta => ({ texto: "Olá!", acao: "nenhuma", origem: "roteiro", ...extra });

describe("registrarNoCrm", () => {
  it("sem CRM configurado, não chama nada e avisa", async () => {
    const r = await registrarNoCrm(null, config, { telefone: "11900000000", nome: "Ana", mensagem: "oi", resposta: resposta() });
    expect(r.eventos[0].tipo).toBe("crm_desligado");
    expect(r.contatoId).toBeUndefined();
  });

  it("primeira mensagem: cria o contato com a troca e devolve o link", async () => {
    const { f, chamadas } = fetchFalso([{ status: 201, corpo: { criado: true, contato: { id: "c1", nome: "Ana", etapaId: "novo" } } }]);
    const r = await registrarNoCrm(crm, config, { telefone: "11900000000", nome: "Ana", mensagem: "oi", resposta: resposta() }, f);
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0].url).toBe("https://crm.exemplo/api/v1/contatos");
    expect(chamadas[0].auth).toBe("Bearer chave-teste");
    expect(chamadas[0].corpo).toMatchObject({ telefone: "11900000000", origem: "whatsapp", interacao: { tipo: "whatsapp", texto: textoDaTroca(config, "oi", "Olá!") } });
    expect(r.contatoId).toBe("c1");
    expect(r.link).toBe("https://crm.exemplo/contatos/c1");
    expect(r.eventos.map((e) => e.tipo)).toEqual(["contato_criado", "conversa_registrada"]);
  });

  it("contato já existente no CRM aparece como encontrado", async () => {
    const { f } = fetchFalso([{ corpo: { criado: false, contato: { id: "c9", nome: "Ana", etapaId: "conversa" } } }]);
    const r = await registrarNoCrm(crm, config, { telefone: "11900000000", nome: "Ana", mensagem: "oi", resposta: resposta() }, f);
    expect(r.eventos[0].tipo).toBe("contato_encontrado");
  });

  it("agendamento: registra a troca e move para a etapa configurada", async () => {
    const { f, chamadas } = fetchFalso([{ status: 201, corpo: {} }, { status: 201, corpo: {} }]);
    const r = await registrarNoCrm(
      crm,
      config,
      { telefone: "11900000000", nome: "Ana", contatoId: "c1", mensagem: "de tarde", resposta: resposta({ acao: "agendar_avaliacao", tratamento: "clareamento", periodo: "tarde" }) },
      f,
    );
    expect(chamadas.map((c) => c.url)).toEqual([
      "https://crm.exemplo/api/v1/contatos/c1/interacoes",
      "https://crm.exemplo/api/v1/contatos/c1/interacoes",
    ]);
    expect(chamadas[1].corpo).toMatchObject({ etapaId: config.crm.etapaAgendado });
    expect(String(chamadas[1].corpo?.texto)).toContain("Clareamento");
    expect(String(chamadas[1].corpo?.texto)).toContain("tarde");
    expect(r.eventos.map((e) => e.tipo)).toEqual(["conversa_registrada", "etapa_movida"]);
  });

  it("CRM com erro não derruba o atendimento", async () => {
    const { f } = fetchFalso([{ status: 401, corpo: { mensagem: "Chave da API ausente ou inválida." } }]);
    const r = await registrarNoCrm(crm, config, { telefone: "11900000000", nome: "Ana", mensagem: "oi", resposta: resposta() }, f);
    expect(r.eventos.at(-1)).toMatchObject({ tipo: "erro" });
    expect(r.eventos.at(-1)?.texto).toContain("Chave da API");
  });
});

describe("histórico pelo CRM (usado pelo webhook)", () => {
  it("lê e desfaz o formato da troca", () => {
    const t = textoDaTroca(config, "Quanto custa?\nE parcela?", "A partir de R$ 690.");
    expect(trocaParaMensagens(config, t)).toEqual([
      { de: "paciente", texto: "Quanto custa?\nE parcela?" },
      { de: "robo", texto: "A partir de R$ 690." },
    ]);
    expect(trocaParaMensagens(config, "Liguei e não atendeu")).toEqual([]);
  });

  it("monta a conversa em ordem, só com as trocas do WhatsApp", async () => {
    const { f, chamadas } = fetchFalso([
      { corpo: { contatos: [{ id: "c1", nome: "Ana", etapaId: "novo" }] } },
      {
        corpo: {
          interacoes: [
            { tipo: "whatsapp", texto: textoDaTroca(config, "segunda", "resposta 2"), quando: "2026-11-19T12:00:00Z" },
            { tipo: "anotacao", texto: "ligar amanhã", quando: "2026-11-19T11:30:00Z" },
            { tipo: "whatsapp", texto: textoDaTroca(config, "primeira", "resposta 1"), quando: "2026-11-19T11:00:00Z" },
          ],
        },
      },
    ]);
    const r = await historicoDoCrm(crm, config, "5511900000000", 10, f);
    expect(chamadas[0].url).toContain("telefone=5511900000000");
    expect(r.contatoId).toBe("c1");
    expect(r.mensagens.map((m) => m.texto)).toEqual(["primeira", "resposta 1", "segunda", "resposta 2"]);
  });
});

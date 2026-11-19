import { beforeAll, describe, expect, it, vi } from "vitest";

// Sem IA e sem CRM: o simulador responde pelo roteiro e avisa que nada foi gravado
beforeAll(() => {
  vi.stubEnv("ANTHROPIC_API_KEY", "");
  vi.stubEnv("CRM_API_URL", "");
  vi.stubEnv("LIMITE_MENSAGENS_CONVERSA", "2");
});

const chamar = async (corpo: unknown, ip = "198.51.100.1") => {
  const { POST } = await import("@/app/api/simulador/route");
  const r = await POST(new Request("http://localhost/api/simulador", { method: "POST", body: JSON.stringify(corpo), headers: { "x-forwarded-for": ip } }));
  return { status: r.status, json: await r.json() };
};

describe("POST /api/simulador", () => {
  it("começa a conversa, responde e respeita o limite por conversa", async () => {
    const inicio = await chamar({});
    expect(inicio.status).toBe(200);
    expect(inicio.json.persona.nome).toContain("(simulador)");
    expect(inicio.json.restantes).toBe(2);

    const r1 = await chamar({ ficha: inicio.json.ficha, mensagem: "Quanto custa o clareamento?" });
    expect(r1.status).toBe(200);
    expect(r1.json.resposta.texto).toContain("R$ 690");
    expect(r1.json.resposta.origem).toBe("roteiro");
    expect(r1.json.crm.eventos[0].tipo).toBe("crm_desligado");
    expect(r1.json.restantes).toBe(1);

    const r2 = await chamar({ ficha: r1.json.ficha, mensagem: "obrigado" });
    expect(r2.json.restantes).toBe(0);

    const r3 = await chamar({ ficha: r2.json.ficha, mensagem: "mais uma" });
    expect(r3.status).toBe(429);
    expect(r3.json.limite).toBe(true);

    // Reenviar a ficha do começo (com o contador zerado) não burla o limite
    const antiga = await chamar({ ficha: inicio.json.ficha, mensagem: "oi" });
    expect(antiga.status).toBe(429);
  });

  it("recusa ficha inválida e mensagem longa demais", async () => {
    expect((await chamar({ ficha: "falsa.assinatura", mensagem: "oi" })).status).toBe(401);
    const inicio = await chamar({});
    expect((await chamar({ ficha: inicio.json.ficha, mensagem: "a".repeat(501) })).status).toBe(400);
  });
});

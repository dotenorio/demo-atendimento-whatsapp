import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { criarFicha, lerFicha, novaPersona } from "@/lib/conversa";
import { ContadorDiario, ipDaRequisicao } from "@/lib/limitador";
import { assinaturaValida, extrairMensagens, Vistos } from "@/lib/whatsapp";

const SEGREDO = "x".repeat(32);

describe("ficha da conversa", () => {
  it("lê de volta o que foi assinado", () => {
    const ficha = criarFicha({ id: "conv1", tel: "11900000000", nome: "Ana", cid: "c1", n: 3 }, SEGREDO);
    expect(lerFicha(ficha, SEGREDO)).toMatchObject({ tel: "11900000000", cid: "c1", n: 3 });
  });

  it("recusa ficha alterada (trocar o contato ou zerar o contador)", () => {
    const ficha = criarFicha({ id: "conv1", tel: "11900000000", nome: "Ana", cid: "c1", n: 14 }, SEGREDO);
    const [conteudo, assinatura] = ficha.split(".");
    const dados = JSON.parse(Buffer.from(conteudo, "base64url").toString());
    const falsa = Buffer.from(JSON.stringify({ ...dados, cid: "outro", n: 0 })).toString("base64url");
    expect(lerFicha(`${falsa}.${assinatura}`, SEGREDO)).toBeNull();
    expect(lerFicha(ficha, "y".repeat(32))).toBeNull();
    expect(lerFicha("lixo", SEGREDO)).toBeNull();
  });

  it("expira", () => {
    const ficha = criarFicha({ id: "conv1", tel: "11900000000", nome: "Ana", n: 0 }, SEGREDO, Date.parse("2026-01-01T00:00:00Z"));
    expect(lerFicha(ficha, SEGREDO, Date.parse("2026-01-02T00:00:00Z"))).toBeNull();
  });

  it("persona fictícia tem celular válido de SP e é marcada como simulador", () => {
    const p = novaPersona();
    expect(p.tel).toMatch(/^1190\d{7}$/);
    expect(p.nome).toContain("(simulador)");
  });
});

describe("limitador", () => {
  it("conta por chave e por dia", () => {
    const c = new ContadorDiario(2);
    const dia1 = new Date("2026-11-19T10:00:00Z");
    expect(c.usar("a", dia1)).toBe(true);
    expect(c.usar("a", dia1)).toBe(true);
    expect(c.usar("a", dia1)).toBe(false);
    expect(c.usar("b", dia1)).toBe(true);
    expect(c.usar("a", new Date("2026-11-20T10:00:00Z"))).toBe(true);
  });

  it("pega o primeiro IP do x-forwarded-for", () => {
    const req = new Request("http://x", { headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" } });
    expect(ipDaRequisicao(req)).toBe("203.0.113.7");
  });
});

describe("webhook do WhatsApp", () => {
  const corpo = JSON.stringify({
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          {
            field: "messages",
            value: {
              contacts: [{ wa_id: "5511987654321", profile: { name: "Maria Exemplo" } }],
              messages: [
                { id: "wamid.1", from: "5511987654321", type: "text", text: { body: " Quanto custa? " } },
                { id: "wamid.2", from: "5511987654321", type: "audio" },
              ],
            },
          },
        ],
      },
    ],
  });

  it("confere a assinatura X-Hub-Signature-256", () => {
    const certa = `sha256=${createHmac("sha256", "segredo-do-app").update(corpo).digest("hex")}`;
    expect(assinaturaValida(corpo, certa, "segredo-do-app")).toBe(true);
    expect(assinaturaValida(corpo + " ", certa, "segredo-do-app")).toBe(false);
    expect(assinaturaValida(corpo, null, "segredo-do-app")).toBe(false);
    expect(assinaturaValida(corpo, "sha256=abc", "segredo-do-app")).toBe(false);
  });

  it("extrai mensagens de texto com o nome do perfil e separa as outras", () => {
    const { texto, outras } = extrairMensagens(JSON.parse(corpo));
    expect(texto).toEqual([{ id: "wamid.1", de: "5511987654321", nome: "Maria Exemplo", texto: "Quanto custa?" }]);
    expect(outras).toEqual([{ id: "wamid.2", de: "5511987654321" }]);
    expect(extrairMensagens({ object: "page" }).texto).toEqual([]);
  });

  it("ignora mensagem repetida (a Meta reenvia)", () => {
    const v = new Vistos(2);
    expect(v.marcar("a")).toBe(true);
    expect(v.marcar("a")).toBe(false);
    v.marcar("b");
    v.marcar("c");
    expect(v.marcar("a")).toBe(true); // o mais antigo saiu da memória
  });
});

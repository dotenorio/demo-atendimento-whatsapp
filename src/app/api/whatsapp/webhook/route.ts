/**
 * Webhook da WhatsApp Cloud API (Meta). OPCIONAL: a demo pública usa o simulador.
 *
 * GET  → verificação do webhook (a Meta manda hub.challenge e espera receber de volta)
 * POST → mensagens recebidas. Responde 200 na hora e processa depois (`after`), para a Meta não reenviar.
 *
 * Para ligar: veja "Ligar no WhatsApp de verdade" no README.
 */
import { after } from "next/server";
import { configuracao } from "@/config/atendimento";
import { configCrm, configWhatsapp, limites } from "@/lib/ambiente";
import { historicoDoCrm, registrarNoCrm } from "@/lib/crm";
import { responder } from "@/lib/motor";
import { assinaturaValida, enviarTexto, extrairMensagens, Vistos } from "@/lib/whatsapp";

export const runtime = "nodejs";
export const maxDuration = 60;

const vistos = new Vistos();

export async function GET(req: Request) {
  const wa = configWhatsapp();
  if (!wa) return new Response("WhatsApp não configurado.", { status: 503 });
  const p = new URL(req.url).searchParams;
  if (p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === wa.tokenVerificacao) {
    return new Response(p.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("Token de verificação inválido.", { status: 403 });
}

export async function POST(req: Request) {
  const wa = configWhatsapp();
  if (!wa) return new Response("WhatsApp não configurado.", { status: 503 });

  const corpo = await req.text();
  if (!assinaturaValida(corpo, req.headers.get("x-hub-signature-256"), wa.segredoApp)) {
    return new Response("Assinatura inválida.", { status: 401 });
  }
  let payload: unknown;
  try {
    payload = JSON.parse(corpo);
  } catch {
    return new Response("JSON inválido.", { status: 400 });
  }

  const { texto, outras } = extrairMensagens(payload);
  after(async () => {
    const crm = configCrm();
    for (const m of texto) {
      if (!vistos.marcar(m.id)) continue;
      const mensagem = m.texto.slice(0, limites.caracteres * 4);
      const { contatoId, mensagens } = await historicoDoCrm(crm, configuracao, m.de, limites.historico);
      const resposta = await responder(configuracao, mensagens, mensagem, m.nome);
      await enviarTexto(wa, m.de, resposta.texto);
      await registrarNoCrm(crm, configuracao, { telefone: m.de, nome: m.nome || "Paciente do WhatsApp", contatoId, mensagem, resposta });
    }
    for (const m of outras) {
      if (!vistos.marcar(m.id)) continue;
      await enviarTexto(wa, m.de, "Por enquanto eu só consigo ler mensagens de texto. Pode escrever sua dúvida, por favor? 🙂");
    }
  });

  return new Response("ok", { status: 200 });
}

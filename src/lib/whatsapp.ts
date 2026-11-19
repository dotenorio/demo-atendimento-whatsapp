/**
 * WhatsApp Cloud API (Meta): conferir a assinatura do webhook, ler as mensagens recebidas e enviar respostas.
 * Documentação: https://developers.facebook.com/docs/whatsapp/cloud-api
 */
import { createHmac, timingSafeEqual } from "node:crypto";

/** Confere o cabeçalho X-Hub-Signature-256 ("sha256=<hex>") com o App Secret do app da Meta. */
export function assinaturaValida(corpoBruto: string, cabecalho: string | null, segredoApp: string): boolean {
  if (!cabecalho?.startsWith("sha256=")) return false;
  const esperada = Buffer.from(createHmac("sha256", segredoApp).update(corpoBruto, "utf8").digest("hex"));
  const recebida = Buffer.from(cabecalho.slice("sha256=".length));
  return esperada.length === recebida.length && timingSafeEqual(esperada, recebida);
}

export interface MensagemRecebida {
  id: string;
  /** Número no formato da Meta: com 55 e DDD, só dígitos. */
  de: string;
  nome?: string;
  texto: string;
}

interface PayloadWebhook {
  object?: string;
  entry?: {
    changes?: {
      field?: string;
      value?: {
        contacts?: { wa_id?: string; profile?: { name?: string } }[];
        messages?: { id?: string; from?: string; type?: string; text?: { body?: string } }[];
      };
    }[];
  }[];
}

/**
 * Tira as mensagens de texto do corpo do webhook.
 * Ignora status de entrega, áudio, imagem etc. (o robô responde só texto; ver README).
 */
export function extrairMensagens(payload: unknown): { texto: MensagemRecebida[]; outras: { id: string; de: string }[] } {
  const texto: MensagemRecebida[] = [];
  const outras: { id: string; de: string }[] = [];
  const p = payload as PayloadWebhook;
  if (p?.object !== "whatsapp_business_account") return { texto, outras };
  for (const entrada of p.entry ?? []) {
    for (const mudanca of entrada.changes ?? []) {
      if (mudanca.field !== "messages") continue;
      const v = mudanca.value ?? {};
      for (const m of v.messages ?? []) {
        if (!m.id || !m.from) continue;
        const nome = v.contacts?.find((c) => c.wa_id === m.from)?.profile?.name;
        if (m.type === "text" && m.text?.body?.trim()) texto.push({ id: m.id, de: m.from, nome, texto: m.text.body.trim() });
        else outras.push({ id: m.id, de: m.from });
      }
    }
  }
  return { texto, outras };
}

/** Envia uma mensagem de texto. Só funciona dentro da janela de 24 h depois da última mensagem do paciente. */
export async function enviarTexto(
  cfg: { token: string; numeroId: string; versaoGraph: string },
  para: string,
  texto: string,
  f: typeof fetch = fetch,
): Promise<boolean> {
  const r = await f(`https://graph.facebook.com/${cfg.versaoGraph}/${cfg.numeroId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: para, type: "text", text: { body: texto } }),
    signal: AbortSignal.timeout(10_000),
  }).catch((e: unknown) => {
    console.error("WhatsApp: falha de rede ao enviar", e);
    return null;
  });
  if (!r?.ok) {
    if (r) console.error(`WhatsApp: envio recusado (${r.status})`, await r.text().catch(() => ""));
    return false;
  }
  return true;
}

/** Guarda os ids já processados (a Meta reenvia o webhook se demorarmos a responder). */
export class Vistos {
  private ids = new Set<string>();
  constructor(private readonly max = 5000) {}
  /** true se é a primeira vez que vemos esse id. */
  marcar(id: string): boolean {
    if (this.ids.has(id)) return false;
    this.ids.add(id);
    if (this.ids.size > this.max) this.ids.delete(this.ids.values().next().value as string);
    return true;
  }
}

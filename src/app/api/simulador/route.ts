/**
 * POST /api/simulador          → começa uma conversa (persona fictícia + ficha assinada)
 * POST /api/simulador  { ficha, mensagem, historico } → resposta do robô + o que foi gravado no CRM
 *
 * É o "WhatsApp de mentira" da demo pública. Passa pelo mesmo motor e pela mesma gravação no CRM do webhook real.
 */
import { z } from "zod";
import { configuracao } from "@/config/atendimento";
import { configCrm, limites, segredoConversa, simuladorLigado } from "@/lib/ambiente";
import { criarFicha, lerFicha, novaPersona } from "@/lib/conversa";
import { registrarNoCrm } from "@/lib/crm";
import { ContadorDiario, ipDaRequisicao } from "@/lib/limitador";
import { responder } from "@/lib/motor";

export const runtime = "nodejs";
export const maxDuration = 60;

const SEM_CACHE = { "Cache-Control": "no-store" };
const porIp = new ContadorDiario(limites.porIpDia);
/** Também conta no servidor: reenviar uma ficha antiga não zera o limite da conversa. */
const porConversa = new ContadorDiario(limites.porConversa);

const esquema = z.object({
  ficha: z.string().max(2000).optional(),
  mensagem: z.string().trim().max(limites.caracteres, `Mensagem muito longa (máx. ${limites.caracteres} caracteres).`).optional(),
  historico: z
    .array(z.object({ de: z.enum(["paciente", "robo"]), texto: z.string().max(2000) }))
    .max(60)
    .default([]),
});

export async function POST(req: Request) {
  if (!simuladorLigado()) return Response.json({ mensagem: "Simulador desligado." }, { status: 404 });

  const texto = await req.text();
  if (texto.length > 100_000) return Response.json({ mensagem: "Conversa grande demais." }, { status: 413 });
  let corpo: unknown;
  try {
    corpo = JSON.parse(texto || "{}");
  } catch {
    return Response.json({ mensagem: "Envie um objeto JSON." }, { status: 400 });
  }
  const lido = esquema.safeParse(corpo);
  if (!lido.success) return Response.json({ mensagem: lido.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  const { mensagem, historico } = lido.data;
  const segredo = segredoConversa();

  // Sem mensagem: começa uma conversa nova
  if (!mensagem) {
    const persona = novaPersona();
    return Response.json(
      { ficha: criarFicha({ ...persona, n: 0 }, segredo), persona: { nome: persona.nome, tel: persona.tel }, restantes: limites.porConversa },
      { headers: SEM_CACHE },
    );
  }

  const conversa = lerFicha(lido.data.ficha, segredo);
  if (!conversa) return Response.json({ mensagem: "Conversa expirada. Comece uma nova." }, { status: 401 });

  if (conversa.n >= limites.porConversa || !porConversa.usar(conversa.id)) {
    return Response.json(
      { limite: true, mensagem: `Esta demonstração aceita ${limites.porConversa} mensagens por conversa. Clique em “Nova conversa” para testar de novo.` },
      { status: 429, headers: SEM_CACHE },
    );
  }
  if (!porIp.usar(ipDaRequisicao(req))) {
    return Response.json(
      { limite: true, mensagem: "Você chegou ao limite de mensagens de hoje nesta demonstração. Volte amanhã!" },
      { status: 429, headers: SEM_CACHE },
    );
  }

  const resposta = await responder(configuracao, historico, mensagem, conversa.nome);
  const crm = await registrarNoCrm(configCrm(), configuracao, {
    telefone: conversa.tel,
    nome: conversa.nome,
    contatoId: conversa.cid,
    mensagem,
    resposta,
  });

  const n = conversa.n + 1;
  return Response.json(
    {
      resposta,
      crm,
      ficha: criarFicha({ id: conversa.id, tel: conversa.tel, nome: conversa.nome, cid: crm.contatoId ?? conversa.cid, n }, segredo),
      restantes: limites.porConversa - n,
    },
    { headers: SEM_CACHE },
  );
}

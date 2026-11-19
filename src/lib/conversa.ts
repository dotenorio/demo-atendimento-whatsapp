/**
 * Ficha da conversa do simulador, assinada com HMAC-SHA256 (sem banco de dados).
 *
 * Guarda o telefone fictício, o nome, o id do contato no CRM e quantas mensagens já foram enviadas.
 * Como é assinada, o visitante não consegue trocar o contato para escrever no histórico de outra pessoa
 * nem zerar o contador da conversa.
 * Formato: base64url(JSON) + "." + base64url(assinatura).
 */
import { createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";

export const DURACAO_CONVERSA_S = 60 * 60 * 6; // 6 horas

export interface DadosConversa {
  /** Id aleatório da conversa (o servidor também conta as mensagens por ele). */
  id: string;
  /** Telefone fictício, só dígitos com DDD. */
  tel: string;
  nome: string;
  /** Id do contato no CRM, depois da primeira mensagem. */
  cid?: string;
  /** Mensagens já enviadas pelo visitante. */
  n: number;
  exp: number;
}

const assinar = (conteudo: string, segredo: string) => createHmac("sha256", segredo).update(conteudo).digest("base64url");

export function criarFicha(dados: Omit<DadosConversa, "exp">, segredo: string, agora = Date.now()): string {
  const completo: DadosConversa = { ...dados, exp: Math.floor(agora / 1000) + DURACAO_CONVERSA_S };
  const conteudo = Buffer.from(JSON.stringify(completo)).toString("base64url");
  return `${conteudo}.${assinar(conteudo, segredo)}`;
}

export function lerFicha(ficha: string | undefined, segredo: string, agora = Date.now()): DadosConversa | null {
  if (!ficha || ficha.length > 2000) return null;
  const [conteudo, assinatura, ...resto] = ficha.split(".");
  if (!conteudo || !assinatura || resto.length) return null;
  const esperada = Buffer.from(assinar(conteudo, segredo));
  const recebida = Buffer.from(assinatura);
  if (esperada.length !== recebida.length || !timingSafeEqual(esperada, recebida)) return null;
  try {
    const d = JSON.parse(Buffer.from(conteudo, "base64url").toString("utf8")) as DadosConversa;
    if (typeof d.id !== "string" || typeof d.tel !== "string" || typeof d.nome !== "string" || typeof d.n !== "number" || typeof d.exp !== "number") return null;
    if (d.exp * 1000 < agora) return null;
    return d;
  } catch {
    return null;
  }
}

/** Nomes fictícios para o "perfil do WhatsApp" de quem testa o simulador. */
const NOMES = ["Ana", "Bruno", "Camila", "Diego", "Elisa", "Felipe", "Gabriela", "Heitor", "Isabela", "João", "Larissa", "Marcos", "Natália", "Otávio", "Paula", "Rafael"];

/** Persona aleatória: nome com "(simulador)" para ficar claro no CRM e celular fictício de São Paulo. */
export function novaPersona(): { id: string; nome: string; tel: string } {
  const nome = `${NOMES[randomInt(NOMES.length)]} (simulador)`;
  const tel = `1190${String(randomInt(10_000_000)).padStart(7, "0")}`;
  return { id: randomUUID(), nome, tel };
}

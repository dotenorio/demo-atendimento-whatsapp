/**
 * Variáveis de ambiente (ver .env.example). Só para o servidor.
 */
import "server-only";
import { MODELO_PADRAO } from "./motor/ia";

const producao = process.env.NODE_ENV === "production";

const inteiro = (nome: string, padrao: number) => {
  const n = Number(process.env[nome]);
  return Number.isInteger(n) && n > 0 ? n : padrao;
};

/** IA ligada só quando há chave. Sem ela, o robô usa o roteiro de exemplo. */
export function configIa(): { chave: string; modelo: string } | null {
  const chave = process.env.ANTHROPIC_API_KEY;
  if (!chave) return null;
  return { chave, modelo: process.env.CLAUDE_MODELO || MODELO_PADRAO };
}

/** Limites para a demo pública não gerar custo. */
export const limites = {
  /** Mensagens do visitante por conversa no simulador. */
  porConversa: inteiro("LIMITE_MENSAGENS_CONVERSA", 15),
  /** Mensagens por IP por dia, somando todas as conversas. */
  porIpDia: inteiro("LIMITE_MENSAGENS_IP_DIA", 40),
  /** Respostas com IA por dia (em cada servidor). Depois disso, o roteiro responde. */
  iaPorDia: inteiro("LIMITE_IA_DIA", 300),
  /** Tamanho máximo de cada mensagem. */
  caracteres: 500,
  /** Quantas mensagens anteriores vão para a IA como contexto. */
  historico: 12,
};

/** Simulador na tela: ligado por padrão (é a demo). Num cliente real, só o webhook do WhatsApp fica no ar. */
export const simuladorLigado = () => process.env.SIMULADOR !== "false";

export function segredoConversa(): string {
  const s = process.env.CONVERSA_SEGREDO;
  if (s && s.length >= 32) return s;
  if (producao) throw new Error("Defina CONVERSA_SEGREDO com pelo menos 32 caracteres.");
  return "segredo-de-desenvolvimento-nao-use-em-producao!!";
}

/** API do mini CRM (demo 2). Sem ela, o robô responde mas não grava nada. */
export function configCrm(): { url: string; chave: string; painel: string } | null {
  const url = process.env.CRM_API_URL?.replace(/\/+$/, "");
  const chave = process.env.CRM_API_CHAVE;
  if (!url || !chave) return null;
  return { url, chave, painel: (process.env.CRM_PAINEL_URL || url).replace(/\/+$/, "") };
}

/** WhatsApp Cloud API (Meta). Tudo opcional: sem isso, o webhook responde 503. */
export function configWhatsapp() {
  const e = process.env;
  if (!e.WHATSAPP_VERIFY_TOKEN || !e.WHATSAPP_APP_SECRET || !e.WHATSAPP_TOKEN || !e.WHATSAPP_PHONE_NUMBER_ID) return null;
  return {
    tokenVerificacao: e.WHATSAPP_VERIFY_TOKEN,
    segredoApp: e.WHATSAPP_APP_SECRET,
    token: e.WHATSAPP_TOKEN,
    numeroId: e.WHATSAPP_PHONE_NUMBER_ID,
    versaoGraph: e.WHATSAPP_GRAPH_VERSAO || "v23.0",
  };
}

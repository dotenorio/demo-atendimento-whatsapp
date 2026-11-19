/**
 * Escolhe quem responde: a IA (se houver chave e ainda houver cota no dia) ou o roteiro sem IA.
 * Usado tanto pelo simulador quanto pelo webhook do WhatsApp.
 */
import "server-only";
import { configIa, limites } from "../ambiente";
import { ContadorDiario } from "../limitador";
import type { ConfiguracaoAtendimento, Mensagem, Resposta } from "../tipos";
import { responderComIa } from "./ia";
import { responderComRoteiro } from "./roteiro";

const cotaIa = new ContadorDiario(limites.iaPorDia);

export async function responder(
  config: ConfiguracaoAtendimento,
  historico: Mensagem[],
  mensagem: string,
  nomePaciente?: string,
): Promise<Resposta> {
  const recente = historico.slice(-limites.historico);
  const ia = configIa();
  if (ia && cotaIa.usar("global")) {
    const r = await responderComIa(config, recente, mensagem, { ...ia, nomePaciente });
    if (r) return r;
  }
  return responderComRoteiro(config, recente, mensagem, nomePaciente);
}

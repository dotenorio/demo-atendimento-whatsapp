/** Ajudantes de texto usados no navegador e no servidor (sem dependências). */
import type { ConfiguracaoAtendimento, Periodo, Servico } from "./tipos";

/** Tira acentos, caixa e espaços repetidos: "Avaliação  AMANHÃ" → "avaliacao amanha". */
export function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * O texto (já normalizado) contém a palavra?
 * Palavras de até 3 letras precisam aparecer inteiras ("oi" não casa com "noite");
 * as maiores casam pelo começo ("sangr" casa com "sangrando").
 */
export function contem(textoNormalizado: string, palavra: string): boolean {
  const p = escapar(normalizar(palavra));
  const re = palavra.length <= 3 ? new RegExp(`(^|[^a-z0-9])${p}($|[^a-z0-9])`) : new RegExp(`(^|[^a-z0-9])${p}`);
  return re.test(textoNormalizado);
}

export const contemAlguma = (textoNormalizado: string, palavras: string[]) => palavras.some((p) => contem(textoNormalizado, p));

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
export const reais = (valor: number) => BRL.format(valor).replace(/ /g, " ");

export function acharServico(config: ConfiguracaoAtendimento, textoNormalizado: string): Servico | undefined {
  return config.servicos.find((s) => contemAlguma(textoNormalizado, [s.nome, ...s.palavras]));
}

export function acharPeriodo(config: ConfiguracaoAtendimento, textoNormalizado: string): Periodo | undefined {
  return config.periodos.find((p) => contemAlguma(textoNormalizado, [p.rotulo, ...p.palavras]));
}

export const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0] ?? "";

/** "Ana", "Bia" → "Ana" ; "" → "" (para não escrever "Olá, !") */
export const saudacaoNome = (nome?: string) => {
  const n = nome ? primeiroNome(nome.replace(/\(.*?\)/g, "")) : "";
  return n ? `, ${n}` : "";
};

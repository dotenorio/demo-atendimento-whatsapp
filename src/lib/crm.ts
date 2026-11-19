/**
 * Integração com o mini CRM (demo 2) pela API dele (/api/v1, chave no cabeçalho).
 *
 * A cada mensagem: cria o contato (ou acha pelo telefone) e registra a conversa no histórico.
 * Quando o paciente pede a avaliação, registra o pedido e move o contato para a etapa configurada.
 * Se o CRM estiver fora do ar, o atendimento continua: a falha só aparece no painel e no log.
 */
import type { ConfiguracaoAtendimento, Mensagem, Resposta } from "./tipos";

export interface ConfigCrm {
  url: string;
  chave: string;
  /** Endereço das telas do CRM, para montar o link do contato. */
  painel: string;
}

/** O que aconteceu no CRM, para mostrar no painel do simulador. */
export interface EventoCrm {
  tipo: "contato_criado" | "contato_encontrado" | "conversa_registrada" | "etapa_movida" | "equipe_avisada" | "crm_desligado" | "erro";
  texto: string;
}

export interface ResultadoCrm {
  contatoId?: string;
  link?: string;
  eventos: EventoCrm[];
}

type Fetch = typeof fetch;

class ErroCrm extends Error {}

async function chamar<T>(crm: ConfigCrm, caminho: string, init: { method?: string; corpo?: unknown }, f: Fetch): Promise<T> {
  let r: Response;
  try {
    r = await f(`${crm.url}${caminho}`, {
      method: init.method ?? "GET",
      headers: { Authorization: `Bearer ${crm.chave}`, "Content-Type": "application/json" },
      body: init.corpo === undefined ? undefined : JSON.stringify(init.corpo),
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
  } catch {
    throw new ErroCrm("O CRM não respondeu.");
  }
  const json = (await r.json().catch(() => ({}))) as T & { mensagem?: string };
  if (!r.ok) throw new ErroCrm(json.mensagem ?? `O CRM respondeu ${r.status}.`);
  return json;
}

/** Texto de uma troca de mensagens no histórico do CRM. O webhook lê este formato de volta. */
export function textoDaTroca(config: ConfiguracaoAtendimento, paciente: string, robo: string): string {
  return `Paciente: ${paciente}\n${config.atendente.nome} (robô): ${robo}`;
}

/** Lê o formato acima de volta para mensagens (usado pelo webhook para lembrar a conversa). */
export function trocaParaMensagens(config: ConfiguracaoAtendimento, texto: string): Mensagem[] {
  const separador = `\n${config.atendente.nome} (robô): `;
  if (!texto.startsWith("Paciente: ") || !texto.includes(separador)) return [];
  const i = texto.indexOf(separador);
  return [
    { de: "paciente", texto: texto.slice("Paciente: ".length, i) },
    { de: "robo", texto: texto.slice(i + separador.length) },
  ];
}

function textoAgendamento(config: ConfiguracaoAtendimento, resposta: Resposta): string {
  const servico = config.servicos.find((s) => s.id === resposta.tratamento);
  const periodo = config.periodos.find((p) => p.id === resposta.periodo);
  return [
    `🗓️ Pediu ${config.avaliacao.nome} pelo WhatsApp (robô).`,
    servico ? `Tratamento: ${servico.nome}.` : "",
    `Período: ${periodo ? periodo.rotulo : "qualquer"}.`,
    "Falta a recepção confirmar dia e horário.",
  ]
    .filter(Boolean)
    .join(" ");
}

interface ContatoApi {
  id: string;
  nome: string;
  etapaId: string;
}

/**
 * Registra uma troca de mensagens no CRM.
 * `contatoId` vem da conversa (simulador) quando o contato já foi criado antes.
 */
export async function registrarNoCrm(
  crm: ConfigCrm | null,
  config: ConfiguracaoAtendimento,
  dados: { telefone: string; nome: string; contatoId?: string; mensagem: string; resposta: Resposta },
  f: Fetch = fetch,
): Promise<ResultadoCrm> {
  if (!crm) return { eventos: [{ tipo: "crm_desligado", texto: "CRM não configurado: a conversa não foi gravada (veja CRM_API_URL no README)." }] };

  const eventos: EventoCrm[] = [];
  const troca = { tipo: config.crm.tipoInteracao, texto: textoDaTroca(config, dados.mensagem, dados.resposta.texto) };
  let contatoId = dados.contatoId;

  try {
    if (!contatoId) {
      const extras: Record<string, string> = {};
      if (dados.resposta.tratamento) extras.tratamento = dados.resposta.tratamento;
      const r = await chamar<{ criado: boolean; contato: ContatoApi }>(
        crm,
        "/api/v1/contatos",
        { method: "POST", corpo: { nome: dados.nome, telefone: dados.telefone, origem: config.crm.origem, extras, interacao: troca } },
        f,
      );
      contatoId = r.contato.id;
      eventos.push(
        r.criado
          ? { tipo: "contato_criado", texto: `Contato “${r.contato.nome}” criado no funil.` }
          : { tipo: "contato_encontrado", texto: `Contato “${r.contato.nome}” já existia; conversa somada ao histórico.` },
      );
      // A API grava a interação tanto no contato novo quanto no que já existia
      eventos.push({ tipo: "conversa_registrada", texto: "Mensagem e resposta registradas no histórico." });
    } else {
      await chamar(crm, `/api/v1/contatos/${encodeURIComponent(contatoId)}/interacoes`, { method: "POST", corpo: troca }, f);
      eventos.push({ tipo: "conversa_registrada", texto: "Mensagem e resposta registradas no histórico." });
    }

    if (dados.resposta.acao === "agendar_avaliacao") {
      await chamar(
        crm,
        `/api/v1/contatos/${encodeURIComponent(contatoId)}/interacoes`,
        { method: "POST", corpo: { tipo: config.crm.tipoInteracao, texto: textoAgendamento(config, dados.resposta), etapaId: config.crm.etapaAgendado } },
        f,
      );
      eventos.push({ tipo: "etapa_movida", texto: "Pedido de avaliação registrado e contato movido para “Avaliação agendada”." });
    } else if (dados.resposta.acao === "falar_com_equipe") {
      await chamar(
        crm,
        `/api/v1/contatos/${encodeURIComponent(contatoId)}/interacoes`,
        { method: "POST", corpo: { tipo: "anotacao", texto: "⚠️ O robô passou a conversa para a equipe. Responder o paciente pelo WhatsApp." } },
        f,
      );
      eventos.push({ tipo: "equipe_avisada", texto: "Anotação para a equipe responder o paciente." });
    }
  } catch (e) {
    const motivo = e instanceof ErroCrm ? e.message : "Erro inesperado.";
    if (!(e instanceof ErroCrm)) console.error("CRM: falha ao registrar", e);
    eventos.push({ tipo: "erro", texto: `Não deu para gravar no CRM: ${motivo} O atendimento continua normalmente.` });
  }

  return { contatoId, link: contatoId ? `${crm.painel}/contatos/${encodeURIComponent(contatoId)}` : undefined, eventos };
}

/**
 * Últimas mensagens de um telefone, lidas do histórico do CRM (o webhook não tem banco próprio).
 * Devolve também o id do contato, se existir.
 */
export async function historicoDoCrm(
  crm: ConfigCrm | null,
  config: ConfiguracaoAtendimento,
  telefone: string,
  limite: number,
  f: Fetch = fetch,
): Promise<{ contatoId?: string; mensagens: Mensagem[] }> {
  if (!crm) return { mensagens: [] };
  try {
    const { contatos } = await chamar<{ contatos: ContatoApi[] }>(crm, `/api/v1/contatos?telefone=${encodeURIComponent(telefone)}`, {}, f);
    const contato = contatos[0];
    if (!contato) return { mensagens: [] };
    const { interacoes } = await chamar<{ interacoes: { tipo: string; texto: string; quando: string }[] }>(
      crm,
      `/api/v1/contatos/${encodeURIComponent(contato.id)}`,
      {},
      f,
    );
    const mensagens = interacoes
      .filter((i) => i.tipo === config.crm.tipoInteracao)
      .sort((a, b) => a.quando.localeCompare(b.quando))
      .flatMap((i) => trocaParaMensagens(config, i.texto));
    return { contatoId: contato.id, mensagens: mensagens.slice(-limite) };
  } catch (e) {
    console.error("CRM: falha ao ler o histórico", e instanceof Error ? e.message : e);
    return { mensagens: [] };
  }
}

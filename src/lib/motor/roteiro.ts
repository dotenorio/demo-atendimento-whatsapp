/**
 * Roteiro de respostas SEM inteligência artificial.
 *
 * Funciona sem chave nenhuma, com custo zero, e também é a rede de segurança do modo IA
 * (se a API do Claude falhar ou o limite diário acabar, o robô continua respondendo por aqui).
 * Tudo sai da configuração: preços, horários, endereço e perguntas frequentes.
 *
 * Não guarda estado: o passo da conversa é deduzido da última mensagem do robô.
 */
import { acharPeriodo, acharServico, contemAlguma, normalizar, reais, saudacaoNome } from "../texto";
import type { ConfiguracaoAtendimento, Mensagem, Resposta } from "../tipos";

/** Frases fixas do roteiro. Algumas servem para reconhecer em que passo a conversa está. */
export function frases(config: ConfiguracaoAtendimento) {
  const { avaliacao, periodos } = config;
  const listaPeriodos = periodos.map((p) => p.rotulo);
  const ultimo = listaPeriodos.pop();
  return {
    perguntaPeriodo: `Qual o melhor período para você: ${listaPeriodos.join(", ")} ou ${ultimo}?`,
    oferta: `Quer agendar uma ${avaliacao.nome} gratuita?`,
    equipe: "Vou passar sua mensagem para a nossa equipe, e uma pessoa te responde por aqui em instantes, tá bom?",
  };
}

const URGENCIA_OU_EQUIPE = [
  "dor forte", "com dor", "muita dor", "doendo", "inchad", "inchaco", "sangr", "urgencia", "urgente", "quebrou",
  "remarcar", "desmarcar", "cancelar", "reclama", "reembolso", "nota fiscal", "recibo", "prontuario",
  "atendente", "humano", "falar com alguem", "falar com uma pessoa",
];
const AGENDAR_SEMPRE = ["agendar", "agendamento", "marcar", "marca", "vaga", "encaixe"];
/** Só contam como pedido de agendamento se a pessoa não estiver perguntando preço ou horário. */
const AGENDAR = ["avaliacao", "consulta"];
const PRECO = ["quanto", "preco", "valor", "custa", "orcamento", "caro", "barato"];
const PAGAMENTO = ["convenio", "plano", "pix", "cartao", "parcel", "pagamento", "pagar", "boleto", "dinheiro"];
const HORARIO = ["horario", "abre", "abrem", "fecha", "fecham", "funciona", "sabado", "domingo", "feriado", "atendem"];
const ENDERECO = ["onde", "endereco", "localiza", "metro", "chegar", "rua", "bairro"];
const SERVICOS = ["servico", "tratamento", "fazem", "trabalham", "oferecem", "especialidade"];
const SAUDACAO = ["oi", "ola", "bom dia", "boa tarde", "boa noite", "tudo bem", "opa", "eai", "e ai"];
const AGRADECIMENTO = ["obrigad", "valeu", "brigad", "agradeco", "otimo", "perfeito", "show"];
const SIM = ["sim", "quero", "pode", "claro", "bora", "ok", "isso", "gostaria", "por favor", "pode ser", "s"];
const NAO = ["nao", "agora nao", "depois", "talvez", "vou pensar"];
const TANTO_FAZ = ["tanto faz", "qualquer", "qualquer um", "indiferente", "nao sei", "voces que sabem"];

export function responderComRoteiro(
  config: ConfiguracaoAtendimento,
  historico: Mensagem[],
  mensagem: string,
  nomePaciente?: string,
): Resposta {
  const f = frases(config);
  const m = normalizar(mensagem);
  const ultimoRobo = [...historico].reverse().find((x) => x.de === "robo")?.texto ?? "";
  // Tratamento citado agora ou antes na conversa (o mais recente vale)
  const textosPaciente = [...historico.filter((x) => x.de === "paciente").map((x) => x.texto), mensagem].map(normalizar);
  const servicoAgora = acharServico(config, m);
  const servicoConversa = servicoAgora ?? [...textosPaciente].reverse().map((t) => acharServico(config, t)).find(Boolean);
  // O tratamento citado vai junto em toda resposta: o CRM já preenche o "tratamento de interesse"
  const resposta = (texto: string, extra: Partial<Resposta> = {}): Resposta => ({
    texto,
    acao: "nenhuma",
    origem: "roteiro",
    tratamento: servicoConversa?.id,
    ...extra,
  });

  // 1) Urgência e assuntos da equipe vêm antes de tudo
  if (contemAlguma(m, URGENCIA_OU_EQUIPE)) {
    const urgente = contemAlguma(m, ["dor forte", "com dor", "muita dor", "doendo", "inchad", "inchaco", "sangr", "urgen", "quebrou"]);
    const texto = urgente
      ? `Sinto muito que você esteja passando por isso. Vou avisar agora a nossa equipe para encaixar você o quanto antes. Se a dor for muito forte ou houver febre, procure um pronto-socorro.`
      : f.equipe;
    return resposta(texto, { acao: "falar_com_equipe" });
  }

  // 2) Resposta à pergunta do período → pré-agendamento
  if (ultimoRobo.includes(f.perguntaPeriodo)) {
    const periodo = acharPeriodo(config, m);
    if (periodo || contemAlguma(m, TANTO_FAZ)) {
      const servico = servicoConversa;
      const para = servico ? ` para ${servico.nome.toLowerCase()}` : "";
      const quando = periodo ? `, de preferência ${periodo.quando}` : "";
      return resposta(
        `Prontinho${saudacaoNome(nomePaciente)}! Anotei seu pedido de ${config.avaliacao.nome} gratuita${para}${quando}. ` +
          `A recepção vai te mandar por aqui as opções de dia e horário para confirmar. 😊`,
        { acao: "agendar_avaliacao", tratamento: servico?.id, periodo: periodo?.id },
      );
    }
  }

  // 3) Quer agendar (ou disse "sim" para a oferta)
  const aceitouOferta = ultimoRobo.includes(f.oferta) && contemAlguma(m, SIM) && !contemAlguma(m, NAO);
  const querAgendar =
    contemAlguma(m, AGENDAR_SEMPRE) || (contemAlguma(m, AGENDAR) && !contemAlguma(m, PRECO) && !contemAlguma(m, HORARIO));
  if (querAgendar || aceitouOferta) {
    const sobre = servicoConversa ? ` A ${config.avaliacao.nome} é gratuita e o dentista já vê o seu caso de ${servicoConversa.nome.toLowerCase()}.` : ` A ${config.avaliacao.nome} é gratuita e dura uns 30 minutos.`;
    return resposta(`Claro!${sobre} ${f.perguntaPeriodo}`);
  }
  if (ultimoRobo.includes(f.oferta) && contemAlguma(m, NAO)) {
    return resposta("Sem problema! Se surgir qualquer dúvida, é só chamar por aqui. 😉");
  }

  // 4) Preço
  if (contemAlguma(m, PRECO)) {
    if (servicoAgora) return resposta(textoServico(servicoAgora, config));
    if (contemAlguma(m, ["avaliacao", "consulta"])) return resposta(`A ${config.avaliacao.nome} é gratuita! ${f.oferta}`);
    return resposta(`Nossos valores começam em: ${tabelaPrecos(config)}. O valor exato sai na ${config.avaliacao.nome}, que é gratuita. ${f.oferta}`);
  }

  // 5) Pagamento e convênio
  if (contemAlguma(m, PAGAMENTO)) return resposta(`Aceitamos ${minuscula(config.negocio.pagamento)}`);

  // 6) Horário e endereço
  if (contemAlguma(m, HORARIO)) return resposta(`Atendemos ${config.negocio.horarios}. ${f.oferta}`);
  if (contemAlguma(m, ENDERECO)) return resposta(`Ficamos na ${config.negocio.endereco}.`);

  // 7) Perguntas frequentes
  const faq = config.perguntasFrequentes.find((p) => contemAlguma(m, p.palavras));
  if (faq) return resposta(faq.resposta);

  // 8) Falou de um serviço sem perguntar o preço
  if (servicoAgora) return resposta(textoServico(servicoAgora, config));
  if (contemAlguma(m, SERVICOS)) {
    return resposta(`Fazemos ${config.servicos.map((s) => s.nome.toLowerCase()).join(", ")}. Sobre qual você quer saber mais?`);
  }

  // 9) Conversa
  if (contemAlguma(m, AGRADECIMENTO)) return resposta("Imagina! Qualquer coisa, é só chamar. 😊");
  if (contemAlguma(m, SAUDACAO) && m.length <= 40) {
    return resposta(
      `Olá${saudacaoNome(nomePaciente)}! Aqui é a ${config.atendente.nome}, da ${config.negocio.nome}. 😊 ` +
        `Posso te ajudar com preços, horários, endereço ou agendar uma ${config.avaliacao.nome} gratuita. O que você precisa?`,
    );
  }

  return resposta(
    `Desculpe, não entendi bem. Posso te ajudar com preços, horários, endereço ou agendar uma ${config.avaliacao.nome} gratuita. ` +
      `Se preferir, escreva "falar com atendente" que alguém da equipe te responde.`,
  );
}

function textoServico(s: ConfiguracaoAtendimento["servicos"][number], config: ConfiguracaoAtendimento): string {
  const preco = s.precoAPartirDe ? ` a partir de ${reais(s.precoAPartirDe)}` : "";
  return `${s.nome}${preco} (${s.descricao}). O valor exato depende do seu caso e sai na ${config.avaliacao.nome}, que é gratuita. ${frases(config).oferta}`;
}

function tabelaPrecos(config: ConfiguracaoAtendimento): string {
  return config.servicos
    .filter((s) => s.precoAPartirDe)
    .map((s) => `${s.nome.toLowerCase()} ${reais(s.precoAPartirDe!)}`)
    .join("; ");
}

const minuscula = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

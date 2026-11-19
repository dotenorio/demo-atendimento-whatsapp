/**
 * ESTE É O ÚNICO ARQUIVO QUE VOCÊ PRECISA TROCAR PARA OUTRO CLIENTE.
 *
 * Aqui ficam os dados do negócio, os serviços com preço "a partir de", os horários,
 * as perguntas frequentes e o que o robô deve passar para a equipe.
 * A IA e o roteiro sem IA usam as mesmas informações, então o robô não inventa preço nem serviço.
 *
 * Dicas:
 *  - `palavras` são usadas pelo roteiro sem IA: escreva sem acento e em minúsculas.
 *  - O `id` dos serviços e dos períodos é o mesmo valor usado nos campos do CRM.
 *
 * ATENÇÃO: o negócio abaixo é FICTÍCIO. É só uma demonstração.
 */
import type { ConfiguracaoAtendimento } from "@/lib/tipos";

export const configuracao: ConfiguracaoAtendimento = {
  negocio: {
    nome: "Sorriso Claro Odontologia",
    subtitulo: "Clínica fictícia · São Paulo/SP",
    corPrimaria: "#0f766e",
    fusoHorario: "America/Sao_Paulo",
    endereco: "Rua das Flores, 123, sala 45, Vila Exemplo, São Paulo/SP (perto do metrô)",
    horarios: "segunda a sexta, das 8h às 20h, e sábado, das 8h às 13h",
    pagamento: "Pix, cartão de débito e crédito (tratamentos em até 12x sem juros no cartão). Não atendemos convênio.",
  },

  demonstracao: {
    texto: "Demonstração com clínica e dados fictícios. Não digite dados reais.",
    link: {
      texto: "Ver o código no GitHub",
      url: "https://github.com/dotenorio/demo-atendimento-whatsapp",
    },
  },

  atendente: {
    nome: "Clara",
    estilo:
      "Simpática, direta e acolhedora, como uma boa recepcionista. Mensagens curtas, no estilo WhatsApp (no máximo 3 frases), " +
      "sem markdown nem listas longas. Pode usar no máximo um emoji por mensagem. Trate o paciente por \"você\".",
  },

  avaliacao: {
    nome: "avaliação",
    descricao: "consulta de avaliação gratuita, de uns 30 minutos, com o dentista, que examina e passa o orçamento do tratamento",
  },

  servicos: [
    {
      id: "implante",
      nome: "Implante dentário",
      precoAPartirDe: 2900,
      descricao: "repõe o dente perdido com um pino de titânio e uma coroa",
      palavras: ["implante", "implantes", "pino", "dente perdido", "perdi um dente", "perdi o dente"],
    },
    {
      id: "ortodontia",
      nome: "Aparelho (ortodontia)",
      precoAPartirDe: 180,
      descricao: "aparelho fixo ou alinhador transparente; o valor é a manutenção mensal do aparelho fixo",
      palavras: ["aparelho", "ortodontia", "alinhador", "invisalign", "dente torto", "dentes tortos"],
    },
    {
      id: "clareamento",
      nome: "Clareamento",
      precoAPartirDe: 690,
      descricao: "feito no consultório e completado em casa, com moldeira",
      palavras: ["clareamento", "clarear", "branquear", "dente amarelo", "dentes amarelos", "mais branco"],
    },
    {
      id: "lentes",
      nome: "Lentes de contato dental",
      precoAPartirDe: 1200,
      descricao: "lâminas de porcelana coladas na frente do dente; o valor é por dente",
      palavras: ["lente", "lentes", "faceta", "facetas", "porcelana"],
    },
    {
      id: "checkup",
      nome: "Limpeza e check-up",
      precoAPartirDe: 180,
      descricao: "limpeza com raspagem, polimento e aplicação de flúor",
      palavras: ["limpeza", "check-up", "checkup", "tartaro", "profilaxia", "revisao"],
    },
  ],

  periodos: [
    { id: "manha", rotulo: "manhã", quando: "de manhã", palavras: ["manha", "cedo", "de manha"] },
    { id: "tarde", rotulo: "tarde", quando: "à tarde", palavras: ["tarde", "almoco", "depois do almoco"] },
    { id: "noite", rotulo: "noite", quando: "à noite", palavras: ["noite", "depois das 18", "fim do dia", "depois do trabalho"] },
  ],

  perguntasFrequentes: [
    {
      palavras: ["doi", "dor", "anestesia", "medo"],
      resposta:
        "A gente trabalha com anestesia e no seu ritmo, tá? Muita gente chega com medo e sai tranquila. Na avaliação o dentista explica cada passo antes de começar.",
    },
    {
      palavras: ["estacionamento", "estacionar", "carro"],
      resposta: "Temos convênio com o estacionamento do prédio ao lado: as 2 primeiras horas saem por conta da clínica.",
    },
    {
      palavras: ["crianca", "filho", "filha", "infantil", "odontopediatra"],
      resposta: "Atendemos crianças a partir de 3 anos com odontopediatra. Dá para marcar a avaliação dela junto com a sua.",
    },
  ],

  encaminharParaEquipe: [
    "dor forte, inchaço, sangramento ou qualquer urgência",
    "remarcar ou cancelar uma consulta já marcada",
    "reclamação, problema com tratamento já feito ou pedido de reembolso",
    "pedido de nota fiscal, recibo ou dados do prontuário",
  ],

  sugestoes: ["Quanto custa o clareamento?", "Qual o horário de vocês?", "Aceitam convênio?", "Quero agendar uma avaliação"],

  crm: {
    etapaAgendado: "avaliacao",
    origem: "whatsapp",
    tipoInteracao: "whatsapp",
  },
};

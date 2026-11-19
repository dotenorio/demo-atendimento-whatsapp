/**
 * Tipos do atendimento. A configuração (src/config/atendimento.ts) segue `ConfiguracaoAtendimento`.
 */

export interface Servico {
  /** Igual ao valor da opção "tratamento" no CRM, para preencher o funil com o mesmo nome. */
  id: string;
  nome: string;
  /** Em reais. Mostrado como "a partir de R$ …". Sem ele, o robô diz que o preço sai na avaliação. */
  precoAPartirDe?: number;
  descricao: string;
  /** Palavras que o paciente costuma usar para esse serviço (sem acento, minúsculas). */
  palavras: string[];
}

export interface Periodo {
  id: string;
  rotulo: string;
  /** Como aparece na frase de confirmação: "de manhã", "à tarde". */
  quando: string;
  /** Palavras que indicam esse período na resposta do paciente. */
  palavras: string[];
}

export interface PerguntaFrequente {
  /** Palavras que disparam a resposta no modo roteiro (sem acento, minúsculas). */
  palavras: string[];
  resposta: string;
}

export interface ConfiguracaoAtendimento {
  negocio: {
    nome: string;
    subtitulo: string;
    corPrimaria: string;
    fusoHorario: string;
    endereco: string;
    /** Texto livre, do jeito que a recepção falaria. */
    horarios: string;
    pagamento: string;
  };
  /** Apague este bloco num cliente real: some a faixa de aviso. */
  demonstracao?: {
    texto: string;
    link?: { texto: string; url: string };
  };
  atendente: {
    /** Nome do robô na conversa. */
    nome: string;
    /** Instruções de tom e limites, em linguagem natural (vão para a IA). */
    estilo: string;
  };
  avaliacao: {
    /** Como a clínica chama a primeira consulta. */
    nome: string;
    descricao: string;
  };
  servicos: Servico[];
  periodos: Periodo[];
  perguntasFrequentes: PerguntaFrequente[];
  /** Assuntos que o robô não responde e passa para a equipe (o modo IA também segue isso). */
  encaminharParaEquipe: string[];
  /** Botões de sugestão no simulador. */
  sugestoes: string[];
  crm: {
    /** Etapa do funil para onde o contato vai quando agenda a avaliação. */
    etapaAgendado: string;
    /** Origem e tipo de registro usados no CRM. */
    origem: string;
    tipoInteracao: string;
  };
}

/** Uma mensagem da conversa, do ponto de vista do negócio. */
export interface Mensagem {
  de: "paciente" | "robo";
  texto: string;
}

export type Acao = "nenhuma" | "agendar_avaliacao" | "falar_com_equipe";

export interface Resposta {
  texto: string;
  acao: Acao;
  /** Preenchidos quando a ação é agendar. */
  tratamento?: string;
  periodo?: string;
  /** "ia" quando a resposta veio do Claude; "roteiro" quando veio das regras. */
  origem: "ia" | "roteiro";
}

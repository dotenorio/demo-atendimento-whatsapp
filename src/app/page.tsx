import { notFound } from "next/navigation";
import { configuracao } from "@/config/atendimento";
import { configCrm, configIa, limites, simuladorLigado } from "@/lib/ambiente";
import { Simulador } from "./Simulador";

// Lê variáveis de ambiente a cada acesso (modo IA ligado ou não)
export const dynamic = "force-dynamic";

export default function Inicio() {
  if (!simuladorLigado()) notFound();
  const ia = configIa();
  const crm = configCrm();
  const { negocio, atendente } = configuracao;

  return (
    <main className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-[minmax(0,1fr)] gap-8 px-4 py-6 sm:py-10 lg:grid-cols-[minmax(0,1fr)_400px_minmax(0,1fr)] lg:items-start">
      <section className="lg:pt-6">
        <p className="text-sm font-semibold uppercase tracking-wider text-marca">{negocio.nome}</p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Atendimento no WhatsApp com IA, ligado ao CRM</h1>
        <p className="mt-3 text-stone-600">
          Converse com a {atendente.nome}, a atendente virtual da clínica, como se você fosse um paciente. Ela tira dúvidas sobre
          tratamentos, preços, horários e pagamento, e pré-agenda a avaliação.
        </p>
        <p className="mt-3 text-stone-600">
          Cada mensagem cria ou atualiza o contato no <strong>mini CRM</strong>; quem pede avaliação vai sozinho para a coluna
          “Avaliação agendada” do funil.
        </p>
        <ul className="mt-4 space-y-1.5 text-sm text-stone-600">
          <li>
            <span className="font-medium text-stone-800">Respostas:</span>{" "}
            {ia ? "IA (API do Claude), com as informações da clínica" : "roteiro de exemplo, sem IA (nenhuma chave configurada)"}
          </li>
          <li>
            <span className="font-medium text-stone-800">CRM:</span> {crm ? "ligado (gravando de verdade)" : "desligado nesta instalação"}
          </li>
          <li>
            <span className="font-medium text-stone-800">Limite da demo:</span> {limites.porConversa} mensagens por conversa
          </li>
        </ul>
      </section>

      <Simulador
        negocio={{ nome: negocio.nome, cor: negocio.corPrimaria }}
        atendente={atendente.nome}
        sugestoes={configuracao.sugestoes}
        maxCaracteres={limites.caracteres}
        crmLigado={Boolean(crm)}
        crmPainel={crm?.painel}
      />
    </main>
  );
}

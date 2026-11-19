"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { EventoCrm } from "@/lib/crm";
import type { Mensagem, Resposta } from "@/lib/tipos";

interface Props {
  negocio: { nome: string; cor: string };
  atendente: string;
  sugestoes: string[];
  maxCaracteres: number;
  crmLigado: boolean;
  crmPainel?: string;
}

interface Balao extends Mensagem {
  id: number;
  hora: string;
  origem?: Resposta["origem"];
}

interface GrupoEventos {
  id: number;
  hora: string;
  mensagem: string;
  eventos: EventoCrm[];
}

const horaAgora = () => new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
let proximoId = 1;

const COR_EVENTO: Record<EventoCrm["tipo"], string> = {
  contato_criado: "bg-emerald-500",
  contato_encontrado: "bg-sky-500",
  conversa_registrada: "bg-stone-400",
  etapa_movida: "bg-violet-500",
  equipe_avisada: "bg-amber-500",
  crm_desligado: "bg-stone-300",
  erro: "bg-red-500",
};

export function Simulador({ negocio, atendente, sugestoes, maxCaracteres, crmLigado, crmPainel }: Props) {
  const [ficha, setFicha] = useState<string>();
  const [persona, setPersona] = useState<{ nome: string; tel: string }>();
  const [baloes, setBaloes] = useState<Balao[]>([]);
  const [grupos, setGrupos] = useState<GrupoEventos[]>([]);
  const [linkContato, setLinkContato] = useState<string>();
  const [texto, setTexto] = useState("");
  const [digitando, setDigitando] = useState(false);
  const [restantes, setRestantes] = useState<number>();
  const [aviso, setAviso] = useState<string>();
  const fimRef = useRef<HTMLDivElement>(null);
  const entradaRef = useRef<HTMLInputElement>(null);

  const comecar = useCallback(async () => {
    setBaloes([]);
    setGrupos([]);
    setLinkContato(undefined);
    setAviso(undefined);
    setFicha(undefined);
    try {
      const r = await fetch("/api/simulador", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.mensagem);
      setFicha(j.ficha);
      setPersona(j.persona);
      setRestantes(j.restantes);
    } catch {
      setAviso("Não deu para iniciar a conversa. Recarregue a página.");
    }
  }, []);

  useEffect(() => {
    // Inicia a conversa ao abrir a página (busca a ficha assinada no servidor)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void comecar();
  }, [comecar]);

  useEffect(() => {
    // Rola só a área da conversa (scrollIntoView rolaria a página inteira no celular)
    const fim = fimRef.current;
    const area = fim?.parentElement;
    if (area) area.scrollTo({ top: area.scrollHeight, behavior: "smooth" });
  }, [baloes, digitando]);

  async function enviar(mensagem: string) {
    const limpa = mensagem.trim().slice(0, maxCaracteres);
    if (!limpa || !ficha || digitando) return;
    const historico: Mensagem[] = baloes.map(({ de, texto }) => ({ de, texto }));
    setBaloes((b) => [...b, { id: proximoId++, de: "paciente", texto: limpa, hora: horaAgora() }]);
    setTexto("");
    setAviso(undefined);
    setDigitando(true);
    try {
      const r = await fetch("/api/simulador", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ficha, mensagem: limpa, historico }),
      });
      const j = await r.json();
      if (!r.ok) {
        setAviso(j.mensagem ?? "Algo deu errado. Tente de novo.");
        if (j.limite) setRestantes(0);
        return;
      }
      const resposta = j.resposta as Resposta;
      setBaloes((b) => [...b, { id: proximoId++, de: "robo", texto: resposta.texto, hora: horaAgora(), origem: resposta.origem }]);
      setGrupos((g) => [{ id: proximoId++, hora: horaAgora(), mensagem: limpa, eventos: j.crm.eventos }, ...g]);
      if (j.crm.link) setLinkContato(j.crm.link);
      setFicha(j.ficha);
      setRestantes(j.restantes);
    } catch {
      setAviso("Sem conexão com o servidor. Tente de novo.");
    } finally {
      setDigitando(false);
      entradaRef.current?.focus({ preventScroll: true });
    }
  }

  const esgotado = restantes === 0;
  const iniciais = negocio.nome
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("");

  return (
    <>
      {/* Celular */}
      <section aria-label="Simulador de WhatsApp" className="mx-auto w-full max-w-[400px]">
        <div className="flex h-[min(680px,78svh)] flex-col overflow-hidden rounded-[2rem] border-[6px] border-stone-900 bg-[#efeae2] shadow-xl">
          <header className="flex items-center gap-3 px-3 py-2.5 text-white" style={{ background: negocio.cor }}>
            <div className="grid size-10 shrink-0 place-items-center rounded-full bg-white/20 text-sm font-bold">{iniciais}</div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold leading-tight">{negocio.nome}</p>
              <p className="text-xs text-white/80" aria-live="polite">
                {digitando ? "digitando…" : "online"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void comecar()}
              className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold transition hover:bg-white/25"
            >
              Nova conversa
            </button>
          </header>

          <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3" role="log" aria-label="Conversa">
            <p className="mx-auto w-fit max-w-[90%] rounded-lg bg-[#fff5c4] px-3 py-1.5 text-center text-xs text-stone-700 shadow-sm">
              {persona ? (
                <>
                  Você é <strong>{persona.nome.replace(" (simulador)", "")}</strong>, um paciente fictício. Mande uma mensagem para a{" "}
                  {atendente}.
                </>
              ) : (
                "Preparando a conversa…"
              )}
            </p>
            {baloes.map((b) => (
              <div key={b.id} className={`flex ${b.de === "paciente" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-lg px-2.5 pt-1.5 pb-1 text-[15px] leading-snug text-stone-900 shadow-sm ${
                    b.de === "paciente" ? "rounded-tr-none bg-[#d9fdd3]" : "rounded-tl-none bg-white"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{b.texto}</p>
                  <p className="mt-0.5 flex items-center justify-end gap-1 text-[11px] text-stone-500">
                    {b.origem && <span title={b.origem === "ia" ? "Resposta da IA" : "Resposta do roteiro sem IA"}>{b.origem === "ia" ? "IA ·" : "roteiro ·"}</span>}
                    {b.hora}
                    {b.de === "paciente" && <span className="text-sky-500" aria-label="lida">✓✓</span>}
                  </p>
                </div>
              </div>
            ))}
            {digitando && (
              <div className="flex justify-start">
                <div className="rounded-lg rounded-tl-none bg-white px-3 py-2 shadow-sm" aria-label={`${atendente} está digitando`}>
                  <span className="inline-flex gap-1">
                    <span className="size-2 animate-bounce rounded-full bg-stone-400 [animation-delay:-0.3s]" />
                    <span className="size-2 animate-bounce rounded-full bg-stone-400 [animation-delay:-0.15s]" />
                    <span className="size-2 animate-bounce rounded-full bg-stone-400" />
                  </span>
                </div>
              </div>
            )}
            <div ref={fimRef} />
          </div>

          {aviso && <p className="bg-amber-50 px-3 py-2 text-sm text-amber-900" role="alert">{aviso}</p>}

          {!esgotado && (
            <div className="flex gap-2 overflow-x-auto px-2 pt-2 [scrollbar-width:none]">
              {sugestoes.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={digitando || !ficha}
                  onClick={() => void enviar(s)}
                  className="shrink-0 rounded-full border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 transition hover:bg-stone-50 disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <form
            className="flex items-center gap-2 p-2"
            onSubmit={(e) => {
              e.preventDefault();
              void enviar(texto);
            }}
          >
            <label htmlFor="mensagem" className="sr-only">
              Mensagem
            </label>
            <input
              id="mensagem"
              ref={entradaRef}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              maxLength={maxCaracteres}
              disabled={esgotado || !ficha}
              placeholder={esgotado ? "Limite da demonstração atingido" : "Mensagem"}
              autoComplete="off"
              enterKeyHint="send"
              className="min-w-0 flex-1 rounded-full border-0 bg-white px-4 py-2.5 text-base text-stone-900 shadow-sm outline-none placeholder:text-stone-400 focus:ring-2 focus:ring-marca/30"
            />
            <button
              type="submit"
              disabled={!texto.trim() || digitando || esgotado || !ficha}
              aria-label="Enviar"
              className="grid size-11 shrink-0 place-items-center rounded-full text-white shadow-sm transition disabled:opacity-50"
              style={{ background: negocio.cor }}
            >
              <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
                <path d="M3.4 20.4 21 12 3.4 3.6l-.01 6.53L15 12 3.39 13.87z" />
              </svg>
            </button>
          </form>
        </div>
        {restantes !== undefined && !esgotado && (
          <p className="mt-2 text-center text-xs text-stone-500">
            {restantes} {restantes === 1 ? "mensagem restante" : "mensagens restantes"} nesta conversa
          </p>
        )}
      </section>

      {/* O que aconteceu no CRM */}
      <section aria-label="O que aconteceu no CRM" className="lg:pt-6">
        <div className="cartao p-4 sm:p-5">
          <h2 className="font-semibold">O que aconteceu no CRM</h2>
          {persona && (
            <p className="mt-1 text-sm text-stone-600">
              Contato: <strong>{persona.nome}</strong> · {formatarTelefone(persona.tel)} (fictício)
            </p>
          )}

          {!crmLigado && (
            <p className="mt-3 rounded-lg bg-stone-100 p-3 text-sm text-stone-600">
              O CRM não está ligado nesta instalação. O robô responde normalmente, mas nada é gravado.
            </p>
          )}

          {grupos.length === 0 ? (
            crmLigado && <p className="mt-3 text-sm text-stone-500">Mande a primeira mensagem para ver o contato aparecer no funil do CRM.</p>
          ) : (
            <ol className="mt-4 space-y-4">
              {grupos.map((g) => (
                <li key={g.id}>
                  <p className="text-xs text-stone-500">
                    {g.hora} · “{g.mensagem.length > 60 ? `${g.mensagem.slice(0, 60)}…` : g.mensagem}”
                  </p>
                  <ul className="mt-1.5 space-y-1.5">
                    {g.eventos.map((e, i) => (
                      <li key={i} className="flex gap-2 text-sm">
                        <span className={`mt-1.5 size-2 shrink-0 rounded-full ${COR_EVENTO[e.tipo]}`} aria-hidden />
                        <span className={e.tipo === "etapa_movida" ? "font-semibold text-violet-800" : e.tipo === "erro" ? "text-red-700" : "text-stone-700"}>
                          {e.texto}
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          )}

          {linkContato && (
            <a href={linkContato} target="_blank" rel="noopener noreferrer" className="botao mt-5 w-full">
              Abrir o contato no CRM
            </a>
          )}
          {crmPainel && (
            <p className="mt-3 text-xs text-stone-500">
              O CRM pede login. Use o de demonstração: <code className="font-mono">recepcao@sorrisoclaro.exemplo</code> /{" "}
              <code className="font-mono">demo1234</code>.
            </p>
          )}
        </div>
      </section>
    </>
  );
}

function formatarTelefone(t: string) {
  return t.length === 11 ? `(${t.slice(0, 2)}) ${t.slice(2, 7)}-${t.slice(7)}` : t;
}

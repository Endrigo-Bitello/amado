'use client';

import { motion } from 'motion/react';
import {
    ArrowRight,
    Sprout,
    FlaskConical,
    Building2,
    ShieldCheck,
    FileText,
    Users,
    Boxes,
    Database,
    ClipboardCheck,
    TrendingUp,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    Target,
    Layers,
    Briefcase,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Palette (from PDF)                                                  */
/* ------------------------------------------------------------------ */
const GREEN = '#14432E';
const GREEN_DEEP = '#0E2E20';
const GOLD = '#B8945A';
const ORANGE = '#C77B3B';
const MIST = '#EAF1EC';
const CREAM = '#FBF7EE';

/* ------------------------------------------------------------------ */
/* Small primitives                                                    */
/* ------------------------------------------------------------------ */
const fadeUp = {
    hidden: { opacity: 0, y: 24 },
    show: { opacity: 1, y: 0 },
};

function Reveal({
    children,
    delay = 0,
    className,
}: {
    children: React.ReactNode;
    delay?: number;
    className?: string;
}) {
    return (
        <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay }}
            className={className}
        >
            {children}
        </motion.div>
    );
}

function Kicker({ children }: { children: React.ReactNode }) {
    return (
        <span
            className="inline-block rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]"
            style={{ background: GOLD, color: GREEN_DEEP }}
        >
            {children}
        </span>
    );
}

function SectionHeading({
    title,
    subtitle,
    light = false,
}: {
    title: string;
    subtitle?: string;
    light?: boolean;
}) {
    return (
        <div className="mb-10">
            <h2
                className="text-4xl font-bold tracking-tight sm:text-5xl"
                style={{ color: light ? '#fff' : GREEN }}
            >
                {title}
            </h2>
            {subtitle && (
                <p
                    className="mt-3 max-w-3xl text-base leading-relaxed sm:text-lg"
                    style={{ color: light ? 'rgba(255,255,255,0.72)' : '#5b6b60' }}
                >
                    {subtitle}
                </p>
            )}
        </div>
    );
}

function Disclaimer({ children }: { children: React.ReactNode }) {
    return (
        <p className="mx-auto mt-16 max-w-4xl text-center text-[11px] leading-relaxed text-neutral-400">
            {children}
        </p>
    );
}

/* ================================================================== */
/* PAGE                                                                */
/* ================================================================== */
export default function PitchCommodityPage() {
    return (
        <main className="min-h-dvh bg-white font-sans text-neutral-800 antialiased">
            <Greeting />
            <Hero />
            <Thesis />
            <Problem />
            <Solution />
            <Regulatory />
            <Market />
            <Capacity />
            <Economics />
            <GoToMarket />
            <Differentiators />
            <Risks />
            <ExecutionPlan />
            <UseOfFunds />
            <Conclusion />
            <Sources />
            <Footer />
        </main>
    );
}

/* ------------------------------------------------------------------ */
/* Greeting                                                            */
/* ------------------------------------------------------------------ */
function Greeting() {
    return (
        <section
            className="relative overflow-hidden px-6 pb-10 pt-12 sm:pt-16"
            style={{ background: GREEN_DEEP }}
        >
            <div className="mx-auto max-w-6xl">
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                >
                    <p className="text-sm font-medium tracking-wide text-white/60">
                        Olá,
                    </p>
                    <h1 className="mt-1 text-2xl font-bold text-white sm:text-3xl">
                        Marcos 👋
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/70">
                        Preparamos este material exclusivo para você. Um panorama completo
                        da tese de investimento da COMMODITY CBD — empresa-ponte entre
                        fazendas autorizadas e a indústria farmacêutica.
                    </p>
                </motion.div>
            </div>
        </section>
    );
}

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */
function ChainNode({
    title,
    desc,
    strong = false,
}: {
    title: string;
    desc: string;
    strong?: boolean;
}) {
    return (
        <div
            className="w-full min-w-[150px] rounded-xl border px-4 py-3 text-left sm:w-auto"
            style={{
                background: strong ? '#fff' : 'rgba(255,255,255,0.06)',
                borderColor: strong ? GOLD : 'rgba(255,255,255,0.15)',
            }}
        >
            <p
                className="text-sm font-bold"
                style={{ color: strong ? GREEN : '#fff' }}
            >
                {title}
            </p>
            <p
                className="mt-0.5 text-xs leading-snug"
                style={{ color: strong ? '#5b6b60' : 'rgba(255,255,255,0.6)' }}
            >
                {desc}
            </p>
        </div>
    );
}

function Hero() {
    return (
        <section
            className="relative overflow-hidden px-5 py-16 sm:px-6 sm:py-28"
            style={{ background: GREEN }}
        >
            <div className="relative mx-auto max-w-6xl">
                <Kicker>Investor Overview · Julho 2026</Kicker>
                <h1 className="mt-6 text-4xl font-black tracking-tight text-white sm:text-6xl">
                    COMMODITY CBD
                </h1>
                <p className="mt-3 max-w-2xl text-base text-white/80 sm:text-lg">
                    Empresa-ponte entre fazendas autorizadas e indústrias farmacêuticas.
                </p>
                <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/65">
                    Originação comercial, qualificação regulatória, estruturação de
                    LOIs/offtakes e inteligência de suprimentos para insumos medicinais de
                    Cannabis sativa L. de baixo THC.
                </p>

                {/* chain */}
                <div className="mt-12 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                    <ChainNode title="Fazendas" desc="capacidade produtiva" />
                    <ArrowRight className="mx-auto h-5 w-5 rotate-90 sm:mx-0 sm:rotate-0" style={{ color: GOLD }} />
                    <ChainNode
                        title="COMMODITY CBD"
                        desc="ponte comercial + compliance"
                        strong
                    />
                    <ArrowRight className="mx-auto h-5 w-5 rotate-90 sm:mx-0 sm:rotate-0" style={{ color: GOLD }} />
                    <ChainNode title="Farmacêuticas" desc="demanda regulada" />
                </div>

                <p className="mt-10 text-[11px] leading-relaxed text-white/45">
                    Documento ilustrativo, não constitui oferta pública de investimento
                    nem promessa de rentabilidade. Premissas sujeitas a validação técnica,
                    comercial e regulatória.
                </p>
            </div>
        </section>
    );
}

/* ------------------------------------------------------------------ */
/* Thesis                                                              */
/* ------------------------------------------------------------------ */
function Thesis() {
    const pillars = [
        'Regulação abriu a possibilidade de cultivo medicinal por pessoas jurídicas, sob AE, inspeção prévia, rastreabilidade e controle.',
        'A indústria precisa de insumos padronizados, com documentação técnica e fornecedores auditáveis.',
        'As fazendas precisam de LOIs, offtakes e contratos futuros para sustentar a estimativa produtiva.',
        'A COMMODITY CBD atua como ponte: origina demanda, estrutura documentos e reduz fricção regulatória.',
    ];
    return (
        <section className="px-5 py-14 sm:px-6 sm:py-20">
            <div className="mx-auto max-w-6xl">
                <Reveal>
                    <SectionHeading
                        title="Tese do negócio"
                        subtitle="O projeto não é apenas cultivo: é a camada comercial-regulatória que transforma capacidade agrícola em demanda farmacêutica documentada."
                    />
                </Reveal>

                <Reveal delay={0.05}>
                    <div
                        className="mb-12 rounded-2xl p-6"
                        style={{ background: MIST }}
                    >
                        <p
                            className="text-base font-semibold leading-relaxed"
                            style={{ color: GREEN }}
                        >
                            A oportunidade nasce de um desalinhamento: produtores querem ativar
                            capacidade, mas precisam de destino comercial qualificado;
                            farmacêuticas querem previsibilidade, qualidade, rastreabilidade e
                            segurança regulatória.
                        </p>
                    </div>
                </Reveal>

                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                    {pillars.map((p, i) => (
                        <Reveal key={i} delay={i * 0.06}>
                            <div className="h-full rounded-2xl border border-neutral-200 p-6">
                                <div
                                    className="mb-4 flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white"
                                    style={{ background: GREEN }}
                                >
                                    {i + 1}
                                </div>
                                <p className="text-base leading-relaxed text-neutral-600">{p}</p>
                            </div>
                        </Reveal>
                    ))}
                </div>

                <div className="mt-8 grid gap-6 lg:grid-cols-2">
                    <Reveal>
                        <div
                            className="h-full rounded-2xl p-6"
                            style={{ background: MIST }}
                        >
                            <h3 className="mb-4 text-lg font-bold" style={{ color: GREEN }}>
                                O que vendemos ao investidor
                            </h3>
                            <ul className="space-y-3 text-base text-neutral-700">
                                <li>
                                    <strong>Empresa asset-light:</strong> foco em venda B2B,
                                    contratos, inteligência comercial e governança.
                                </li>
                                <li>
                                    <strong>Pipeline de capacidade:</strong> 3 setups já
                                    comprometidos; expansão potencial até 12 setups mediante
                                    perspectiva comercial.
                                </li>
                                <li>
                                    <strong>Posição estratégica:</strong> entre cultivo, IFA,
                                    indústria farmacêutica e canal magistral.
                                </li>
                            </ul>
                        </div>
                    </Reveal>
                    <Reveal delay={0.08}>
                        <div className="h-full rounded-2xl border border-neutral-200 p-6">
                            <h3 className="mb-4 text-lg font-bold" style={{ color: GREEN }}>
                                O que não prometemos
                            </h3>
                            <ul className="space-y-3 text-base text-neutral-700">
                                <li className="flex gap-2">
                                    <XCircle
                                        className="mt-0.5 h-4 w-4 shrink-0"
                                        style={{ color: ORANGE }}
                                    />
                                    Não prometemos cultivo antes das autorizações e condições
                                    sanitárias.
                                </li>
                                <li className="flex gap-2">
                                    <XCircle
                                        className="mt-0.5 h-4 w-4 shrink-0"
                                        style={{ color: ORANGE }}
                                    />
                                    Não tratamos farmácia magistral como compradora direta da
                                    biomassa.
                                </li>
                                <li className="flex gap-2">
                                    <XCircle
                                        className="mt-0.5 h-4 w-4 shrink-0"
                                        style={{ color: ORANGE }}
                                    />
                                    Não assumimos que 72 t/ano serão absorvidas sem offtakes
                                    qualificados.
                                </li>
                            </ul>
                        </div>
                    </Reveal>
                </div>
            </div>
        </section>
    );
}

/* ------------------------------------------------------------------ */
/* Problem                                                             */
/* ------------------------------------------------------------------ */
function Problem() {
    const cols = [
        {
            title: 'Fazendas',
            items: [
                'Precisam comprovar destino comercial plausível.',
                'Dependem de especificações, compradores e autorizações.',
                'Risco de investir CAPEX antes de LOI/offtake.',
            ],
        },
        {
            title: 'Farmacêuticas',
            items: [
                'Buscam previsibilidade e controle de qualidade.',
                'Precisam de fornecedores rastreáveis e documentados.',
                'Querem reduzir exposição cambial e logística.',
            ],
        },
        {
            title: 'Regulador / mercado',
            items: [
                'Exige AE, inspeção, segurança e rastreabilidade.',
                'Material vegetal deve seguir destinatário legal adequado.',
                'Produtos irregulares aumentam o risco reputacional.',
            ],
        },
    ];
    return (
        <section className="px-5 py-14 sm:px-6 sm:py-20" style={{ background: '#FAFAF8' }}>
            <div className="mx-auto max-w-6xl">
                <Reveal>
                    <SectionHeading
                        title="O problema: cadeia nova, fragmentada e regulada"
                        subtitle="Sem a ponte comercial-regulatória, existe capacidade agrícola sem comprador qualificado e comprador farmacêutico sem origem nacional auditável."
                    />
                </Reveal>
                <div className="grid gap-6 lg:grid-cols-3">
                    {cols.map((c, i) => (
                        <Reveal key={c.title} delay={i * 0.08}>
                            <div className="h-full rounded-2xl border border-neutral-200 bg-white p-6">
                                <div className="mb-4 flex items-center gap-2">
                                    <span
                                        className="h-3 w-3 rounded-full"
                                        style={{ background: GREEN }}
                                    />
                                    <h3 className="text-lg font-bold" style={{ color: GREEN }}>
                                        {c.title}
                                    </h3>
                                </div>
                                <ul className="space-y-3 text-base text-neutral-600">
                                    {c.items.map((it) => (
                                        <li key={it} className="flex gap-2">
                                            <span
                                                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                                                style={{ background: GOLD }}
                                            />
                                            {it}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </Reveal>
                    ))}
                </div>
                <Reveal delay={0.1}>
                    <div
                        className="mt-8 rounded-2xl p-6"
                        style={{ background: GREEN_DEEP }}
                    >
                        <p className="text-sm leading-relaxed text-white/85">
                            <strong className="text-white">O elo de valor:</strong> padronizar
                            a conversa entre produtores, fabricantes de IFA, farmacêuticas e
                            redes magistrais, transformando interesse disperso em documentos
                            comerciais e técnicos que sustentem decisões regulatórias e de
                            investimento.
                        </p>
                    </div>
                </Reveal>
            </div>
        </section>
    );
}

/* ------------------------------------------------------------------ */
/* Solution                                                            */
/* ------------------------------------------------------------------ */
function Solution() {
    const chain = [
        { title: 'Fazendas', desc: 'setup produtivo · 3 t / semestre' },
        { title: 'COMMODITY CBD', desc: 'originação + contratos + dados', strong: true },
        { title: 'Extrator / IFA', desc: 'processamento e qualidade' },
        { title: 'Farmacêuticas', desc: 'produtos regularizados' },
        { title: 'Magistral', desc: 'demanda futura via CBD IFA' },
    ];
    const steps = [
        { n: '1', t: 'Prospecção', d: 'Mapear decisores em suprimentos, P&D, regulatório e novos negócios.', icon: Target },
        { n: '2', t: 'Qualificação', d: 'Confirmar AE, escopo, especificação, volumes e destinatário legal.', icon: ClipboardCheck },
        { n: '3', t: 'Documentos', d: 'NDA, questionário, LOI, MOU, term sheet e data room comercial.', icon: FileText },
        { n: '4', t: 'Negociação', d: 'Construir offtake modular por setup, com condições precedentes.', icon: Briefcase },
        { n: '5', t: 'Governança', d: 'Rastreabilidade, indicadores, CRM, follow-up e reporte ao investidor.', icon: ShieldCheck },
        { n: '6', t: 'Expansão', d: 'Canais farmacêutico, magistral via IFA e exportação como proteção.', icon: TrendingUp },
    ];
    return (
        <section className="px-5 py-14 sm:px-6 sm:py-20">
            <div className="mx-auto max-w-6xl">
                <Reveal>
                    <SectionHeading
                        title="A solução: uma plataforma B2B de originação e offtake"
                        subtitle="A COMMODITY CBD atua como comercializadora estratégica e PMO regulatório-comercial: encontra compradores, qualifica a demanda, estrutura documentos e organiza a cadeia."
                    />
                </Reveal>

                <Reveal delay={0.05}>
                    <div className="mb-12 flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                        {chain.map((c, i) => (
                            <div key={c.title} className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                                <div
                                    className="min-w-[140px] rounded-xl border px-3 py-2.5"
                                    style={{
                                        background: c.strong ? GREEN : '#fff',
                                        borderColor: c.strong ? GREEN : '#e5e5e5',
                                    }}
                                >
                                    <p
                                        className="text-xs font-bold"
                                        style={{ color: c.strong ? '#fff' : GREEN }}
                                    >
                                        {c.title}
                                    </p>
                                    <p
                                        className="mt-0.5 text-[11px] leading-tight"
                                        style={{ color: c.strong ? 'rgba(255,255,255,0.7)' : '#8a8a8a' }}
                                    >
                                        {c.desc}
                                    </p>
                                </div>
                                {i < chain.length - 1 && (
                                    <ArrowRight className="mx-auto h-4 w-4 rotate-90 sm:mx-0 sm:rotate-0" style={{ color: GOLD }} />
                                )}
                            </div>
                        ))}
                    </div>
                </Reveal>

                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {steps.map((s, i) => (
                        <Reveal key={s.n} delay={i * 0.05}>
                            <div className="h-full rounded-2xl border border-neutral-200 p-6">
                                <div className="mb-4 flex items-center gap-3">
                                    <div
                                        className="flex h-9 w-9 items-center justify-center rounded-lg"
                                        style={{ background: MIST }}
                                    >
                                        <s.icon className="h-5 w-5" style={{ color: GREEN }} />
                                    </div>
                                    <h3 className="font-bold" style={{ color: GREEN }}>
                                        {s.n}. {s.t}
                                    </h3>
                                </div>
                                <p className="text-base leading-relaxed text-neutral-600">{s.d}</p>
                            </div>
                        </Reveal>
                    ))}
                </div>
            </div>
        </section>
    );
}

/* ------------------------------------------------------------------ */
/* Regulatory                                                          */
/* ------------------------------------------------------------------ */
function Regulatory() {
    const timeline = [
        {
            date: 'Jan / Fev 2026',
            text: 'Publicação do novo marco: produção medicinal, pesquisa, associações e produtos industrializados.',
        },
        {
            date: '04/08/2026',
            text: 'Entrada em vigor da RDC 1.013/2026 para cultivo de Cannabis sativa L. ≤ 0,3% THC.',
        },
        {
            date: 'Mai 2026',
            text: 'RDC 1.023/2026 alinha exportação, rotulagem, enquadramento e controles para IFA/produtos.',
        },
    ];
    const guardrails = [
        'Cultivo: somente por pessoa jurídica com Autorização Especial e requisitos técnicos.',
        'Material vegetal não destinado ao cultivo: deve ir a estabelecimento com AE compatível, como fabricante de IFA, laboratório/pesquisa ou fabricante de medicamentos para pesquisa.',
        'Estimativa produtiva: deve ser sustentada por contratos ou documentos de intenção de compra, venda e distribuição.',
        'Exportação: admitida para Cannabis sativa L. ≤ 0,3% THC, com documentação comercial correspondente.',
        'Canal magistral: demanda relevante, mas a via prudente é via CBD como IFA, não venda direta de flor/biomassa às farmácias.',
    ];
    return (
        <section className="px-5 py-14 sm:px-6 sm:py-20" style={{ background: '#FAFAF8' }}>
            <div className="mx-auto max-w-6xl">
                <Reveal>
                    <SectionHeading
                        title="Janela regulatória: oportunidade com travas claras"
                        subtitle="A tese de sucesso depende de respeitar a cadeia legal: baixo THC, AE, rastreabilidade, destinatário habilitado e documentos comerciais reais."
                    />
                </Reveal>
                <div className="grid gap-10 lg:grid-cols-2">
                    <Reveal>
                        <div className="relative pl-8">
                            <div
                                className="absolute left-[7px] top-2 h-[calc(100%-1rem)] w-0.5"
                                style={{ background: GOLD }}
                            />
                            {timeline.map((t, i) => (
                                <div key={i} className="relative mb-8 last:mb-0">
                                    <div
                                        className="absolute -left-8 top-1 h-4 w-4 rounded-full border-2 border-white"
                                        style={{ background: GOLD }}
                                    />
                                    <p className="font-bold" style={{ color: GREEN }}>
                                        {t.date}
                                    </p>
                                    <p className="mt-1 text-base leading-relaxed text-neutral-600">
                                        {t.text}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </Reveal>
                    <Reveal delay={0.08}>
                        <div className="rounded-2xl p-6" style={{ background: MIST }}>
                            <h3 className="mb-4 text-lg font-bold" style={{ color: GREEN }}>
                                Guardrails para o investidor
                            </h3>
                            <ul className="space-y-3 text-base text-neutral-700">
                                {guardrails.map((g, i) => (
                                    <li key={i} className="flex gap-2">
                                        <CheckCircle2
                                            className="mt-0.5 h-4 w-4 shrink-0"
                                            style={{ color: GREEN }}
                                        />
                                        {g}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </Reveal>
                </div>
                <Reveal delay={0.1}>
                    <div
                        className="mt-8 rounded-2xl p-6"
                        style={{ background: GREEN_DEEP }}
                    >
                        <p className="text-sm leading-relaxed text-white/85">
                            <strong className="text-white">Mensagem central:</strong> a
                            empresa ganha valor justamente por não pular etapas: organiza
                            demanda, destinatário legal, documentação e rastreabilidade antes
                            de escalar produção.
                        </p>
                    </div>
                </Reveal>
            </div>
        </section>
    );
}

/* ------------------------------------------------------------------ */
/* Market                                                              */
/* ------------------------------------------------------------------ */
function StatCard({ big, label }: { big: string; label: string }) {
    return (
        <div className="rounded-2xl border border-neutral-200 p-6 text-center">
            <p className="text-3xl font-black" style={{ color: GREEN }}>
                {big}
            </p>
            <p className="mt-2 text-xs leading-snug text-neutral-500">{label}</p>
        </div>
    );
}

function Market() {
    const channels = [
        { label: 'Importação', value: 354, color: GREEN },
        { label: 'Farmácias', value: 293, color: GOLD },
        { label: 'Associações', value: 226, color: ORANGE },
    ];
    const max = 354;
    const reads = [
        ['Demanda existe:', 'há pacientes, produtos regularizados e canais de acesso em crescimento.'],
        ['O gargalo é industrial:', 'não basta haver paciente; é preciso comprador habilitado, especificação, IFA e produto final.'],
        ['O canal magistral amplia a tese:', 'mas deve ser estruturado por fabricante de IFA e distribuidores/rede, não por venda direta da biomassa.'],
        ['O timing favorece o B2B:', 'o mercado procura fornecedores locais, qualidade e redução de dependência de importação.'],
        ['Sucesso depende de execução:', 'carteira de LOIs, homologação e governança regulatória são a prova de tração.'],
    ];
    return (
        <section className="px-5 py-14 sm:px-6 sm:py-20">
            <div className="mx-auto max-w-6xl">
                <Reveal>
                    <SectionHeading
                        title="Mercado: crescimento real, mas ainda em consolidação"
                        subtitle="A oportunidade existe; o ponto crítico é converter demanda médica e farmacêutica em contratos industriais de insumo."
                    />
                </Reveal>

                <div className="mb-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                    <Reveal delay={0}>
                        <StatCard big="873 mil" label="pacientes estimados com cannabis medicinal no Brasil em 2025" />
                    </Reveal>
                    <Reveal delay={0.05}>
                        <StatCard big="R$ 971 mi" label="mercado estimado de cannabis medicinal no Brasil em 2025" />
                    </Reveal>
                    <Reveal delay={0.1}>
                        <StatCard big="293 mil" label="pacientes estimados via farmácias em 2025" />
                    </Reveal>
                    <Reveal delay={0.15}>
                        <StatCard big="9.320" label="farmácias de manipulação ativas no Panorama Setorial 2026" />
                    </Reveal>
                </div>

                <div className="grid gap-8 lg:grid-cols-2">
                    <Reveal>
                        <div className="rounded-2xl border border-neutral-200 p-6">
                            <h3 className="mb-6 text-sm font-bold" style={{ color: GREEN }}>
                                Canais estimados de acesso em 2025 (mil pacientes)
                            </h3>
                            <div className="space-y-5">
                                {channels.map((c) => (
                                    <div key={c.label}>
                                        <div className="mb-1.5 flex justify-between text-xs font-medium text-neutral-600">
                                            <span>{c.label}</span>
                                            <span style={{ color: c.color }}>{c.value}</span>
                                        </div>
                                        <div className="h-3 w-full overflow-hidden rounded-full bg-neutral-100">
                                            <motion.div
                                                className="h-full rounded-full"
                                                style={{ background: c.color }}
                                                initial={{ width: 0 }}
                                                whileInView={{ width: `${(c.value / max) * 100}%` }}
                                                viewport={{ once: true }}
                                                transition={{ duration: 0.9, ease: 'easeOut' }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </Reveal>
                    <Reveal delay={0.08}>
                        <div className="rounded-2xl p-6" style={{ background: MIST }}>
                            <h3 className="mb-4 text-lg font-bold" style={{ color: GREEN }}>
                                Leitura realista para o investidor
                            </h3>
                            <ul className="space-y-3 text-base text-neutral-700">
                                {reads.map(([b, r], i) => (
                                    <li key={i} className="flex gap-2">
                                        <span
                                            className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                                            style={{ background: GOLD }}
                                        />
                                        <span>
                                            <strong>{b}</strong> {r}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </Reveal>
                </div>
            </div>
        </section>
    );
}

/* ------------------------------------------------------------------ */
/* Capacity                                                            */
/* ------------------------------------------------------------------ */
function Capacity() {
    const bars = [
        { label: '3 setups', value: 18, color: GREEN },
        { label: '7 setups', value: 42, color: GOLD },
        { label: '12 setups', value: 72, color: ORANGE },
    ];
    const max = 80;
    const phases = [
        { t: 'Fase 1 — 3 setups | 18 t/ano', d: 'Plausível para iniciar com comprador habilitado e LOIs.', bg: MIST },
        { t: 'Fase 2 — 7 setups | 42 t/ano', d: 'Escala intermediária, exigindo 2-4 compradores.', bg: MIST },
        { t: 'Fase 3 — 12 setups | 72 t/ano', d: 'Capacidade máxima; ativar apenas com cobertura comercial robusta.', bg: CREAM },
    ];
    return (
        <section className="px-5 py-14 sm:px-6 sm:py-20" style={{ background: '#FAFAF8' }}>
            <div className="mx-auto max-w-6xl">
                <Reveal>
                    <SectionHeading
                        title="Capacidade produtiva: modularidade reduz risco"
                        subtitle="Cada setup informado entrega 3 toneladas por semestre, ou 6 toneladas por ano. O modelo deve escalar por cobertura comercial documentada."
                    />
                </Reveal>
                <div className="grid gap-8 lg:grid-cols-2">
                    <Reveal>
                        <div className="rounded-2xl border border-neutral-200 bg-white p-6">
                            <h3 className="mb-6 text-sm font-bold" style={{ color: GREEN }}>
                                Capacidade anual por cenário
                            </h3>
                            <div className="flex items-end justify-around gap-6">
                                {bars.map((b) => (
                                    <div key={b.label} className="flex flex-1 flex-col items-center">
                                        <span className="mb-2 text-sm font-bold" style={{ color: b.color }}>
                                            {b.value} t/ano
                                        </span>
                                        <div className="flex h-56 w-full max-w-[80px] items-end">
                                            <motion.div
                                                className="w-full rounded-t-lg"
                                                style={{ background: b.color }}
                                                initial={{ height: 0 }}
                                                whileInView={{ height: `${(b.value / max) * 100}%` }}
                                                viewport={{ once: true }}
                                                transition={{ duration: 0.9, ease: 'easeOut' }}
                                            />
                                        </div>
                                        <span className="mt-3 text-xs text-neutral-500">{b.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </Reveal>
                    <Reveal delay={0.08}>
                        <div>
                            <h3 className="mb-4 text-lg font-bold" style={{ color: GREEN }}>
                                Regra de escala recomendada
                            </h3>
                            <div className="space-y-3">
                                {phases.map((p, i) => (
                                    <div key={i} className="rounded-xl p-4" style={{ background: p.bg }}>
                                        <p className="text-sm font-bold" style={{ color: GREEN }}>
                                            {p.t}
                                        </p>
                                        <p className="mt-1 text-sm text-neutral-600">{p.d}</p>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-4">
                                <p className="text-base leading-relaxed text-neutral-600">
                                    <strong style={{ color: GREEN }}>Política prudencial:</strong>{' '}
                                    não ativar a expansão para 12 setups sem cobertura mínima
                                    proposta de 60% da capacidade anual por LOIs/offtakes
                                    qualificados, com pelo menos um fabricante/extrator de IFA e
                                    rota de exportação como proteção.
                                </p>
                            </div>
                        </div>
                    </Reveal>
                </div>
            </div>
        </section>
    );
}

/* ------------------------------------------------------------------ */
/* Economics                                                           */
/* ------------------------------------------------------------------ */
function Economics() {
    const rows = [
        ['3 setups', '18 t', 'R$ 15,3 mi', 'R$ 765 mil', 'Fase inicial'],
        ['7 setups', '42 t', 'R$ 35,7 mi', 'R$ 1,785 mi', 'Expansão'],
        ['12 setups', '72 t', 'R$ 61,2 mi', 'R$ 3,06 mi', 'Escala máxima'],
    ];
    const streams = [
        { t: 'Originação', d: 'Comissão/success fee por comprador qualificado, LOI ou contrato assinado.', icon: Target },
        { t: 'Spread B2B', d: 'Margem contratual entre preço da fazenda e preço do comprador, quando permitido.', icon: TrendingUp },
        { t: 'PMO regulatório', d: 'Retainer para organizar data room, compliance e documentação da cadeia.', icon: ShieldCheck },
        { t: 'Equity opcional', d: 'Participação em setups ou SPVs quando o investidor desejar upside de produção.', icon: Layers },
    ];
    return (
        <section className="px-5 py-14 sm:px-6 sm:py-20">
            <div className="mx-auto max-w-6xl">
                <Reveal>
                    <SectionHeading
                        title="Modelo econômico: empresa-ponte com baixo CAPEX próprio"
                        subtitle="O valor do negócio está em originação, contratos, inteligência comercial, documentação e governança — não em assumir todo o risco agrícola."
                    />
                </Reveal>

                <Reveal delay={0.05}>
                    <div className="mb-8 rounded-2xl p-6" style={{ background: MIST }}>
                        <h3 className="mb-3 text-base font-bold" style={{ color: GREEN }}>
                            Premissas ilustrativas usadas no modelo
                        </h3>
                        <ul className="space-y-2 text-sm text-neutral-700">
                            <li>• Preço-base hipotético de referência: R$ 850 mil por tonelada de biomassa qualificada.</li>
                            <li>• GMV = valor bruto anual da produção potencialmente negociada; não é receita líquida da empresa.</li>
                            <li>• Receita da COMMODITY CBD: taxa de originação, spread comercial, success fee, retainer de PMO e participação em setups selecionados.</li>
                        </ul>
                    </div>
                </Reveal>

                <Reveal delay={0.08}>
                    <div className="mb-10 overflow-x-auto rounded-2xl border border-neutral-200">
                        <table className="w-full text-sm">
                            <thead>
                                <tr style={{ background: GREEN_DEEP }}>
                                    {['Cenário', 'Volume anual', 'GMV potencial', 'Fee 5% ilustrativo', 'Leitura'].map((h) => (
                                        <th key={h} className="px-5 py-3 text-left font-semibold text-white">
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r, i) => (
                                    <tr
                                        key={i}
                                        className="border-t border-neutral-100"
                                        style={{ background: i % 2 ? '#FAFAF8' : '#fff' }}
                                    >
                                        <td className="px-5 py-4 font-bold" style={{ color: GREEN }}>{r[0]}</td>
                                        <td className="px-5 py-4 text-neutral-600">{r[1]}</td>
                                        <td className="px-5 py-4 font-semibold text-neutral-800">{r[2]}</td>
                                        <td className="px-5 py-4 font-semibold text-neutral-800">{r[3]}</td>
                                        <td className="px-5 py-4 text-neutral-500">{r[4]}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Reveal>

                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                    {streams.map((s, i) => (
                        <Reveal key={s.t} delay={i * 0.06}>
                            <div className="h-full rounded-2xl border border-neutral-200 p-6">
                                <div
                                    className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg"
                                    style={{ background: MIST }}
                                >
                                    <s.icon className="h-5 w-5" style={{ color: GREEN }} />
                                </div>
                                <h3 className="mb-2 font-bold" style={{ color: GREEN }}>{s.t}</h3>
                                <p className="text-base leading-relaxed text-neutral-600">{s.d}</p>
                            </div>
                        </Reveal>
                    ))}
                </div>

                <Disclaimer>
                    * Premissas financeiras não são promessa de resultado. O investidor
                    deve validar preço, custo, tributos, perdas, logística, BPF/qualidade e
                    risco regulatório antes de aportar capital.
                </Disclaimer>
            </div>
        </section>
    );
}

/* ------------------------------------------------------------------ */
/* Go To Market                                                        */
/* ------------------------------------------------------------------ */
function GoToMarket() {
    const cols = [
        {
            title: 'Prioridade A — compradores industriais',
            bg: MIST,
            items: ['Ease Labs', 'FarmaUSA Life Science', 'Prati-Donaduzzi', 'União Química / Genom / NuNature', 'GreenCare Pharma', 'Herbarium'],
        },
        {
            title: 'Prioridade B — grandes laboratórios',
            bg: MIST,
            items: ['Aché', 'Eurofarma', 'Hypera/Mantecorp', 'Teuto', 'FQM/Farmoquímica', 'Biolab/Promediol'],
        },
        {
            title: 'Canal magistral — demanda indireta',
            bg: CREAM,
            items: ['Anfarmag', 'Coopermag / Irial Mag', 'Pharmapele', 'Farmácia Artesanal', 'A Fórmula', 'CFF como stakeholder'],
        },
    ];
    return (
        <section className="px-5 py-14 sm:px-6 sm:py-20" style={{ background: '#FAFAF8' }}>
            <div className="mx-auto max-w-6xl">
                <Reveal>
                    <SectionHeading
                        title="Go-to-market: quem compra e quem influencia a compra"
                        subtitle="A venda deve ser feita por carteira: fabricante de IFA/extrator, farmacêutica, distribuidor e canal magistral organizado."
                    />
                </Reveal>
                <div className="grid gap-6 lg:grid-cols-3">
                    {cols.map((c, i) => (
                        <Reveal key={c.title} delay={i * 0.08}>
                            <div className="h-full rounded-2xl p-6" style={{ background: c.bg }}>
                                <h3 className="mb-4 text-base font-bold" style={{ color: GREEN }}>
                                    {c.title}
                                </h3>
                                <ul className="space-y-2.5 text-sm text-neutral-700">
                                    {c.items.map((it) => (
                                        <li key={it} className="flex gap-2">
                                            <span
                                                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                                                style={{ background: GOLD }}
                                            />
                                            {it}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </Reveal>
                    ))}
                </div>
                <Reveal delay={0.1}>
                    <div className="mt-8 rounded-2xl p-6" style={{ background: GREEN_DEEP }}>
                        <p className="text-sm leading-relaxed text-white/85">
                            <strong className="text-white">Roteiro comercial:</strong> contato
                            executivo → apresentação não confidencial → NDA → questionário de
                            qualificação → reunião técnica → LOI por setup → term sheet/offtake.
                            O objetivo não é uma venda isolada, mas uma carteira de compradores
                            que sustente a expansão.
                        </p>
                    </div>
                </Reveal>
            </div>
        </section>
    );
}

/* ------------------------------------------------------------------ */
/* Differentiators                                                     */
/* ------------------------------------------------------------------ */
function Differentiators() {
    const nodes = [
        { t: 'Data room', d: 'documentos, contratos, laudos e status por projeto', icon: Database },
        { t: 'CRM comprador', d: 'pipeline de decisores, follow-up e provas de tração', icon: Users },
        { t: 'Regulatório', d: 'AE, destino legal, condições precedentes e rastreabilidade', icon: ShieldCheck },
        { t: 'Qualidade', d: 'especificações, CoA, amostras, auditoria e lote', icon: ClipboardCheck },
        { t: 'Carteira', d: 'vários compradores, sem dependência de um único laboratório', icon: Boxes },
    ];
    return (
        <section className="px-5 py-14 sm:px-6 sm:py-20">
            <div className="mx-auto max-w-6xl">
                <Reveal>
                    <SectionHeading
                        title="Diferenciais competitivos: a barreira está na execução"
                        subtitle="O mercado pode atrair muitos interessados; poucos terão disciplina para juntar regulação, qualidade, compradores e documentação."
                    />
                </Reveal>

                <div className="mb-8 flex justify-center">
                    <div
                        className="flex h-28 w-28 flex-col items-center justify-center rounded-full text-center"
                        style={{ background: GREEN }}
                    >
                        <span className="text-sm font-bold text-white">COMMODITY</span>
                        <span className="text-sm font-bold text-white">CBD</span>
                        <span className="text-[10px] text-white/60">hub B2B</span>
                    </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
                    {nodes.map((n, i) => (
                        <Reveal key={n.t} delay={i * 0.06}>
                            <div className="h-full rounded-2xl border border-neutral-200 p-5 text-center">
                                <div
                                    className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg"
                                    style={{ background: MIST }}
                                >
                                    <n.icon className="h-5 w-5" style={{ color: GREEN }} />
                                </div>
                                <h3 className="mb-1.5 text-sm font-bold" style={{ color: GREEN }}>
                                    {n.t}
                                </h3>
                                <p className="text-xs leading-relaxed text-neutral-600">{n.d}</p>
                            </div>
                        </Reveal>
                    ))}
                </div>

                <Reveal delay={0.1}>
                    <div className="mt-8 rounded-2xl p-6" style={{ background: MIST }}>
                        <p className="text-base leading-relaxed text-neutral-700">
                            <strong style={{ color: GREEN }}>Barreira prática:</strong> quanto
                            mais a empresa padroniza contatos, documentos, especificações e
                            governança, mais ela se torna o parceiro natural para fazendas e
                            farmacêuticas que precisam avançar sem risco regulatório
                            desnecessário.
                        </p>
                    </div>
                </Reveal>
            </div>
        </section>
    );
}

/* ------------------------------------------------------------------ */
/* Risks                                                               */
/* ------------------------------------------------------------------ */
function Risks() {
    const rows = [
        ['Regulatório', 'AE, inspeção, rastreabilidade e destinatário legal podem atrasar ou limitar a operação.', 'Operar com condições precedentes, data room, parecer jurídico e validação de AE de cada receptor.'],
        ['Comercial', 'Interesse verbal não equivale a demanda absorvível em toneladas.', 'Exigir LOIs qualificadas por volume, especificação, prazo, fabricante receptor e governança de aprovação.'],
        ['Qualidade', 'Biomassa fora de especificação, THC acima do limite ou contaminação pode destruir lote.', 'Especificação técnica por comprador, amostragem, CoA, auditoria e rastreabilidade por lote.'],
        ['Concentração', 'Dependência de um único comprador ou uma única rota industrial.', 'Carteira de 2-4 compradores para 7 setups e exportação/IFA como rotas paralelas.'],
        ['Preço', 'Preço de referência pode não se confirmar em contrato.', 'Usar faixas de preço, fórmula por especificação e margem protegida por term sheet.'],
        ['Reputação', 'Mercado sofre com ofertas irregulares e propaganda indevida.', 'Comunicação B2B, sem promessa terapêutica e somente com produtos/insumos regularizados.'],
    ];
    return (
        <section className="px-5 py-14 sm:px-6 sm:py-20" style={{ background: '#FAFAF8' }}>
            <div className="mx-auto max-w-6xl">
                <Reveal>
                    <SectionHeading
                        title="Riscos reais e mitigação"
                        subtitle="Um investidor sério precisa ver que o projeto sabe onde pode falhar e como reduzir esses riscos antes de escalar."
                    />
                </Reveal>
                <Reveal delay={0.05}>
                    <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
                        <table className="w-full text-sm">
                            <thead>
                                <tr style={{ background: GREEN_DEEP }}>
                                    {['Risco', 'Impacto', 'Mitigação'].map((h) => (
                                        <th key={h} className="px-5 py-3 text-left font-semibold text-white">
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r, i) => (
                                    <tr
                                        key={i}
                                        className="border-t border-neutral-100 align-top"
                                        style={{ background: i % 2 ? '#FAFAF8' : '#fff' }}
                                    >
                                        <td className="px-5 py-4">
                                            <span className="flex items-center gap-2 font-bold" style={{ color: GREEN }}>
                                                <AlertTriangle className="h-4 w-4" style={{ color: ORANGE }} />
                                                {r[0]}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 text-neutral-600">{r[1]}</td>
                                        <td className="px-5 py-4 text-neutral-600">{r[2]}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Reveal>
            </div>
        </section>
    );
}

/* ------------------------------------------------------------------ */
/* Execution Plan                                                      */
/* ------------------------------------------------------------------ */
function ExecutionPlan() {
    const steps = [
        { d: '0-15 dias', t: 'Preparação', x: 'Teaser, deck, NDA, questionário, data room, CRM e mapa de compradores.', color: GREEN },
        { d: '15-30 dias', t: 'Abordagem', x: '20-40 contatos qualificados em farmacêuticas, fabricantes de IFA e agregadores magistrais.', color: GOLD },
        { d: '30-60 dias', t: 'Qualificação', x: 'Reuniões técnicas, verificação de AE, volumes, especificações e receptores industriais.', color: ORANGE },
        { d: '60-90 dias', t: 'LOIs', x: '2-4 LOIs/MOUs por setups, com condições precedentes e cronograma de offtake.', color: GREEN_DEEP },
    ];
    const kpis = [
        'Nº de decisores contatados',
        'Nº de NDAs assinados',
        'Nº de reuniões técnicas',
        'Volume anual coberto por LOIs',
        '% de capacidade com receptor AE validado',
        'Nº de rotas alternativas: IFA/exportação/magistral',
    ];
    return (
        <section className="px-5 py-14 sm:px-6 sm:py-20">
            <div className="mx-auto max-w-6xl">
                <Reveal>
                    <SectionHeading
                        title="Plano de execução: 90 dias para provar tração"
                        subtitle="A meta não é montar uma fazenda primeiro; é montar evidência comercial e regulatória para justificar a expansão."
                    />
                </Reveal>
                <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {steps.map((s, i) => (
                        <Reveal key={s.d} delay={i * 0.07}>
                            <div className="h-full overflow-hidden rounded-2xl border border-neutral-200">
                                <div
                                    className="px-5 py-2 text-xs font-bold text-white"
                                    style={{ background: s.color }}
                                >
                                    {s.d}
                                </div>
                                <div className="p-5">
                                    <h3 className="mb-2 text-lg font-bold" style={{ color: GREEN }}>
                                        {s.t}
                                    </h3>
                                    <p className="text-base leading-relaxed text-neutral-600">{s.x}</p>
                                </div>
                            </div>
                        </Reveal>
                    ))}
                </div>
                <Reveal delay={0.1}>
                    <div className="rounded-2xl p-6" style={{ background: MIST }}>
                        <h3 className="mb-4 text-lg font-bold" style={{ color: GREEN }}>
                            KPIs que o investidor deve cobrar
                        </h3>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {kpis.map((k) => (
                                <div key={k} className="flex items-center gap-2 text-sm text-neutral-700">
                                    <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: GREEN }} />
                                    {k}
                                </div>
                            ))}
                        </div>
                    </div>
                </Reveal>
            </div>
        </section>
    );
}

/* ------------------------------------------------------------------ */
/* Use of Funds                                                        */
/* ------------------------------------------------------------------ */
function UseOfFunds() {
    const value = [
        ['Comercial B2B:', 'prospecção, CRM, viagens, reuniões, follow-up e fechamento de LOIs.'],
        ['Regulatório/jurídico:', 'pareceres, minutas, data room, condições precedentes e governança contratual.'],
        ['Técnico/qualidade:', 'especificação, parceiros de laboratório, protocolo de amostras e due diligence de receptores.'],
        ['Marca institucional:', 'deck, website, materiais pre-NDA, controle de comunicação e reputação.'],
        ['Pipeline de setups:', 'estruturação de SPVs/projetos, cadastro de fazendas e contratos de originação.'],
    ];
    const thesis = [
        ['Risco menor que cultivar direto:', 'a empresa começa por contratos e demanda.'],
        ['Upside opcional:', 'pode participar de setups só depois de comprador validado.'],
        ['Mercado regulado:', 'quem dominar documentação e compradores sai na frente.'],
        ['Multiplicador:', 'uma equipe comercial pode destravar vários projetos agrícolas.'],
        ['Exit/expansão:', 'virar hub de suprimentos para IFA, farmacêuticas e exportação.'],
    ];
    return (
        <section className="px-5 py-14 sm:px-6 sm:py-20" style={{ background: '#FAFAF8' }}>
            <div className="mx-auto max-w-6xl">
                <Reveal>
                    <SectionHeading
                        title="Uso do investimento: provar mercado antes de escalar CAPEX"
                        subtitle="O capital deve comprar velocidade comercial, documentação e credibilidade — não risco agrícola prematuro."
                    />
                </Reveal>
                <div className="grid gap-6 lg:grid-cols-2">
                    {[
                        { title: 'Onde o capital cria valor', data: value },
                        { title: 'Tese para o investidor', data: thesis },
                    ].map((block, bi) => (
                        <Reveal key={block.title} delay={bi * 0.08}>
                            <div className="h-full rounded-2xl border border-neutral-200 bg-white p-6">
                                <h3 className="mb-4 text-lg font-bold" style={{ color: GREEN }}>
                                    {block.title}
                                </h3>
                                <ul className="space-y-3 text-base text-neutral-700">
                                    {block.data.map(([b, r], i) => (
                                        <li key={i} className="flex gap-2">
                                            <span
                                                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                                                style={{ background: GOLD }}
                                            />
                                            <span>
                                                <strong>{b}</strong> {r}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </Reveal>
                    ))}
                </div>
                <Reveal delay={0.1}>
                    <div className="mt-8 rounded-2xl p-6" style={{ background: GREEN_DEEP }}>
                        <p className="text-sm leading-relaxed text-white/85">
                            <strong className="text-white">Proposta de disciplina:</strong>{' '}
                            liberar recursos por marcos — data room pronto, NDAs assinados,
                            LOIs qualificadas, receptor com AE validado e percentual de
                            capacidade coberto.
                        </p>
                    </div>
                </Reveal>
            </div>
        </section>
    );
}

/* ------------------------------------------------------------------ */
/* Conclusion                                                          */
/* ------------------------------------------------------------------ */
function Conclusion() {
    const cards = [
        { n: '1', t: 'Validação', d: 'Provar comprador habilitado e receptor industrial antes de escalar.' },
        { n: '2', t: 'Modularidade', d: 'Ativar 3 setups, depois 7, e tratar 12 como expansão máxima condicionada.' },
        { n: '3', t: 'Carteira', d: 'Nunca depender de um único comprador; combinar indústria, IFA, magistral e exportação.' },
    ];
    return (
        <section className="px-5 py-16 sm:px-6 sm:py-24" style={{ background: GREEN }}>
            <div className="mx-auto max-w-6xl">
                <Reveal>
                    <Kicker>Conclusão</Kicker>
                    <h2 className="mt-6 max-w-3xl text-3xl font-bold text-white sm:text-4xl">
                        Negócio plausível, desde que vendido como ponte regulada
                    </h2>
                    <p className="mt-3 max-w-3xl text-sm text-white/70">
                        A força do projeto está em unir capacidade agrícola, demanda
                        farmacêutica e documentação executável.
                    </p>
                </Reveal>

                <Reveal delay={0.05}>
                    <div
                        className="my-10 rounded-2xl p-6"
                        style={{ background: GREEN_DEEP }}
                    >
                        <p className="text-base leading-relaxed text-white/85">
                            O investidor não está comprando uma promessa genérica de cannabis;
                            está entrando em uma plataforma comercial para organizar contratos,
                            qualidade e demanda em um mercado recém-regulado.
                        </p>
                    </div>
                </Reveal>

                <div className="grid gap-6 lg:grid-cols-3">
                    {cards.map((c, i) => (
                        <Reveal key={c.n} delay={i * 0.08}>
                            <div className="h-full rounded-2xl bg-white/5 p-6 ring-1 ring-white/10">
                                <span
                                    className="text-3xl font-black"
                                    style={{ color: GOLD }}
                                >
                                    {c.n}
                                </span>
                                <h3 className="mt-2 text-lg font-bold text-white">{c.t}</h3>
                                <p className="mt-2 text-sm leading-relaxed text-white/70">{c.d}</p>
                            </div>
                        </Reveal>
                    ))}
                </div>

                <Reveal delay={0.12}>
                    <div
                        className="mt-8 rounded-2xl p-6"
                        style={{ background: GOLD }}
                    >
                        <p
                            className="text-sm font-semibold leading-relaxed"
                            style={{ color: GREEN_DEEP }}
                        >
                            Veredito executivo: o plano é plausível e investível como
                            empresa-ponte B2B, com execução por marcos. A chance real de
                            sucesso aumenta quando a empresa evita promessa de produção antes de
                            LOIs, AE e compradores qualificados.
                        </p>
                    </div>
                </Reveal>
            </div>
        </section>
    );
}

/* ------------------------------------------------------------------ */
/* Sources                                                             */
/* ------------------------------------------------------------------ */
function Sources() {
    const sources = [
        { t: 'Anvisa — notícia institucional sobre as RDCs de produção de cannabis medicinal, publicada em 03/02/2026', u: 'https://www.gov.br/anvisa/pt-br/assuntos/noticias-anvisa/2026/anvisa-publica-regras-para-producao-de-cannabis-medicinal/' },
        { t: 'RDC Anvisa nº 1.013/2026 — cultivo de Cannabis sativa L. com THC ≤ 0,3%; entrada em vigor em 04/08/2026', u: 'https://anvisalegis.datalegis.net/' },
        { t: 'RDC Anvisa nº 1.015/2026 — fabricação/importação e comercialização de produtos de Cannabis para uso medicinal humano', u: 'https://anvisalegis.datalegis.net/' },
        { t: 'Anvisa — RDC 1.023/2026 e alinhamento sobre exportação de produtos/IFAs de cannabis medicinal', u: 'https://www.gov.br/anvisa/pt-br/assuntos/noticias-anvisa/2026/anvisa-alinha-normas-a-regras-de-cannabis-aprovada-em-janeiro' },
        { t: 'Kaya Mind — Anuário/estimativa: 873.111 pacientes em 2025', u: 'https://kayamind.com/numero-pacientes-cannabis-brasil-2025/' },
        { t: 'CNN Brasil — estimativa de mercado de R$ 971 milhões em 2025 e canais de acesso', u: 'https://www.cnnbrasil.com.br/agro/mercado-de-cannabis-medicinal-atinge-r-971-milhoes-no-brasil-em-2025/' },
        { t: 'Anfarmag — Panorama Setorial 2026 do setor magistral', u: 'https://anfarmag.org.br/panorama-setorial/' },
        { t: 'FarmaUSA Life Science — publicação pública sobre importação de 1 t de extrato para processamento em laboratório próprio', u: 'https://pt.linkedin.com/' },
        { t: 'Premissa interna do projeto: cada setup produz 3 t por semestre; 3 setups já comprometidos; possibilidade de expansão até 12 setups mediante perspectiva comercial.', u: null },
    ];
    return (
        <section className="px-5 py-14 sm:px-6 sm:py-20">
            <div className="mx-auto max-w-6xl">
                <Reveal>
                    <SectionHeading
                        title="Fontes e premissas usadas"
                        subtitle="Documento preparado em 16/07/2026 com base em fontes públicas e premissas internas do projeto. Dados sujeitos a atualização."
                    />
                </Reveal>
                <ol className="space-y-4">
                    {sources.map((s, i) => (
                        <li key={i} className="flex gap-3 text-sm">
                            <span
                                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                                style={{ background: GREEN }}
                            >
                                {i + 1}
                            </span>
                            <div>
                                <p className="font-medium text-neutral-700">{s.t}</p>
                                {s.u && (
                                    <a
                                        href={s.u}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="break-all text-xs underline"
                                        style={{ color: GOLD }}
                                    >
                                        {s.u}
                                    </a>
                                )}
                            </div>
                        </li>
                    ))}
                </ol>
                <Disclaimer>
                    Nota: este material é ilustrativo de negócio e não substitui parecer
                    jurídico, due diligence regulatória, auditoria financeira ou validação
                    técnica de produção, preço, comprador, AE e especificações por lote.
                </Disclaimer>
            </div>
        </section>
    );
}

/* ------------------------------------------------------------------ */
/* Footer                                                              */
/* ------------------------------------------------------------------ */
function Footer() {
    return (
        <footer className="px-6 py-8" style={{ background: GREEN_DEEP }}>
            <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 text-center sm:flex-row sm:text-left">
                <p className="text-sm font-bold text-white">COMMODITY CBD</p>
                <p className="text-[11px] text-white/50">
                    Documento ilustrativo para discussão com investidor · Uso interno /
                    pre-NDA · Julho 2026
                </p>
            </div>
        </footer>
    );
}

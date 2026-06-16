"use client";

import { useState } from "react";
import Image from "next/image";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer/Footer";
import FooterBackground from "@/components/Footer/components/footer-background";
import ShinyText from "@/ui/shiny-text/shiny-text";
import WhatsAppFloat from "@/components/WhatsAppFloat";
import HeroCarousel from "@/components/HeroCarousel";
import {
  ShieldAlert,
  Scale,
  FileText,
  HeartPulse,
  ChevronDown,
  Mail,
  MapPin,
  MessageSquare,
  Users,
  CheckCircle2,
  ExternalLink,
  ArrowRight
} from "lucide-react";

export default function Home() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const faqItems = [
    {
      question: "Como o Habeas Corpus preventivo me protege no dia a dia?",
      answer: "O Habeas Corpus preventivo funciona como um salvo-conduto emitido pela Justiça. Ele impede judicialmente que qualquer autoridade policial apreenda suas plantas, insumos ou equipamentos, e obsta qualquer acusação criminal por cultivo ou posse do seu remédio. Trata-se de uma blindagem jurídica definitiva para que você realize o seu tratamento em paz na sua residência, com total segurança e respeito à lei."
    },
    {
      question: "O plano de saúde ou o SUS são obrigados a pagar pelo meu medicamento importado?",
      answer: "Sim. A jurisprudência brasileira determina de forma muito clara que, com uma indicação médica detalhada e a autorização de importação da ANVISA, a recusa de cobertura de produtos de Cannabis Medicinal é ilegal. Nós atuamos por meio de ações de urgência (liminares) para obrigar os convênios ou o Estado a custearem integralmente o seu tratamento contínuo."
    },
    {
      question: "Posso viajar ou transportar meu medicamento à base de Cannabis pelo Brasil?",
      answer: "Pacientes cadastrados na ANVISA e com prescrições médicas atualizadas têm o direito legal de portar e transportar o seu medicamento. Contudo, em virtude da desinformação e do preconceito que ainda cercam o tema, dispor de um amparo jurídico preventivo e, idealmente, do salvo-conduto de um Habeas Corpus (para quem produz o próprio óleo) evita abordagens constrangedoras, detenções indevidas ou apreensões arbitrárias."
    },
    {
      question: "Quem está elegível para solicitar a autorização de cultivo próprio doméstico?",
      answer: "Qualquer pessoa que necessite de tratamento contínuo com Cannabis Medicinal e disponha de prescrição médica detalhada, associada à comprovação de que o cultivo doméstico é a alternativa viável para a manutenção do tratamento (seja por razões financeiras, ajuste fino de dosagens específicas ou impossibilidade de arcar com importações constantes de alto custo)."
    },
    {
      question: "O meu processo correrá em segredo de justiça? Meus dados estarão seguros?",
      answer: "Sim, absolutamente. Processos que envolvem históricos médicos, laudos e receitas de saúde são resguardados por lei sob Segredo de Justiça. Ninguém fora as partes envolvidas e o juiz terá acesso ao seu nome, patologia ou qualquer informação sobre o seu cultivo medicinal. A confidencialidade é total e garantida."
    }
  ];

  const services = [
    {
      icon: <Scale className="text-gold-light" size={24} />,
      title: "Habeas Corpus Preventivo para Cultivo",
      description: "Garantia de segurança jurídica e salvo-conduto penal. Cultive o seu próprio tratamento fitoterápico em sua residência de forma totalmente legalizada, livre de batidas policiais, repressão ou qualquer tipo de abordagem criminal.",
      image: "/assets/pezinho.jpg"
    },
    {
      icon: <HeartPulse className="text-gold-light" size={24} />,
      title: "Fornecimento de Medicamentos (Planos & SUS)",
      description: "Ações liminares rápidas para obrigar planos de saúde e o SUS a custearem integralmente o seu tratamento importado ou nacional prescrito, revertendo imediatamente negativas administrativas abusivas.",
      image: "/assets/oleo.jpg"
    },
    {
      icon: <ShieldAlert className="text-gold-light" size={24} />,
      title: "Amparo Contra Abusos e Discriminação",
      description: "Proteção jurídica activa para o livre trânsito, transporte e porte de insumos medicinais em conformidade com as normas da ANVISA, assegurando que o seu direito à saúde seja respeitado em viagens nacionais.",
      image: "/assets/mudinhas.jpg"
    },
    {
      icon: <FileText className="text-gold-light" size={24} />,
      title: "Consultoria para Prescritores e Coletivos",
      description: "Assessoria jurídica especializada para médicos, clínicas de apoio, associações de pacientes e profissionais da saúde que buscam atuar em total conformidade ética e legal dentro da regulação canábica nacional.",
      image: "/assets/plantacao.jpg"
    }
  ];

  const steps = [
    {
      number: "01",
      title: "Prescrição & ANVISA",
      description: "Você obtém a sua receita médica detalhada para o tratamento (por exemplo, com especialistas da Click Cannabis) e o respectivo cadastro de importação perante a ANVISA."
    },
    {
      number: "02",
      title: "Avaliação do Caso",
      description: "Analisamos o seu histórico e definimos se a sua estratégia ideal é a judicialização para o fornecimento sem custos (Planos/SUS) ou o salvo-conduto de cultivo próprio doméstico."
    },
    {
      number: "03",
      title: "Medida Liminar Célere",
      description: "Ingressamos com a ação judicial correspondente. Em caso de urgência médica, o pedido de liminar é apreciado pelo juiz em um prazo curto de 24 a 72 horas."
    },
    {
      number: "04",
      title: "Tratamento Assegurado",
      description: "Com a decisão favorável, você garante o custeio total do seu medicamento importado ou realiza o seu plantio doméstico em paz, livre de preconceitos e coerção policial."
    }
  ];

  const reviews = [
    {
      type: "video",
      src: "/reviews/review1.mp4",
      title: "Salvo-conduto de Cultivo Conquistado",
      description: "Vídeo relato de paciente demonstrando como o Habeas Corpus preventivo viabilizou o cultivo medicinal seguro em sua residência, com segurança absoluta e sem receio de coerção legal."
    },
    {
      type: "image",
      src: "/reviews/review2.png",
      title: "Liberação de Custeio pelo Plano",
      description: "Mensagem de agradecimento enviada por um familiar de paciente de alta complexidade que obteve judicialmente o fornecimento integral do tratamento à base de canabinoides."
    },
    {
      type: "video",
      src: "/reviews/review3.mp4",
      title: "Independência e Segurança",
      description: "Relato sobre a paz de espírito e tranquilidade de obter o salvo-conduto após anos de apreensão e insegurança legal."
    },
    {
      type: "image",
      src: "/reviews/review4.png",
      title: "Fornecimento de Tratamento via SUS",
      description: "Decisão judicial determinando que o SUS forneça e arque imediatamente com o tratamento médico prescrito sob pena de multa."
    }
  ];

  return (
    <div className="min-h-screen relative bg-[#FAF8F5] text-zinc-850 font-sans antialiased">
      {/* Floating Navbar */}
      <Navbar />

      {/* Hero Section Wrapper - Full Width Background with Footer SVG Glow */}
      <div className="w-full bg-[#FAF8F5] relative overflow-hidden">
        {/* FooterBackground placed absolutely as Hero Background */}
        <div className="absolute inset-0 z-0 pointer-events-none opacity-45">
          <FooterBackground className="w-full h-full object-cover" />
        </div>
        
        {/* Hero Section - Content */}
        <section id="inicio" className="relative bg-transparent pt-32 pb-16 md:pt-40 md:pb-20 lg:pt-44 lg:pb-24 px-6 max-w-6xl mx-auto z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
            
            {/* Hero Left - Copywriting & Left-aligned Headline (Spans 6 columns) */}
            <div className="lg:col-span-6 flex flex-col items-start text-left">
              
              <h1 className="font-serif text-4xl sm:text-5xl lg:text-6.5xl font-medium tracking-tight text-[#263A2D] leading-[1.1] mb-6">
                O direito de se tratar com <ShinyText text="segurança" className="text-emerald-850 italic font-normal inline-block" color="#065f46" shineColor="#C7E950" /> e sem <span className="text-[#263A2D] font-semibold">discriminação</span>.
              </h1>

              {/* Sub-headline */}
              <p className="max-w-2xl text-base md:text-lg text-zinc-650 leading-relaxed mb-8 font-medium">
                Protegemos judicialmente o seu tratamento com Cannabis Medicinal. Garantimos por meio de <strong>Habeas Corpus preventivo</strong> a liberdade e a segurança jurídica para você cultivar ou importar o seu remédio de forma legal, livre de repressão criminal, preconceitos ou assédio.
              </p>

              {/* CTA Actions */}
              <div className="flex flex-row gap-3 w-full flex-wrap">
                <a
                  href="/quiz"
                  className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-full text-xs font-bold uppercase tracking-wider text-white bg-[#263A2D] border-2 border-zinc-700 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all duration-200 cursor-pointer whitespace-nowrap"
                >
                  <ArrowRight size={14} />
                  <span>Avaliação Gratuita</span>
                </a>
                <a
                  href="https://wa.me/5548998003471?text=Olá,%20Dr.%20Amado.%20Gostaria%20de%20conversar%20sobre%20o%20Habeas%20Corpus%20para%20cultivo%20medicinal."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-full text-xs font-bold uppercase tracking-wider text-[#263A2D] bg-transparent border-2 border-zinc-300 hover:border-zinc-500 transition-all duration-200 cursor-pointer whitespace-nowrap"
                >
                  <MessageSquare size={14} />
                  <span>Falar pelo WhatsApp</span>
                </a>
              </div>

            </div>

            {/* Hero Right - Carousel */}
            <HeroCarousel />
          </div>
          
        </section>
      </div>

      {/* Specialized Services Section - Cannabis Green Background */}
      <section id="atuacao" className="relative bg-[#263A2D] text-white py-20 scroll-mt-24 border-y-2 border-zinc-700">
        <div className="max-w-6xl mx-auto px-6">
          
          {/* Section Heading */}
          <div className="text-left max-w-3xl mb-14">
            <div className="text-xs uppercase tracking-widest text-gold-light font-bold mb-2">Amparo e Proteção Integral</div>
            <h2 className="font-serif text-3xl md:text-4xl lg:text-4.5xl font-medium text-white tracking-tight mb-4">
              Como Asseguramos o Seu Tratamento
            </h2>
            <div className="h-[3px] bg-[#375a40] w-24 mb-4 border border-zinc-700" />
            <p className="text-zinc-350 text-sm md:text-base max-w-xl leading-relaxed font-medium">
              Eliminamos os entraves burocráticos e o preconceito social. Atuamos com soluções judiciais robustas e amparo técnico para blindar a sua saúde.
            </p>
          </div>

          {/* Practice Areas Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {services.map((service, index) => (
              <div 
                key={index}
                className="group bg-[#1a2d21] border-2 border-zinc-700 rounded-2xl p-7 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between"
              >
                <div>
                  {/* Visual Image Header */}
                  <div className="relative w-full h-48 overflow-hidden rounded-xl mb-6 bg-emerald-950/20 border-2 border-zinc-700 shadow-inner">
                    <Image
                      src={service.image}
                      alt={service.title}
                      fill
                      sizes="(max-width: 768px) 100vw, 50vw"
                      className="object-cover group-hover:scale-102 transition-transform duration-500"
                    />
                  </div>

                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-[#285E31] border-2 border-zinc-700 flex items-center justify-center flex-shrink-0">
                      {service.icon}
                    </div>
                    <h3 className="font-serif text-lg text-white font-bold group-hover:text-gold transition-colors duration-300 leading-snug">
                      {service.title}
                    </h3>
                  </div>

                  <p className="text-sm text-zinc-350 leading-relaxed mb-6 font-medium">
                    {service.description}
                  </p>
                </div>
                <a 
                  href={`https://wa.me/5548998003471?text=Olá Dr. Amado. Gostaria de entender mais sobre o serviço: ${service.title}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gold hover:text-gold-light transition-colors duration-300"
                >
                  <span>Falar com especialista</span>
                  <ExternalLink size={12} />
                </a>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* A Jornada do Acesso Legal Section - Clean White Background */}
      <section id="jornada" className="relative bg-white py-20 scroll-mt-24">
        <div className="max-w-6xl mx-auto px-6">
          
          {/* Section Heading */}
          <div className="text-left max-w-3xl mb-16">
            <div className="text-xs uppercase tracking-widest text-emerald-800 font-bold mb-2">Simplicidade & Segurança</div>
            <h2 className="font-serif text-3xl md:text-4xl lg:text-4.5xl font-medium text-[#263A2D] tracking-tight mb-4">
              A Jornada do Seu Acesso Legal
            </h2>
            <div className="h-[2px] bg-zinc-900 w-24 mb-4" />
            <p className="text-zinc-650 text-sm md:text-base max-w-xl leading-relaxed font-medium">
              Estruturamos um caminho claro e descomplicado para você obter o seu medicamento pago pelo convênio ou cultivar com salvo-conduto judicial.
            </p>
          </div>

          {/* Steps Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 relative">
            {steps.map((step, index) => (
              <div key={index} className="relative flex flex-col items-start bg-[#FAF8F5] border-2 border-zinc-700 rounded-2xl p-6 shadow-[4px_4px_0px_0px_#263A2D]">
                {/* Step Number Badge */}
                <div className="text-xs font-mono font-bold text-zinc-900 bg-white border-2 border-zinc-700 rounded-full w-8 h-8 flex items-center justify-center mb-5">
                  {step.number}
                </div>
                <h3 className="font-serif text-base text-[#263A2D] font-bold mb-3">
                  {step.title}
                </h3>
                <p className="text-xs text-zinc-650 leading-relaxed font-medium">
                  {step.description}
                </p>
              </div>
            ))}
          </div>

          <div className="flex justify-center mt-12">
            <a
              href="https://wa.me/5548998003471?text=Olá,%20Dr.%20Amado.%20Gostaria%20de%20avaliar%20meu%20caso."
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-8 py-3.5 rounded-full text-xs font-bold uppercase tracking-wider text-white bg-[#263A2D] border-2 border-zinc-700 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all duration-200 cursor-pointer"
            >
              <span>Avaliar meu caso gratuitamente</span>
              <ArrowRight size={14} />
            </a>
          </div>

        </div>
      </section>

      {/* Testimonials Section - Cannabis Green Background */}
      <section id="depoimentos" className="relative bg-[#263A2D] text-white py-20 scroll-mt-24 border-t-2 border-zinc-700">
        <div className="max-w-6xl mx-auto px-6">
          
          {/* Section Heading */}
          <div className="text-left max-w-3xl mb-14">
            <div className="text-xs uppercase tracking-widest text-gold-light font-bold mb-2">Vitórias reais, histórias de superação</div>
            <h2 className="font-serif text-3xl md:text-4xl lg:text-4.5xl font-medium text-white tracking-tight mb-4">
              Depoimentos de Pacientes e Famílias
            </h2>
            <div className="h-[2px] bg-[#375a40] w-24 mb-4" />
            <p className="text-zinc-300 text-sm md:text-base max-w-xl leading-relaxed font-medium">
              O maior testemunho da nossa dedicação profissional é a paz de espírito e a segurança conquistadas de forma legítima por nossos clientes.
            </p>
          </div>

          {/* Testimonials Grid (4 Reviews, all 9:16 aspect ratio in a spacious 2x2 layout) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-stretch max-w-5xl mx-auto">
            {reviews.map((review, index) => (
              <div 
                key={index} 
                className="relative w-full aspect-[9/16] overflow-hidden rounded-3xl border-[3px] border-zinc-700 bg-zinc-950 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"
              >
                {review.type === "video" ? (
                  <video 
                    src={review.src} 
                    controls 
                    preload="metadata"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full relative">
                    <Image
                      src={review.src}
                      alt={review.title}
                      fill
                      sizes="(max-width: 768px) 100vw, 50vw"
                      className="object-contain bg-zinc-900"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* Instagram Section - Warm Sand Background */}
      <section id="instagram" className="relative bg-[#FAF8F5] text-zinc-850 py-20 scroll-mt-24 border-t-2 border-zinc-700">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            
            {/* Left Column: Call to Action (Spans 5 columns) */}
            <div className="lg:col-span-5 text-left flex flex-col items-start">
              <div className="text-xs uppercase tracking-widest text-emerald-800 font-bold mb-2">Conexão & Informação Diária</div>
              <h2 className="font-serif text-3xl md:text-4xl font-medium text-[#263A2D] tracking-tight mb-4 animate-fade-in">
                Acompanhe o Nosso Trabalho no Instagram
              </h2>
              <div className="h-[3px] bg-zinc-700 w-24 mb-6 border border-zinc-700" />
              
              <p className="text-zinc-650 text-sm md:text-base leading-relaxed mb-6 font-medium">
                Siga **@eamadojunior** para ter acesso a conteúdos diários sobre regulamentação da Cannabis medicinal, decisões judiciais de destaque, salvos-condutos conquistados e informativos de saúde e bioética.
              </p>

              {/* Instagram Stats Mockup for Neo-Brutalist authority */}
              <div className="grid grid-cols-3 gap-4 w-full max-w-sm mb-8 bg-white border-2 border-zinc-700 rounded-2xl p-4 shadow-[4px_4px_0px_0px_#263A2D]">
                <div className="text-center">
                  <div className="font-serif text-sm text-[#263A2D] font-bold">@eamadojunior</div>
                  <div className="text-[9px] text-zinc-400 uppercase tracking-wider font-bold">Perfil Oficial</div>
                </div>
                <div className="text-center border-x border-zinc-200">
                  <div className="font-serif text-sm text-[#263A2D] font-bold">Informativo</div>
                  <div className="text-[9px] text-zinc-400 uppercase tracking-wider font-bold">Conteúdo</div>
                </div>
                <div className="text-center">
                  <div className="font-serif text-sm text-[#263A2D] font-bold">Diário</div>
                  <div className="text-[9px] text-zinc-400 uppercase tracking-wider font-bold">Atualizações</div>
                </div>
              </div>

              <a 
                href="https://www.instagram.com/eamadojunior"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full text-xs font-bold uppercase tracking-wider text-white bg-[#263A2D] hover:bg-[#285E31] border-2 border-zinc-700 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all duration-200 cursor-pointer w-full sm:w-auto text-center font-bold"
              >
                <span>Seguir @eamadojunior</span>
                <ExternalLink size={14} />
              </a>
            </div>

            {/* Right Column: Embedded Instagram Iframe inside Neo-Brutalist Frame (Spans 7 columns) */}
            <div className="lg:col-span-7 flex justify-center w-full">
              <div className="relative w-full aspect-[4/5] md:aspect-[3/4] lg:aspect-[4/5] max-w-lg rounded-3xl border-2 border-zinc-700 bg-white shadow-[8px_8px_0px_0px_#263A2D] overflow-hidden">
                {/* Embedded Instagram Iframe */}
                <iframe
                  src="https://www.instagram.com/eamadojunior/embed/"
                  className="w-full h-full border-none"
                  allowFullScreen
                  scrolling="no"
                  loading="lazy"
                />
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Credibility Section */}
      <section id="midia" className="relative bg-white py-20 scroll-mt-24 border-t-2 border-zinc-700">
        <div className="max-w-6xl mx-auto px-6">

          <div className="text-left max-w-3xl mb-14">
            <div className="text-xs uppercase tracking-widest text-emerald-800 font-bold mb-2">Presença & Autoridade</div>
            <h2 className="font-serif text-3xl md:text-4xl font-medium text-[#263A2D] tracking-tight mb-4">
              Referência em Direito Canábico
            </h2>
            <div className="h-[2px] bg-zinc-900 w-24 mb-4" />
            <p className="text-zinc-600 text-sm md:text-base leading-relaxed font-medium">
              Eduardo Amado Jr. é convidado recorrente em podcasts e veículos de comunicação especializados — reconhecido por sua atuação técnica e engajamento real com a causa cannábica no Brasil.
            </p>
          </div>

          {/* Podcasts — thumbnail cards */}
          <div className="mb-10">
            <p className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold mb-5">Podcasts — convidado</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { id: "9Iw5yzoTK08", label: "Episódio 01" },
                { id: "-gMpTPP09_k", label: "Episódio 02" },
                { id: "vqCVkg480vg", label: "Episódio 03" },
              ].map((pod) => (
                <a
                  key={pod.id}
                  href={`https://www.youtube.com/watch?v=${pod.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex flex-col gap-2"
                >
                  <div className="relative rounded-2xl border-2 border-zinc-700 shadow-[4px_4px_0px_0px_#263A2D] overflow-hidden aspect-video group-hover:translate-x-[2px] group-hover:translate-y-[2px] group-hover:shadow-[2px_2px_0px_0px_#263A2D] transition-all duration-200">
                    <Image
                      src={`https://i.ytimg.com/vi/${pod.id}/hqdefault.jpg`}
                      alt={pod.label}
                      fill
                      sizes="(max-width: 768px) 100vw, 33vw"
                      loading="eager"
                      className="object-cover"
                    />
                    {/* Play overlay */}
                    <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                        <svg width="18" height="20" viewBox="0 0 18 20" fill="none">
                          <path d="M2 1L16 10L2 19V1Z" fill="#263A2D" stroke="#263A2D" strokeWidth="1.5" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold pl-1">{pod.label}</span>
                </a>
              ))}
            </div>
          </div>

          {/* Imprensa */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold mb-5">Imprensa</p>
            <a
              href="https://www.conviccaonews.com.br/noticia/13009/florianopolis/noticias/eduardo-amado-junior-inova-e-estreia-ganjaflix.html"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col sm:flex-row gap-0 bg-[#FAF8F5] border-2 border-zinc-700 rounded-2xl shadow-[4px_4px_0px_0px_#263A2D] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_#263A2D] transition-all duration-200 overflow-hidden max-w-2xl"
            >
              <div className="relative w-full sm:w-36 flex-shrink-0 aspect-[9/16] sm:aspect-auto">
                <Image
                  src="/assets/eduardo-amado-junior-inova-e-estreia-ganjaflix.jpeg"
                  alt="Eduardo Amado Junior — Convicção News"
                  fill
                  sizes="144px"
                  className="object-cover object-top"
                />
                <div className="absolute top-2 left-2 bg-white/90 border border-zinc-300 rounded px-1.5 py-0.5">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-800">Convicção News</span>
                </div>
              </div>
              <div className="flex flex-col justify-center gap-2 p-5">
                <h3 className="font-serif text-base font-bold text-[#263A2D] leading-snug group-hover:text-emerald-800 transition-colors">
                  Eduardo Amado Junior inova e estreia o Ganjaflix
                </h3>
                <p className="text-xs text-zinc-500 leading-relaxed font-medium">
                  Iniciativa pioneira do advogado em educação e conteúdo sobre Direito Canábico no Brasil.
                </p>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-[#263A2D] group-hover:underline mt-1">
                  Ler matéria <ExternalLink size={10} />
                </span>
              </div>
            </a>
          </div>
        </div>
      </section>

      {/* About Section - Cannabis Green Background */}
      <section id="sobre" className="relative bg-[#263A2D] text-white py-20 scroll-mt-24 border-t-2 border-zinc-700">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            
            {/* About Copywriting Left */}
            <div className="lg:col-span-7 text-left">
              <div className="text-xs uppercase tracking-widest text-gold-light font-bold mb-2">Um escritório de pai e filho</div>
              <h2 className="font-serif text-3xl md:text-4xl lg:text-4.5xl font-medium text-white tracking-tight mb-6">
                Missão: discriminar, desburocratizar e lucrar com a planta
              </h2>
              <div className="h-[2px] bg-[#375a40] w-24 mb-6" />

              <div className="space-y-5 text-zinc-300 text-sm md:text-base leading-relaxed font-medium">
                <p>
                  O escritório <strong>Amado & Amado Jr.</strong> nasceu da união de duas gerações do Direito. <strong>Amado</strong>, bacharel em Direito pela UFSC (1983), traz décadas de experiência processual e a solidez técnica de quem construiu carreira sob os pilares da ética e do rigor. <strong>Eduardo Amado Jr.</strong>, bacharel em Direito (2024) e especialista em Direito Canábico, ingressou na advocacia com um propósito claro: tornar o acesso legal à Cannabis medicinal uma realidade acessível, segura e sem burocracia para cada brasileiro.
                </p>
                <p>
                  Desde 2022, Eduardo Amado Jr. acumula vasta experiência no campo do Direito Canábico, tendo conquistado mais de <strong>300 Habeas Corpus preventivos — todos deferidos</strong>. Além disso, estruturou juridicamente 2 associações de pacientes e legalizou 5 fazendas de Cannabis medicinal com fins lucrativos, todas autorizadas pela <strong>RDC 1013 da ANVISA</strong>.
                </p>
                <p>
                  O atendimento é realizado presencialmente em <strong>Florianópolis/SC</strong> e por videochamada em todo o Brasil — porque o Direito à saúde não tem fronteira.
                </p>
              </div>

              {/* Custom Quote Callout - Comic-Bubble Inspired styling */}
              <div className="relative pl-5 py-2.5 mt-8 bg-white border-2 border-l-[6px] border-zinc-700 rounded-r-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <p className="font-serif italic text-zinc-700 text-sm md:text-base leading-relaxed font-medium">
                  &ldquo;No final, você terá o direito de estar sempre na razão perante seus pares — ou de lucrar legalmente com a Cannabis no Brasil. Essa é a transformação que entregamos.&rdquo;
                </p>
                <footer className="text-xs uppercase tracking-wider text-emerald-900 font-bold mt-2">
                  — Eduardo Amado Jr.
                </footer>
              </div>
            </div>

            {/* About Credentials Right */}
            <div className="lg:col-span-5 bg-[#FAF8F5] border-2 border-zinc-700 rounded-3xl p-7 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
              <h3 className="font-serif text-xl text-[#263A2D] font-bold mb-5">Resultados Reais</h3>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-white border-2 border-zinc-700 rounded-2xl p-4 shadow-[3px_3px_0px_0px_#263A2D] text-center">
                  <div className="font-serif text-3xl font-bold text-[#263A2D]">+300</div>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mt-1">Habeas Corpus<br/>todos deferidos</div>
                </div>
                <div className="bg-white border-2 border-zinc-700 rounded-2xl p-4 shadow-[3px_3px_0px_0px_#263A2D] text-center">
                  <div className="font-serif text-3xl font-bold text-[#263A2D]">5</div>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mt-1">Fazendas<br/>legalizadas RDC 1013</div>
                </div>
                <div className="bg-white border-2 border-zinc-700 rounded-2xl p-4 shadow-[3px_3px_0px_0px_#263A2D] text-center">
                  <div className="font-serif text-3xl font-bold text-[#263A2D]">2</div>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mt-1">Associações<br/>abertas</div>
                </div>
                <div className="bg-white border-2 border-zinc-700 rounded-2xl p-4 shadow-[3px_3px_0px_0px_#263A2D] text-center">
                  <div className="font-serif text-3xl font-bold text-[#263A2D]">2022</div>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mt-1">Atuando em<br/>Direito Canábico</div>
                </div>
              </div>

              <ul className="space-y-3">
                <li className="flex gap-3">
                  <CheckCircle2 className="text-[#285E31] flex-shrink-0 mt-0.5" size={16} />
                  <p className="text-xs text-zinc-600 leading-relaxed font-medium">Presencial em Florianópolis/SC — Videochamada em todo o Brasil</p>
                </li>
                <li className="flex gap-3">
                  <CheckCircle2 className="text-[#285E31] flex-shrink-0 mt-0.5" size={16} />
                  <p className="text-xs text-zinc-600 leading-relaxed font-medium">Especialista em HC preventivo, associações e empresas cannábicas (RDC 1013)</p>
                </li>
                <li className="flex gap-3">
                  <CheckCircle2 className="text-[#285E31] flex-shrink-0 mt-0.5" size={16} />
                  <p className="text-xs text-zinc-600 leading-relaxed font-medium">Sigilo médico-jurídico absoluto. Segredo de Justiça garantido por lei.</p>
                </li>
              </ul>

              <div className="mt-6 pt-5 border-t border-zinc-200 flex items-center justify-between text-xs font-bold">
                <span className="text-zinc-700">Pai & Filho · Duas gerações</span>
                <span className="text-emerald-800 font-bold uppercase tracking-wider">Desde 2022</span>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* FAQ Accordion Section - Clean White Background */}
      <section id="faq" className="relative bg-white text-zinc-850 py-20 scroll-mt-24 border-y-2 border-zinc-700">
        <div className="max-w-4xl mx-auto px-6">
          
          {/* Heading */}
          <div className="text-left max-w-2xl mb-12">
            <div className="text-xs uppercase tracking-widest text-emerald-800 font-bold mb-2">Esclareça suas dúvidas</div>
            <h2 className="font-serif text-3xl font-medium text-[#263A2D] tracking-tight mb-4">
              Perguntas e Respostas
            </h2>
            <div className="h-[2px] bg-zinc-700 w-24 mb-4" />
            <p className="text-zinc-650 text-sm md:text-base font-medium">
              Compreenda os principais aspectos legais sobre o salvo-conduto do cultivo doméstico e as liminares médicas.
            </p>
          </div>

          {/* Accordions with Comic Panels Outlines */}
          <div className="space-y-4">
            {faqItems.map((item, index) => {
              const isOpen = openFaq === index;
              return (
                <div 
                  key={index}
                  className="bg-white border-2 border-zinc-700 rounded-xl overflow-hidden transition-all duration-300 shadow-[4px_4px_0px_0px_#263A2D]"
                >
                  <button
                    onClick={() => toggleFaq(index)}
                    className="w-full flex items-center justify-between p-5 text-left focus:outline-none"
                  >
                    <span className="font-serif text-base text-[#263A2D] font-bold pr-6 hover:text-[#285E31] transition-colors duration-300">
                      {item.question}
                    </span>
                    <div className={`p-1.5 rounded-full border-2 border-zinc-700 text-[#285E31] flex-shrink-0 transition-transform duration-300 bg-[#FAF8F5] ${isOpen ? "rotate-180" : ""}`}>
                      <ChevronDown size={14} />
                    </div>
                  </button>
                  <div 
                    className={`transition-all duration-300 ease-in-out overflow-hidden ${
                      isOpen ? "max-h-[300px] border-t-2 border-zinc-700" : "max-h-0"
                    }`}
                  >
                    <p className="p-5 text-sm text-zinc-650 leading-relaxed bg-[#FAF8F5] font-medium">
                      {item.answer}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* Contact Section */}
      <section id="contato" className="relative bg-[#263A2D] text-white py-20 scroll-mt-24 border-t-2 border-zinc-700">
        <div className="max-w-6xl mx-auto px-6">

          <div className="text-left max-w-2xl mb-12">
            <div className="text-xs uppercase tracking-widest text-gold-light font-bold mb-2">Canal de Atendimento</div>
            <h2 className="font-serif text-3xl md:text-4xl lg:text-4.5xl font-medium text-white tracking-tight mb-4">
              Inicie Seu Acolhimento
            </h2>
            <div className="h-[2px] bg-[#375a40] border border-zinc-700 w-24 mb-4" />
            <p className="text-zinc-300 text-sm md:text-base leading-relaxed font-medium">
              Compartilhe as particularidades do seu caso. Garantimos absoluto sigilo profissional e retorno célere.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">

            {/* Info Card Left */}
            <div className="lg:col-span-5 flex flex-col justify-between bg-white border-2 border-zinc-700 rounded-3xl p-7 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
              <div>
                <h3 className="font-serif text-xl text-[#263A2D] font-bold mb-5">Dados do Escritório</h3>
                <div className="space-y-5">
                  <div className="flex gap-3.5">
                    <div className="w-9 h-9 rounded-lg bg-[#FAF8F5] border-2 border-zinc-700 text-[#285E31] flex items-center justify-center flex-shrink-0">
                      <MapPin size={16} />
                    </div>
                    <div>
                      <h4 className="text-[10px] uppercase tracking-wider text-zinc-550 font-bold">Localização</h4>
                      <p className="text-xs text-zinc-600 mt-0.5 font-medium">
                        Rua Doutor Heitor Blum, 310 — Sala 801<br />Florianópolis/SC, CEP 88075-110
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3.5">
                    <div className="w-9 h-9 rounded-lg bg-[#FAF8F5] border-2 border-zinc-700 text-[#285E31] flex items-center justify-center flex-shrink-0">
                      <Mail size={16} />
                    </div>
                    <div>
                      <h4 className="text-[10px] uppercase tracking-wider text-zinc-550 font-bold">E-mail</h4>
                      <p className="text-xs text-zinc-600 mt-0.5 font-medium">contato@amadoeamadojr.com.br</p>
                    </div>
                  </div>
                  <div className="flex gap-3.5">
                    <div className="w-9 h-9 rounded-lg bg-[#FAF8F5] border-2 border-zinc-700 text-[#285E31] flex items-center justify-center flex-shrink-0">
                      <MessageSquare size={16} />
                    </div>
                    <div>
                      <h4 className="text-[10px] uppercase tracking-wider text-zinc-550 font-bold">WhatsApp</h4>
                      <p className="text-xs text-zinc-600 mt-0.5 font-medium">(48) 99800-3471</p>
                    </div>
                  </div>
                  <div className="flex gap-3.5">
                    <div className="w-9 h-9 rounded-lg bg-[#FAF8F5] border-2 border-zinc-700 text-[#285E31] flex items-center justify-center flex-shrink-0">
                      <FileText size={16} />
                    </div>
                    <div>
                      <h4 className="text-[10px] uppercase tracking-wider text-zinc-550 font-bold">Formação</h4>
                      <p className="text-xs text-zinc-600 mt-0.5 font-medium">Bacharel em Direito · Especialista em Direito Canábico</p>
                    </div>
                  </div>
                  <div className="flex gap-3.5">
                    <div className="w-9 h-9 rounded-lg bg-[#FAF8F5] border-2 border-zinc-700 text-[#285E31] flex items-center justify-center flex-shrink-0">
                      <Users size={16} />
                    </div>
                    <div>
                      <h4 className="text-[10px] uppercase tracking-wider text-zinc-550 font-bold">Atendimento</h4>
                      <p className="text-xs text-zinc-600 mt-0.5 font-medium">Presencial em Florianópolis/SC<br />Videochamada em todo o Brasil</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-8 pt-6 border-t border-zinc-200 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full border-2 border-zinc-700 flex items-center justify-center text-emerald-900 bg-emerald-50">
                  <Users size={16} />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-zinc-550 font-bold">Segurança e Sigilo</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5 leading-none">Proteção legal completa dos seus dados.</p>
                </div>
              </div>
            </div>

            {/* Quiz CTA Right */}
            <div className="lg:col-span-7 bg-white border-2 border-zinc-700 rounded-3xl p-8 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between">
              <div>
                <div className="text-xs uppercase tracking-widest text-[#285E31] font-bold mb-3">Avaliação Gratuita</div>
                <h3 className="font-serif text-2xl md:text-3xl text-[#263A2D] font-medium mb-4 leading-snug">
                  Descubra como podemos proteger o seu caso
                </h3>
                <div className="h-[2px] bg-zinc-200 w-16 mb-6" />
                <ul className="space-y-3 mb-8">
                  {[
                    "Entendemos o seu perfil em minutos",
                    "Identificamos a melhor estratégia jurídica",
                    "Sem compromisso, sem custo",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-3 text-sm text-zinc-600 font-medium">
                      <CheckCircle2 size={16} className="text-[#285E31] flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href="/quiz"
                  className="flex items-center justify-center gap-2 px-6 py-4 rounded-full text-sm font-bold uppercase tracking-wider text-white bg-[#263A2D] border-2 border-zinc-700 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all duration-200"
                >
                  <ArrowRight size={16} />
                  <span>Iniciar Avaliação</span>
                </a>
                <a
                  href="https://wa.me/5548998003471?text=Olá,%20Dr.%20Amado.%20Gostaria%20de%20conversar%20sobre%20o%20meu%20caso."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-6 py-4 rounded-full text-sm font-bold uppercase tracking-wider text-[#263A2D] border-2 border-zinc-300 hover:border-zinc-500 transition-all duration-200"
                >
                  <MessageSquare size={16} />
                  <span>WhatsApp</span>
                </a>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />

      {/* Floating WhatsApp contact */}
      <WhatsAppFloat />
    </div>
  );
}

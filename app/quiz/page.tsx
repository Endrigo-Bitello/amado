import Quiz from "@/components/Quiz/Quiz";
import Navbar from "@/components/Navbar";
import FooterBackground from "@/components/Footer/components/footer-background";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Avaliação Gratuita | Amado & Amado Jr. Advogados",
  description: "Responda algumas perguntas e nossa equipe analisará o seu perfil para direcionar o melhor atendimento em Direito Cannábico.",
};

export default function QuizPage() {
  return (
    <div className="min-h-screen relative bg-[#FAF8F5] font-sans antialiased">
      <Navbar />

      <div className="relative w-full overflow-hidden">
        <div className="absolute inset-0 z-0 pointer-events-none opacity-30">
          <FooterBackground className="w-full h-full object-cover" />
        </div>

        <main className="relative z-10 max-w-2xl mx-auto px-6 pt-32 pb-20">
          <div className="text-left mb-10">
            <div className="text-xs uppercase tracking-widest text-[#263A2D] font-bold mb-2">Avaliação Gratuita</div>
            <h1 className="font-serif text-3xl md:text-4xl font-medium text-[#263A2D] tracking-tight mb-4">
              Entenda como podemos ajudar o seu caso
            </h1>
            <div className="h-[3px] bg-zinc-200 w-24 mb-4" />
            <p className="text-zinc-500 text-sm md:text-base leading-relaxed">
              Responda algumas perguntas rápidas e nossa equipe analisará o seu perfil para direcionar o melhor atendimento.
            </p>
          </div>

          <div className="bg-white rounded-3xl border-2 border-zinc-200 shadow-[6px_6px_0px_0px_#263A2D] p-8">
            <Quiz />
          </div>
        </main>
      </div>
    </div>
  );
}

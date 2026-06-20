import Quiz from "@/components/Quiz/Quiz";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Avaliação Gratuita | Amado & Amado Jr. Advogados",
  description: "Responda algumas perguntas e nossa equipe analisará o seu perfil para direcionar o melhor atendimento em Direito Cannábico.",
};

export default function QuizPage() {
  return (
    <div className="relative min-h-screen bg-[#FAF8F5] font-sans antialiased flex flex-col px-4 py-6 sm:py-10">
      <a
        href="/"
        aria-label="Voltar ao site"
        className="absolute left-4 top-4 sm:left-6 sm:top-6 z-10 flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 hover:text-[#263A2D] hover:bg-zinc-200/60 transition-colors"
      >
        <ArrowLeft size={18} />
      </a>
      <div className="flex-1 flex justify-center pt-8 sm:pt-16">
        <div className="w-full max-w-xl">
          <Quiz />
        </div>
      </div>
    </div>
  );
}

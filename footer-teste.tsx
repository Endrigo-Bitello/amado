import React from 'react';
import { MessageSquare } from 'lucide-react';
import FooterBackground from '@/components/Footer/components/footer-background';

const Footer = () => {
  return (
    <footer className="relative bg-white py-16 px-6 overflow-hidden z-10 border-t-2 border-zinc-700">
      {/* SVG Glow Background - visible through the glass container */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-50">
        <FooterBackground className="w-full h-full object-cover" />
      </div>

      {/* Floating Glassmorphic Container */}
      <div className="relative max-w-6xl mx-auto z-10 bg-white/25 backdrop-blur-xl border-2 border-zinc-700 rounded-[32px] p-8 md:p-12 shadow-[6px_6px_0px_0px_#263A2D]">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 mb-12">
          
          {/* Column 1: Branding */}
          <div className="md:col-span-5 flex flex-col items-start text-left">
            <a 
              href="#inicio" 
              className="font-serif tracking-wider text-xl md:text-2xl text-[#263A2D] hover:text-[#285E31] transition-colors duration-300 font-bold block mb-4"
            >
              Amado <span className="text-emerald-800 font-light">Jr.</span>
            </a>
            <p className="text-xs text-zinc-650 leading-relaxed max-w-sm mb-6 font-medium">
              Escritório boutique especializado na garantia do acesso seguro à Cannabis Medicinal. Amparo técnico para Habeas Corpus preventivo de cultivo próprio e judicialização de tratamentos de saúde de alta complexidade.
            </p>
            <a 
              href="https://wa.me/5548998003471?text=Olá, Dr. Amado."
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider text-white bg-[#263A2D] hover:bg-[#285E31] border-2 border-zinc-700 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all duration-200"
            >
              <MessageSquare size={12} />
              <span>Falar com Especialista</span>
            </a>
          </div>

          {/* Column 2: OAB Compliance & Ethics */}
          <div className="md:col-span-4 text-left">
            <h4 className="text-[10px] uppercase tracking-widest text-[#285E31] font-bold mb-4">Compromisso & Publicidade</h4>
            <p className="text-[10px] text-zinc-550 leading-relaxed font-medium">
              Atuação em estrita observância ao Código de Ética e Disciplina da OAB e ao Provimento 205/2021. Este material possui caráter estritamente educativo e informativo sobre direitos dos pacientes, sendo vedada qualquer promessa de resultado judicial ou mercantilização jurídica.
            </p>
          </div>

          {/* Column 3: Quick Links */}
          <div className="md:col-span-3 text-left">
            <h4 className="text-[10px] uppercase tracking-widest text-[#285E31] font-bold mb-4">Navegação</h4>
            <ul className="space-y-2 text-xs text-zinc-600 font-bold">
              <li>
                <a href="#inicio" className="hover:text-emerald-800 transition-colors duration-300">Início</a>
              </li>
              <li>
                <a href="#atuacao" className="hover:text-emerald-800 transition-colors duration-300">Amparo Técnico</a>
              </li>
              <li>
                <a href="#depoimentos" className="hover:text-emerald-800 transition-colors duration-300">Depoimentos</a>
              </li>
              <li>
                <a href="#sobre" className="hover:text-emerald-800 transition-colors duration-300">Sobre o Advogado</a>
              </li>
              <li>
                <a href="#faq" className="hover:text-emerald-800 transition-colors duration-300">Dúvidas Frequentes</a>
              </li>
            </ul>
          </div>

        </div>

        {/* Footer Bottom Credentials */}
        <div className="pt-8 border-t border-zinc-700/20 flex flex-col sm:flex-row items-center justify-between text-xs text-zinc-500 gap-4">
          <span className="font-semibold text-zinc-500">&copy; {new Date().getFullYear()} Amado Jr. Todos os direitos reservados.</span>
          <span className="uppercase tracking-widest text-[10px] bg-[#FAF8F5] border-2 border-zinc-700 px-3 py-1 rounded-xl text-[#263A2D] font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">OAB/SP Nº 000.000</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

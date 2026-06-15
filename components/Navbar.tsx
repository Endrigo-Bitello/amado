"use client";

import React, { useState, useEffect } from "react";
import { Menu, X, ArrowUpRight, MessageSquare } from "lucide-react";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Add scroll listener to update styling slightly when scrolled
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { name: "Início", href: "#inicio" },
    { name: "Áreas de Atuação", href: "#atuacao" },
    { name: "Depoimentos", href: "#depoimentos" },
    { name: "Sobre", href: "#sobre" },
    { name: "Dúvidas", href: "#faq" },
    { name: "Contato", href: "#contato" },
  ];

  return (
    <>
      <header className="fixed top-6 left-1/2 -translate-x-1/2 w-[92%] max-w-6xl z-50 transition-all duration-300">
        <div className="relative w-full rounded-full border-2 border-zinc-700 bg-[#3D7B3E]/95 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] py-3 px-8">
          <div className="flex items-center justify-between">
            {/* Elegant Serif Logo */}
            <a
              href="#inicio"
              className="font-serif tracking-wider text-xl md:text-2xl text-white hover:text-gold transition-colors duration-300 font-medium"
            >
              Amado <span className="text-gold-light font-light">&amp; Amado Jr.</span>
            </a>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-6">
              {navLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  className="relative text-sm font-semibold text-zinc-200 hover:text-white transition-colors duration-300 py-1 group"
                >
                  {link.name}
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-[2px] bg-gold-light transition-all duration-300 group-hover:w-full font-bold"></span>
                </a>
              ))}
            </nav>

            {/* Desktop CTA Action Button */}
            <div className="hidden lg:block">
              <a
                href="https://wa.me/5511999999999?text=Olá,%20Dr.%20Eduardo.%20Gostaria%20de%20agendar%20uma%20consulta."
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-5 py-2 rounded-full text-xs font-bold uppercase tracking-wider text-emerald-950 bg-gold border-2 border-zinc-700 hover:bg-gold-light shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all duration-200 cursor-pointer"
              >
                <MessageSquare size={14} />
                <span>Consulta Online</span>
              </a>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="lg:hidden p-1.5 rounded-full text-zinc-200 hover:text-white hover:bg-[#375a40]/30 transition-colors duration-300 focus:outline-none border border-transparent active:border-white"
              aria-label="Toggle Menu"
            >
              {isOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>

          {/* Mobile Dropdown Menu */}
          <div
            className={`absolute top-full left-0 right-0 mt-3 p-6 bg-[#263A2D]/98 border-2 border-zinc-700 rounded-3xl shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex flex-col gap-5 lg:hidden transition-all duration-300 origin-top transform ${isOpen
                ? "scale-100 opacity-100 visible"
                : "scale-95 opacity-0 invisible"
              }`}
          >
            <nav className="flex flex-col gap-4">
              {navLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className="text-base font-semibold text-zinc-200 hover:text-white transition-colors duration-300 py-1.5 border-b border-[#375a40]/20"
                >
                  {link.name}
                </a>
              ))}
            </nav>
            <a
              href="https://wa.me/5511999999999?text=Olá,%20Dr.%20Eduardo.%20Gostaria%20de%20agendar%20uma%20consulta."
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-center gap-2 w-full px-5 py-3 rounded-full text-sm font-bold uppercase tracking-wider text-emerald-950 bg-gold border-2 border-zinc-700 hover:bg-gold-light shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
            >
              <MessageSquare size={16} />
              <span>Consulta Online</span>
              <ArrowUpRight size={16} />
            </a>
          </div>
        </div>
      </header>
    </>
  );
}

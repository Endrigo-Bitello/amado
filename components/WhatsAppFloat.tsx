"use client";

import React from "react";
import Image from "next/image";
import WhatsAppIcon from "@/components/icons/WhatsApp";

export default function WhatsAppFloat() {
  return (
    <a
      href="https://wa.me/5548998003471?text=Olá,%20Dr.%20Amado.%20Gostaria%20de%20conversar%20sobre%20meu%20caso%20médico."
      target="_blank"
      rel="noopener noreferrer"
      draggable="false"
      className="fixed bottom-6 right-6 z-50 group flex items-center justify-center select-none"
      aria-label="Falar com Dr. Amado Jr. no WhatsApp"
    >
      {/* Avatar Container */}
      <div className="relative w-16 h-16 rounded-full bg-white shadow-xl hover:scale-105 active:scale-95 transition-all duration-300 overflow-visible">
        <Image
          src="/assets/amadowpp.png"
          alt="WhatsApp Dr. Amado Jr."
          fill
          sizes="64px"
          draggable={false}
          className="object-cover rounded-full select-none"
        />

        {/* WhatsApp Badge bottom-right */}
        <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 flex items-center justify-center drop-shadow-md">
          <WhatsAppIcon className="w-full h-full" width="100%" height="100%" draggable="false" />
        </div>
      </div>
    </a>
  );
}

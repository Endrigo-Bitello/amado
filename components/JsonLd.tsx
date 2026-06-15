export function LawFirmJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "LegalService",
    name: "Amado & Amado Jr. Advogados",
    description: "Escritório especializado em Direito Canábico e Habeas Corpus preventivo para cultivo medicinal de Cannabis no Brasil.",
    url: "https://amadoeamadojr.com.br",
    telephone: "+55-48-99800-3471",
    email: "eamadojunior@gmail.com",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Rua Doutor Heitor Blum, 310 — Sala 801",
      addressLocality: "Florianópolis",
      addressRegion: "SC",
      postalCode: "88075-110",
      addressCountry: "BR",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: -27.5954,
      longitude: -48.548,
    },
    openingHoursSpecification: {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      opens: "09:00",
      closes: "18:00",
    },
    areaServed: {
      "@type": "Country",
      name: "Brazil",
    },
    serviceType: [
      "Direito Canábico",
      "Habeas Corpus Preventivo",
      "Cannabis Medicinal",
      "Judicialização de Tratamentos",
    ],
    knowsAbout: [
      "Cannabis Medicinal",
      "Habeas Corpus",
      "Direito Canábico",
      "ANVISA",
      "Cultivo Medicinal",
    ],
    sameAs: [
      "https://www.instagram.com/eamadojunior",
    ],
    founder: {
      "@type": "Person",
      name: "Eduardo Amado Jr.",
      jobTitle: "Advogado Especialista em Direito Canábico",
      knowsAbout: ["Direito Canábico", "Habeas Corpus", "Cannabis Medicinal"],
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function BlogPostJsonLd({ title, description, slug, datePublished }: {
  title: string;
  description: string;
  slug: string;
  datePublished?: string;
}) {
  const data = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    url: `https://amadoeamadojr.com.br/blog/${slug}`,
    datePublished: datePublished ?? "2025-12-01",
    dateModified: datePublished ?? "2025-12-01",
    author: {
      "@type": "Person",
      name: "Eduardo Amado Jr.",
      url: "https://amadoeamadojr.com.br",
    },
    publisher: {
      "@type": "Organization",
      name: "Amado & Amado Jr. Advogados",
      url: "https://amadoeamadojr.com.br",
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `https://amadoeamadojr.com.br/blog/${slug}`,
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function BreadcrumbJsonLd({ items }: { items: { name: string; url: string }[] }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function FaqJsonLd({ items }: { items: { question: string; answer: string }[] }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

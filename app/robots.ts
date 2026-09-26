import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/_next/", "/crm", "/crm/", "/enviar-documentos"],
      },
    ],
    sitemap: "https://amadoeamadojr.com.br/sitemap.xml",
  };
}

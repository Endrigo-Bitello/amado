import { getAllPosts, getPost } from "@/lib/posts";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer/Footer";
import { BlogPostJsonLd, BreadcrumbJsonLd } from "@/components/JsonLd";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { Metadata } from "next";

const BASE_URL = "https://amadoeamadojr.com.br";

export async function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return {};
  const url = `${BASE_URL}/blog/${slug}`;
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      title: post.title,
      description: post.description,
      siteName: "Amado & Amado Jr. Advogados",
      locale: "pt_BR",
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
    },
  };
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const paragraphs = post.content
    .split("\n")
    .filter((l) => l.trim().length > 0);

  return (
    <div className="min-h-screen bg-[#FAF8F5] font-sans antialiased">
      <BlogPostJsonLd title={post.title} description={post.description} slug={slug} />
      <BreadcrumbJsonLd items={[
        { name: "Início", url: BASE_URL },
        { name: "Blog", url: `${BASE_URL}/blog` },
        { name: post.title, url: `${BASE_URL}/blog/${slug}` },
      ]} />
      <Navbar />

      <main className="max-w-3xl mx-auto px-6 pt-32 pb-20">
        {/* Back */}
        <a
          href="/blog"
          className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-[#263A2D] transition-colors mb-10"
        >
          <ArrowLeft size={12} /> Blog
        </a>

        {/* Header */}
        <div className="mb-10 pb-8 border-b-2 border-zinc-200">
          <div className="text-xs uppercase tracking-widest text-emerald-800 font-bold mb-3">Direito Canábico</div>
          <h1 className="font-serif text-3xl md:text-4xl font-medium text-[#263A2D] leading-tight mb-4">
            {post.title}
          </h1>
          {post.description && (
            <p className="text-zinc-500 text-base leading-relaxed font-medium">{post.description}</p>
          )}
        </div>

        {/* Content */}
        <article className="prose-custom">
          {paragraphs.map((line, i) => {
            if (line.startsWith("### ")) {
              return (
                <h3 key={i} className="font-serif text-xl font-bold text-[#263A2D] mt-8 mb-3">
                  {line.replace("### ", "")}
                </h3>
              );
            }
            if (line.startsWith("## ")) {
              return (
                <h2 key={i} className="font-serif text-2xl font-bold text-[#263A2D] mt-10 mb-4 pb-2 border-b border-zinc-200">
                  {line.replace("## ", "")}
                </h2>
              );
            }
            if (line.startsWith("# ")) {
              return (
                <h1 key={i} className="font-serif text-3xl font-bold text-[#263A2D] mt-10 mb-4">
                  {line.replace("# ", "")}
                </h1>
              );
            }
            if (line.startsWith("- ") || line.startsWith("* ")) {
              return (
                <li key={i} className="text-zinc-700 text-sm leading-relaxed ml-4 mb-1 font-medium list-disc">
                  {line.replace(/^[-*] /, "")}
                </li>
              );
            }
            return (
              <p key={i} className="text-zinc-700 text-sm md:text-base leading-relaxed mb-4 font-medium">
                {line}
              </p>
            );
          })}
        </article>

        {/* CTA */}
        <div className="mt-14 bg-[#263A2D] rounded-3xl p-8 border-2 border-zinc-700 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
          <h3 className="font-serif text-xl font-medium text-white mb-2">
            Precisa de amparo jurídico?
          </h3>
          <p className="text-zinc-300 text-sm leading-relaxed mb-6 font-medium">
            Nossa equipe é especialista em Habeas Corpus preventivo e Direito Canábico. Avalie seu caso gratuitamente.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href="/quiz"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full text-xs font-bold uppercase tracking-wider text-white bg-transparent border-2 border-white hover:bg-white hover:text-[#263A2D] transition-all duration-200"
            >
              <ArrowRight size={12} /> Avaliação Gratuita
            </a>
            <a
              href="https://wa.me/5548998003471?text=Olá,%20Dr.%20Amado.%20Li%20um%20artigo%20no%20site%20e%20gostaria%20de%20conversar."
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full text-xs font-bold uppercase tracking-wider text-[#263A2D] bg-white border-2 border-white hover:bg-zinc-100 transition-all duration-200"
            >
              Falar pelo WhatsApp
            </a>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

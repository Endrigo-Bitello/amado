import { getAllPosts } from "@/lib/posts";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer/Footer";
import FooterBackground from "@/components/Footer/components/footer-background";
import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Blog | Amado & Amado Jr. Advogados",
  description: "Artigos sobre Direito Canábico, Habeas Corpus, Cannabis Medicinal e legislação brasileira.",
};

export default function BlogPage() {
  const posts = getAllPosts();

  return (
    <div className="min-h-screen bg-[#FAF8F5] font-sans antialiased">
      <Navbar />

      <div className="relative w-full overflow-hidden">
        <div className="absolute inset-0 z-0 pointer-events-none opacity-30">
          <FooterBackground className="w-full h-full object-cover" />
        </div>

        <main className="relative z-10 max-w-6xl mx-auto px-6 pt-32 pb-20">
          <div className="mb-12">
            <div className="text-xs uppercase tracking-widest text-emerald-800 font-bold mb-2">Conteúdo & Informação</div>
            <h1 className="font-serif text-4xl md:text-5xl font-medium text-[#263A2D] tracking-tight mb-4">
              Blog Jurídico
            </h1>
            <div className="h-[2px] bg-zinc-900 w-24 mb-4" />
            <p className="text-zinc-600 text-base leading-relaxed max-w-2xl font-medium">
              Artigos sobre Cannabis Medicinal, Habeas Corpus preventivo, regulamentação ANVISA e direitos dos pacientes no Brasil.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post) => (
              <a
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="group flex flex-col bg-white border-2 border-zinc-700 rounded-2xl p-6 shadow-[4px_4px_0px_0px_#263A2D] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_#263A2D] transition-all duration-200"
              >
                <div className="flex-1">
                  <div className="w-2 h-2 rounded-full bg-emerald-700 mb-4" />
                  <h2 className="font-serif text-base font-bold text-[#263A2D] leading-snug mb-3 group-hover:text-emerald-800 transition-colors">
                    {post.title}
                  </h2>
                  {post.description && (
                    <p className="text-xs text-zinc-500 leading-relaxed font-medium line-clamp-3">
                      {post.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 mt-4 text-[10px] font-bold uppercase tracking-widest text-[#263A2D] group-hover:text-emerald-800 transition-colors">
                  <span>Ler artigo</span>
                  <ArrowRight size={10} />
                </div>
              </a>
            ))}
          </div>
        </main>
      </div>

      <Footer />
    </div>
  );
}

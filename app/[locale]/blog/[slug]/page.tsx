import type { Metadata } from "next";
import { notFound } from "next/navigation";
import BlogPostView from "@/components/blog/BlogPostView";
import { getAllPosts, getPost } from "@/lib/blog/posts";
import { blogPostJsonLd, blogPostMetadata } from "@/lib/blog/seo";
import type { Locale } from "@/i18n/config";

// Article localisé (/fr/blog/slug, ...). Le rendu suit la locale de l'URL via
// LanguageContext (priorité absolue au préfixe de chemin), donc Googlebot voit
// le contenu dans la langue de l'URL dès le HTML serveur.
export function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { locale: string; slug: string };
}): Promise<Metadata> {
  return blogPostMetadata(params.slug, params.locale as Locale);
}

export default function LocalizedBlogPostPage({
  params,
}: {
  params: { locale: string; slug: string };
}) {
  const post = getPost(params.slug);
  if (!post) notFound();

  const jsonLd = blogPostJsonLd(params.slug, params.locale as Locale);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <BlogPostView post={post} />
    </>
  );
}

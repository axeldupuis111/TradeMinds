import type { Metadata } from "next";
import BlogListView from "@/components/blog/BlogListView";
import { getAllPosts } from "@/lib/blog/posts";
import { blogListMetadata } from "@/lib/blog/seo";
import type { Locale } from "@/i18n/config";

// Liste du blog localisée (/fr/blog, /de/blog, /es/blog). La locale invalide
// ou "en" est déjà rejetée par app/[locale]/layout.tsx (notFound).
export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  return blogListMetadata(params.locale as Locale);
}

export default function LocalizedBlogPage() {
  return <BlogListView posts={getAllPosts()} />;
}

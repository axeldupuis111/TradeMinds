import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import BlogPostView from "@/components/blog/BlogPostView";
import { getAllPosts, getPost, postContent } from "@/lib/blog/posts";

const SITE_URL = "https://tradediscipline.app";

export function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

function resolveLang(): string {
  const c = cookies().get("NEXT_LOCALE")?.value;
  return c && ["fr", "en", "de", "es"].includes(c) ? c : "en";
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const post = getPost(params.slug);
  if (!post) return { title: "Article — TradeDiscipline" };

  const c = postContent(post, resolveLang());
  const url = `${SITE_URL}/blog/${post.slug}`;
  return {
    title: `${c.title} — TradeDiscipline`,
    description: c.excerpt,
    alternates: { canonical: url },
    openGraph: {
      title: c.title,
      description: c.excerpt,
      url,
      siteName: "TradeDiscipline",
      type: "article",
      publishedTime: post.date,
    },
    twitter: { card: "summary_large_image", title: c.title, description: c.excerpt },
  };
}

export default function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = getPost(params.slug);
  if (!post) notFound();
  return <BlogPostView post={post} />;
}

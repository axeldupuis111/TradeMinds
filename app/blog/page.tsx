import type { Metadata } from "next";
import BlogListView from "@/components/blog/BlogListView";
import { getAllPosts } from "@/lib/blog/posts";
import { blogListMetadata } from "@/lib/blog/seo";

// Racine = version anglaise canonique (x-default). Les autres langues vivent
// sur /fr/blog, /de/blog, /es/blog — voir lib/blog/seo.ts.
export const metadata: Metadata = blogListMetadata("en");

export default function BlogPage() {
  return <BlogListView posts={getAllPosts()} />;
}

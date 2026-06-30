import type { Metadata } from "next";
import BlogListView from "@/components/blog/BlogListView";
import { getAllPosts } from "@/lib/blog/posts";

const SITE_URL = "https://tradediscipline.app";

export const metadata: Metadata = {
  title: "Blog — TradeDiscipline",
  description:
    "Discipline, trading psychology and process — practical articles to help you stop repeating the same mistakes and trade with discipline.",
  alternates: { canonical: `${SITE_URL}/blog` },
  openGraph: {
    title: "Blog — TradeDiscipline",
    description: "Discipline, trading psychology and process for traders.",
    url: `${SITE_URL}/blog`,
    siteName: "TradeDiscipline",
    type: "website",
  },
};

export default function BlogPage() {
  return <BlogListView posts={getAllPosts()} />;
}

import type { MetadataRoute } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

// Served at /robots.txt. Public marketing pages are crawlable; the
// authenticated dashboard is not useful (and not reachable) to crawlers.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: '/dashboard',
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}

import type { MetadataRoute } from 'next';
import { listVenues } from '@/lib/api/endpoints/venues';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${siteUrl}`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${siteUrl}/venues`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${siteUrl}/owner/apply`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
  ];

  try {
    const res = await listVenues({ limit: 100 });
    const venueRoutes: MetadataRoute.Sitemap = (res.data || []).map((venue) => ({
      url: `${siteUrl}/venues/${venue.slug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    }));
    return [...staticRoutes, ...venueRoutes];
  } catch (error) {
    console.error('[Sitemap] Lỗi lấy danh sách venues:', error);
    return staticRoutes;
  }
}

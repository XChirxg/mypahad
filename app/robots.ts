import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/partner/dashboard', '/manager'], // Protect private sections if needed
    },
    sitemap: 'https://mypahad.in/sitemap.xml',
  };
}

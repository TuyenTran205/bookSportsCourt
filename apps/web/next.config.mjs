import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // @bsc/shared xuất TypeScript thô (src/index.ts) để FE và BE dùng chung type
  // mà không cần bước build riêng — Next biên dịch kèm.
  transpilePackages: ['@bsc/shared'],

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
    ],
  },

  eslint: {
    dirs: ['app', 'components', 'lib', 'hooks', 'store', 'mocks', 'types'],
  },
};

export default withNextIntl(nextConfig);

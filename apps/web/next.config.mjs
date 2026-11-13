import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // @bsc/shared xuất TypeScript thô (src/index.ts) để FE và BE dùng chung type
  // mà không cần bước build riêng — Next biên dịch kèm.
  transpilePackages: ['@bsc/shared'],

  // @bsc/shared viết import kiểu NodeNext (`./constants.js`) để apps/api chạy được
  // với moduleResolution node16. Webpack của Next không tự map `.js` → `.ts`,
  // nên khai báo alias để không phải nhân đôi cách viết import trong shared.
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
    };
    return config;
  },

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: '**.r2.dev' },
      { protocol: 'https', hostname: 'booksportscourt.id.vn' },
      { protocol: 'https', hostname: '**.booksportscourt.id.vn' },
    ],
  },

  eslint: {
    dirs: ['app', 'components', 'lib', 'hooks', 'store', 'mocks', 'types'],
  },
};

export default withNextIntl(nextConfig);

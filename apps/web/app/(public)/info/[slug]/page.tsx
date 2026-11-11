import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { FooterInfoPage } from '@/components/common/FooterInfoPage';

const INFO_SLUGS = [
  'booking-guide',
  'partner-policy',
  'terms',
  'privacy',
  'cancellation-policy',
  'operating-regulations',
] as const;

type InfoSlug = (typeof INFO_SLUGS)[number];

export function generateStaticParams() {
  return INFO_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const t = await getTranslations('footerPages');
  const slug = INFO_SLUGS.includes(params.slug as InfoSlug) ? (params.slug as InfoSlug) : null;

  return {
    title: slug ? t(`${slug}.title`) : 'Thông tin BookSportsCourt',
    description: slug ? t(`${slug}.intro`) : 'Thông tin và chính sách BookSportsCourt.',
  };
}

export default async function FooterInfoRoute({ params }: { params: { slug: string } }) {
  const slug = INFO_SLUGS.includes(params.slug as InfoSlug) ? (params.slug as InfoSlug) : null;
  if (!slug) notFound();

  const t = await getTranslations(`footerPages.${slug}`);
  const sections = [1, 2, 3].map((number) => ({
    heading: t(`section${number}Heading`),
    body: t(`section${number}Body`),
  }));

  return <FooterInfoPage title={t('title')} intro={t('intro')} sections={sections} />;
}

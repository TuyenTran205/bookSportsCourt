import type { VenueDetail } from '@bsc/shared';

const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export interface VenueJsonLdProps {
  venue: VenueDetail;
}

/**
 * VenueJsonLd – Sinh thẻ structured data chuẩn Schema.org SportsActivityLocation
 * giúp Google lập chỉ mục Rich Snippets (địa điểm thể thao, đánh giá sao, giờ mở cửa).
 */
export function VenueJsonLd({ venue }: VenueJsonLdProps) {
  const images = venue.images?.length
    ? venue.images.map((img) => img.url)
    : venue.coverUrl
      ? [venue.coverUrl]
      : [];

  const openingHoursSpecification = venue.openingHours
    ?.filter((h) => !h.isClosed)
    .map((h) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: WEEKDAYS[h.weekday] ?? 'Monday',
      opens: h.openTime,
      closes: h.closeTime,
    }));

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'SportsActivityLocation',
    name: venue.name,
    description: venue.description || undefined,
    image: images.length ? images : undefined,
    address: {
      '@type': 'PostalAddress',
      streetAddress: venue.address,
      addressLocality: venue.district?.name,
      addressRegion: venue.province?.name,
      addressCountry: 'VN',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: venue.lat,
      longitude: venue.lng,
    },
    openingHoursSpecification: openingHoursSpecification?.length
      ? openingHoursSpecification
      : undefined,
    aggregateRating: venue.ratingAvg
      ? {
          '@type': 'AggregateRating',
          ratingValue: venue.ratingAvg,
          reviewCount: venue.reviewCount || 1,
          bestRating: 5,
          worstRating: 1,
        }
      : undefined,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}

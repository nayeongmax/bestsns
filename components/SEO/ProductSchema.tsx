import { Helmet } from 'react-helmet-async';

const SITE_BASE = 'https://bestsns.com';

interface ProductSchemaProps {
  name: string;
  description?: string;
  image?: string;
  price?: number;
  currency?: string;
  availability?: string;
  seller?: string;
  brand?: string;
  category?: string;
  url?: string;
}

function resolveImage(value?: string): string | undefined {
  if (!value) return undefined;
  if (value.startsWith('https://') || value.startsWith('http://')) return value;
  if (value.startsWith('/')) return `${SITE_BASE}${value}`;
  return undefined;
}

function omitEmpty(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== '')
  );
}

export default function ProductSchema({
  name,
  description,
  image,
  price,
  currency = 'KRW',
  availability = 'https://schema.org/InStock',
  seller,
  brand,
  category,
  url,
}: ProductSchemaProps) {
  const resolvedImage = resolveImage(image);

  const offers = omitEmpty({
    '@type': 'Offer',
    price: price ?? undefined,
    priceCurrency: currency,
    availability,
    url: url || undefined,
    seller: seller ? omitEmpty({ '@type': 'Organization', name: seller }) : undefined,
  });

  const schema = omitEmpty({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    description: description || undefined,
    image: resolvedImage,
    brand: brand ? omitEmpty({ '@type': 'Brand', name: brand }) : undefined,
    category: category || undefined,
    url: url || undefined,
    offers,
  });

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(schema, null, 0)}
      </script>
    </Helmet>
  );
}

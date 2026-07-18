import { Helmet } from 'react-helmet-async';

const SITE_BASE = 'https://bestsns.com';
const DEFAULT_PROVIDER_ID = `${SITE_BASE}/#organization`;

interface ServiceSchemaProps {
  name: string;
  url: string;
  description?: string;
  image?: string;
  providerName?: string;
  serviceType?: string;
  areaServed?: string;
  sameAs?: string[];
  serviceId?: string;
}

function resolveString(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function resolveImage(value?: string): string | undefined {
  if (!value) return undefined;
  if (value.startsWith('https://') || value.startsWith('http://')) return value;
  if (value.startsWith('/')) return `${SITE_BASE}${value}`;
  return undefined;
}

function resolveSameAs(values?: string[]): string[] | undefined {
  if (!values) return undefined;
  const filtered = [...new Set(
    values.map(v => v?.trim()).filter((v): v is string => !!v)
  )];
  return filtered.length > 0 ? filtered : undefined;
}

export default function ServiceSchema({
  name,
  url,
  description,
  image,
  providerName,
  serviceType,
  areaServed,
  sameAs,
  serviceId,
}: ServiceSchemaProps) {
  const resolvedUrl = url.trim().replace(/\/+$/, '');
  const resolvedServiceId = resolveString(serviceId);
  const resolvedId = resolvedServiceId
    ? `${resolvedUrl}#service-${resolvedServiceId}`
    : `${resolvedUrl}#service`;
  const resolvedImage = resolveImage(image);
  const resolvedSameAs = resolveSameAs(sameAs);

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': resolvedId,
    name: name.trim(),
    url: resolvedUrl,
  };

  const resolvedDescription = resolveString(description);
  if (resolvedDescription) schema.description = resolvedDescription;

  if (resolvedImage) schema.image = resolvedImage;

  const resolvedServiceType = resolveString(serviceType);
  if (resolvedServiceType) schema.serviceType = resolvedServiceType;

  const resolvedAreaServed = resolveString(areaServed);
  if (resolvedAreaServed) schema.areaServed = resolvedAreaServed;

  if (resolvedSameAs) schema.sameAs = resolvedSameAs;

  const resolvedProviderName = resolveString(providerName);
  schema.provider = resolvedProviderName
    ? { '@type': 'Organization', '@id': DEFAULT_PROVIDER_ID, name: resolvedProviderName }
    : { '@id': DEFAULT_PROVIDER_ID };

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(schema, null, 0)}
      </script>
    </Helmet>
  );
}

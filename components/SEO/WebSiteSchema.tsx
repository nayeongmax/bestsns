import { Helmet } from 'react-helmet-async';

interface WebSiteSchemaProps {
  name: string;
  url: string;
  description?: string;
  inLanguage?: string;
  alternateName?: string;
  publisherId?: string;
}

function normalizeUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

function resolveString(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export default function WebSiteSchema({
  name,
  url,
  description,
  inLanguage = 'ko-KR',
  alternateName,
  publisherId,
}: WebSiteSchemaProps) {
  const resolvedUrl = normalizeUrl(url);
  const resolvedId = `${resolvedUrl}/#website`;
  const resolvedPublisherId = resolveString(publisherId) ?? `${resolvedUrl}/#organization`;

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': resolvedId,
    name: name.trim(),
    url: resolvedUrl,
  };

  const resolvedDescription = resolveString(description);
  if (resolvedDescription) schema.description = resolvedDescription;

  schema.inLanguage = inLanguage.trim() || 'ko-KR';

  const resolvedAlternateName = resolveString(alternateName);
  if (resolvedAlternateName) schema.alternateName = resolvedAlternateName;

  schema.publisher = { '@id': resolvedPublisherId };

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(schema, null, 0)}
      </script>
    </Helmet>
  );
}

import { Helmet } from 'react-helmet-async';

interface WebPageSchemaProps {
  name: string;
  url: string;
  description?: string;
  mainEntityId?: string;
  breadcrumbId?: string;
}

function resolveString(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export default function WebPageSchema({
  name,
  url,
  description,
  mainEntityId,
  breadcrumbId,
}: WebPageSchemaProps) {
  const resolvedName = resolveString(name);
  const resolvedUrl = resolveString(url);

  if (!resolvedName || !resolvedUrl) return null;

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: resolvedName,
    url: resolvedUrl,
  };

  const resolvedDescription = resolveString(description);
  if (resolvedDescription) schema.description = resolvedDescription;

  const resolvedMainEntityId = resolveString(mainEntityId);
  if (resolvedMainEntityId) schema.mainEntity = { '@id': resolvedMainEntityId };

  const resolvedBreadcrumbId = resolveString(breadcrumbId);
  if (resolvedBreadcrumbId) schema.breadcrumb = { '@id': resolvedBreadcrumbId };

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(schema, null, 0)}
      </script>
    </Helmet>
  );
}

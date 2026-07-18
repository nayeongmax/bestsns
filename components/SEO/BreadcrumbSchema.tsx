import { Helmet } from 'react-helmet-async';

interface BreadcrumbItem {
  name: string;
  url?: string;
}

interface BreadcrumbSchemaProps {
  items: BreadcrumbItem[];
}

function resolveName(value: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function resolveUrl(value?: string): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

export default function BreadcrumbSchema({ items }: BreadcrumbSchemaProps) {
  const resolved = items
    .map(item => ({
      name: resolveName(item.name),
      url: resolveUrl(item.url),
    }))
    .filter((item): item is { name: string; url: string | undefined } => !!item.name);

  if (resolved.length < 2) return null;

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: resolved.map((item, index) => {
      const listItem: Record<string, unknown> = {
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
      };
      if (item.url) listItem.item = item.url;
      return listItem;
    }),
  };

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(schema, null, 0)}
      </script>
    </Helmet>
  );
}

import { Helmet } from 'react-helmet-async';

const DEFAULT_DESCRIPTION = 'BESTSNS는 SMM 마케팅 주문, 유튜브·SNS 채널 거래, 마케팅 상품 판매, 온라인 부업 수익화, AI 마케팅 컨설팅을 한곳에서 이용할 수 있는 종합 마케팅 플랫폼입니다.';

interface WebSiteSchemaProps {
  name: string;
  url: string;
  description?: string;
  inLanguage?: string;
  alternateName?: string;
  sameAs?: string[];
}

function normalizeUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

function resolveString(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function resolveSameAs(values?: string[]): string[] | undefined {
  if (!values) return undefined;
  const filtered = [...new Set(
    values.map(v => v?.trim()).filter((v): v is string => !!v)
  )];
  return filtered.length > 0 ? filtered : undefined;
}

export default function WebSiteSchema({
  name,
  url,
  description,
  inLanguage = 'ko-KR',
  alternateName,
  sameAs,
}: WebSiteSchemaProps) {
  const resolvedUrl = normalizeUrl(url);
  const resolvedId = `${resolvedUrl}/#website`;
  const resolvedPublisherId = `${resolvedUrl}/#organization`;
  const resolvedDescription = resolveString(description) ?? DEFAULT_DESCRIPTION;
  const resolvedSameAs = resolveSameAs(sameAs);

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': resolvedId,
    name: name.trim(),
    url: resolvedUrl,
    description: resolvedDescription,
    inLanguage: inLanguage.trim() || 'ko-KR',
  };

  const resolvedAlternateName = resolveString(alternateName);
  if (resolvedAlternateName) schema.alternateName = resolvedAlternateName;

  if (resolvedSameAs) schema.sameAs = resolvedSameAs;

  schema.publisher = { '@id': resolvedPublisherId };

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(schema, null, 0)}
      </script>
    </Helmet>
  );
}

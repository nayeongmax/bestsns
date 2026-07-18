import { Helmet } from 'react-helmet-async';

const SITE_BASE = 'https://bestsns.com';

interface OrganizationSchemaProps {
  name: string;
  url?: string;
  logo?: string;
  description?: string;
  email?: string;
  telephone?: string;
  sameAs?: string[];
  alternateName?: string;
  foundingDate?: string;
}

function resolveLogo(value?: string): string | undefined {
  if (!value) return undefined;
  if (value.startsWith('https://') || value.startsWith('http://')) return value;
  if (value.startsWith('/')) return `${SITE_BASE}${value}`;
  return undefined;
}

function resolveString(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function resolveSameAs(values?: string[]): string[] | undefined {
  if (!values) return undefined;
  const filtered = values.map(v => v?.trim()).filter((v): v is string => !!v);
  return filtered.length > 0 ? filtered : undefined;
}

export default function OrganizationSchema({
  name,
  url,
  logo,
  description,
  email,
  telephone,
  sameAs,
  alternateName,
  foundingDate,
}: OrganizationSchemaProps) {
  const resolvedLogo = resolveLogo(logo);
  const resolvedSameAs = resolveSameAs(sameAs);

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: name.trim(),
  };

  const resolvedUrl = resolveString(url);
  if (resolvedUrl) schema.url = resolvedUrl;

  if (resolvedLogo) schema.logo = resolvedLogo;

  const resolvedDescription = resolveString(description);
  if (resolvedDescription) schema.description = resolvedDescription;

  const resolvedEmail = resolveString(email);
  if (resolvedEmail) schema.email = resolvedEmail;

  const resolvedTelephone = resolveString(telephone);
  if (resolvedTelephone) schema.telephone = resolvedTelephone;

  if (resolvedSameAs) schema.sameAs = resolvedSameAs;

  const resolvedAlternateName = resolveString(alternateName);
  if (resolvedAlternateName) schema.alternateName = resolvedAlternateName;

  const resolvedFoundingDate = resolveString(foundingDate);
  if (resolvedFoundingDate) schema.foundingDate = resolvedFoundingDate;

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(schema, null, 0)}
      </script>
    </Helmet>
  );
}

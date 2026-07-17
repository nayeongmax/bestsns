import { Helmet } from 'react-helmet-async';

const DEFAULT_TITLE = 'BESTSNS | SMM 마케팅·유튜브 채널 거래·마케팅서비스 판매·온라인 부업 플랫폼';
const DEFAULT_DESCRIPTION = 'BESTSNS는 SMM 마케팅 주문, 유튜브·SNS 채널 거래, 마케팅 상품 판매, 온라인 부업 수익화, AI 마케팅 컨설팅을 한곳에서 이용할 수 있는 종합 마케팅 플랫폼입니다.';
const DEFAULT_CANONICAL = 'https://bestsns.com';
const DEFAULT_IMAGE = 'https://bestsns.com/og-image.jpg';
const DEFAULT_TYPE = 'website';

interface SEOProps {
  title?: string;
  description?: string;
  canonical?: string;
  image?: string;
  type?: string;
  noindex?: boolean;
}

export default function SEO({
  title,
  description,
  canonical,
  image,
  type,
  noindex = false,
}: SEOProps) {
  const resolvedTitle = title || DEFAULT_TITLE;
  const resolvedDescription = description || DEFAULT_DESCRIPTION;
  const resolvedCanonical = canonical || DEFAULT_CANONICAL;
  const resolvedImage = image || DEFAULT_IMAGE;
  const resolvedType = type || DEFAULT_TYPE;

  return (
    <Helmet>
      <title>{resolvedTitle}</title>
      <meta name="description" content={resolvedDescription} />
      <link rel="canonical" href={resolvedCanonical} />

      {noindex && <meta name="robots" content="noindex,nofollow" />}

      <meta property="og:type" content={resolvedType} />
      <meta property="og:url" content={resolvedCanonical} />
      <meta property="og:title" content={resolvedTitle} />
      <meta property="og:description" content={resolvedDescription} />
      <meta property="og:image" content={resolvedImage} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={resolvedTitle} />
      <meta name="twitter:description" content={resolvedDescription} />
      <meta name="twitter:image" content={resolvedImage} />
    </Helmet>
  );
}

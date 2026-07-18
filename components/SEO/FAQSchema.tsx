import { Helmet } from 'react-helmet-async';

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQSchemaProps {
  items: FAQItem[];
}

function resolveText(value: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export default function FAQSchema({ items }: FAQSchemaProps) {
  const resolved = items
    .map(item => ({
      question: resolveText(item.question),
      answer: resolveText(item.answer),
    }))
    .filter((item): item is { question: string; answer: string } =>
      !!item.question && !!item.answer
    );

  if (resolved.length === 0) return null;

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: resolved.map(item => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(schema, null, 0)}
      </script>
    </Helmet>
  );
}

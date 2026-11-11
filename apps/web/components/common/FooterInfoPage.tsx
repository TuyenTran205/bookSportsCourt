import Link from 'next/link';
import { ArrowLeft, FileText } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface FooterInfoPageProps {
  title: string;
  intro: string;
  sections: Array<{ heading: string; body: string }>;
}

export function FooterInfoPage({ title, intro, sections }: FooterInfoPageProps) {
  const tCommon = useTranslations('common');

  return (
    <main className="container py-10 md:py-16">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-text-secondary transition-colors hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2"
        >
          <ArrowLeft className="size-4" />
          {tCommon('goHome')}
        </Link>
        <header className="mb-10 border-b border-border pb-8">
          <FileText className="mb-4 size-8 text-primary-700" />
          <h1 className="text-3xl font-bold text-text-primary">{title}</h1>
          <p className="mt-4 leading-relaxed text-text-secondary">{intro}</p>
        </header>
        <div className="space-y-8">
          {sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-xl font-semibold text-text-primary">{section.heading}</h2>
              <p className="mt-2 leading-relaxed text-text-secondary">{section.body}</p>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}

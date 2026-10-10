import { useTranslation } from 'react-i18next'
import { LegalDocument } from '@/shared/components/legal-document'

export function TermsOfServicePage() {
  const { t } = useTranslation()
  const sections = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((index) => {
    const paragraphs = t(`terms.sections.s${index}.paragraphs`, { returnObjects: true }) as unknown as string[]
    const bullets = t(`terms.sections.s${index}.bullets`, { returnObjects: true }) as unknown as string[]
    return {
      title: t(`terms.sections.s${index}.title`),
      paragraphs,
      bullets: bullets.length > 0 ? bullets : undefined,
    }
  })

  return (
    <LegalDocument
      eyebrow={t('terms.eyebrow')}
      title={t('terms.title')}
      summary={t('terms.summary')}
      lastUpdated={t('terms.lastUpdated')}
      note={t('terms.note')}
      sections={sections}
    />
  )
}

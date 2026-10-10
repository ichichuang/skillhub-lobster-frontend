import { useTranslation } from 'react-i18next'
import { LegalDocument } from '@/shared/components/legal-document'

export function PrivacyPolicyPage() {
  const { t } = useTranslation()
  const sections = [1, 2, 3, 4, 5, 6, 7, 8].map((index) => {
    const paragraphs = t(`privacy.sections.s${index}.paragraphs`, { returnObjects: true }) as unknown as string[]
    const bullets = t(`privacy.sections.s${index}.bullets`, { returnObjects: true }) as unknown as string[]
    return {
      title: t(`privacy.sections.s${index}.title`),
      paragraphs,
      bullets: bullets.length > 0 ? bullets : undefined,
    }
  })

  return (
    <LegalDocument
      eyebrow={t('privacy.eyebrow')}
      title={t('privacy.title')}
      summary={t('privacy.summary')}
      lastUpdated={t('privacy.lastUpdated')}
      note={t('privacy.note')}
      sections={sections}
    />
  )
}

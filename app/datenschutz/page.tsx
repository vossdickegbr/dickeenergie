import Link from 'next/link'
import { Download, ShieldCheck } from 'lucide-react'
import { COMPANY_CONFIG, PRIVACY_NOTICE_VERSION } from '@/lib/company-config'
import { WEBSITE_PRIVACY_SECTIONS } from '@/lib/privacy-notice'

export const metadata = { title: 'Datenschutzerklärung | Voss & Dicke GbR' }

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <header className="legal-hero"><ShieldCheck /><div><span>Voss & Dicke GbR</span><h1>Datenschutzerklärung</h1><p>Stand und interne Version: {PRIVACY_NOTICE_VERSION}</p></div></header>
      <div className="legal-content">
        <section><h2>PDF-Fassungen</h2><p>Die aktuelle Datenschutzerklärung und die Kundeninformation können als PDF gespeichert oder ausgedruckt werden.</p><div className="privacy-document-actions"><a className="primary-button" href="/legal/Datenschutzerklaerung_Website_App_Voss_Dicke_GbR.pdf"><Download /> Datenschutzerklärung PDF</a><a className="secondary-button" href="/legal/Datenschutzinformation_Kunden_Art13_Voss_Dicke_GbR.pdf"><Download /> Kundeninformation PDF</a></div></section>
        {WEBSITE_PRIVACY_SECTIONS.map((section) => <section key={section.title}><h2>{section.title}</h2>{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</section>)}
        <section><h2>8. Aktualität und Änderungen</h2><p>Wir passen diese Erklärung an, wenn sich Rechtslage, Anbieter oder Verarbeitungsvorgänge ändern. Historische Kundeninformationen werden versioniert und zusammen mit dem jeweiligen Empfangsnachweis gespeichert.</p></section>
        <section className="legal-contact"><h2>Kontakt</h2><p>{COMPANY_CONFIG.legalName}<br />{COMPANY_CONFIG.street}<br />{COMPANY_CONFIG.postalCode} {COMPANY_CONFIG.city}<br />Telefon: {COMPANY_CONFIG.phone}<br />E-Mail: <a href={`mailto:${COMPANY_CONFIG.email}`}>{COMPANY_CONFIG.email}</a></p></section>
      </div>
      <footer className="legal-footer"><Link href="/impressum">Impressum</Link><a href={COMPANY_CONFIG.website}>Öffentliche Website</a><Link href="/">Zur App</Link></footer>
    </main>
  )
}

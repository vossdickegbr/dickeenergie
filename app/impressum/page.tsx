import Link from 'next/link'
import { Building2 } from 'lucide-react'
import { COMPANY_CONFIG } from '@/lib/company-config'

export const metadata = { title: 'Impressum | Voss & Dicke GbR' }

export default function ImprintPage() {
  return (
    <main className="legal-page">
      <header className="legal-hero"><Building2 /><div><span>Angaben nach § 5 DDG</span><h1>Impressum</h1><p>Voss & Dicke GbR</p></div></header>
      <div className="legal-content">
        <section><h2>Anbieter</h2><p>{COMPANY_CONFIG.legalName}<br />{COMPANY_CONFIG.legalForm}<br />{COMPANY_CONFIG.street}<br />{COMPANY_CONFIG.postalCode} {COMPANY_CONFIG.city}<br />{COMPANY_CONFIG.country}</p></section>
        <section><h2>Vertretung</h2><p>Gemeinschaftlich vertretungsberechtigt: {COMPANY_CONFIG.representatives.join(' und ')}.</p></section>
        <section><h2>Kontakt</h2><p>Telefon: {COMPANY_CONFIG.phone}<br />E-Mail: <a href={`mailto:${COMPANY_CONFIG.email}`}>{COMPANY_CONFIG.email}</a><br />Website: <a href={COMPANY_CONFIG.website}>{COMPANY_CONFIG.website}</a></p></section>
        <section><h2>Register und Steuerangaben</h2><p>{COMPANY_CONFIG.registerStatus}</p><p>{COMPANY_CONFIG.vatStatus}</p></section>
        <section><h2>Tätigkeit</h2><p>{COMPANY_CONFIG.businessPurpose}</p></section>
        <section><h2>Verbraucherstreitbeilegung</h2><p>Vor Aufnahme des Geschäftsbetriebs ist zu entscheiden und einzutragen, ob die Gesellschaft bereit oder verpflichtet ist, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p></section>
      </div>
      <footer className="legal-footer"><Link href="/datenschutz">Datenschutz</Link><Link href="/">Zur App</Link></footer>
    </main>
  )
}

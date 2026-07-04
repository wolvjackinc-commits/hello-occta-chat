/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
  Row,
  Column,
} from 'npm:@react-email/components@0.0.22'

/**
 * OCCTA master email shell — used by every transactional/auth email so
 * customers see the SAME branding everywhere (header, accent bar, body,
 * multi-column footer with company details).
 *
 * Visual reference: order confirmation email (yellow "OCCTA LIMITED" header,
 * white body, three-column footer with Talk to us / Self-serve / Registered
 * office, legal microcopy at the bottom).
 */
export interface BrandLayoutProps {
  preview: string
  heading: string
  intro?: string
  bodyChildren?: React.ReactNode
  primaryCta?: { label: string; href: string }
  secondaryCta?: { label: string; href: string }
  footnote?: string
  dashboardHref?: string
}

export const BrandLayout: React.FC<BrandLayoutProps> = ({
  preview,
  heading,
  intro,
  bodyChildren,
  primaryCta,
  secondaryCta,
  footnote,
  dashboardHref = 'https://www.occta.co.uk/dashboard',
}) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{preview}</Preview>
    <Body style={main}>
      <Container style={container}>
        {/* Header — yellow OCCTA LIMITED bar */}
        <Section style={header}>
          <Row>
            <Column style={{ width: '44px', verticalAlign: 'middle' }}>
              <div style={logoMark}>O</div>
            </Column>
            <Column style={{ verticalAlign: 'middle' }}>
              <Text style={logoText}>OCCTA</Text>
              <Text style={logoTagline}>Brilliant Made Simple</Text>
            </Column>
          </Row>
        </Section>

        {/* Body */}
        <Section style={content}>
          <Heading style={h1}>{heading}</Heading>
          {intro ? <Text style={text}>{intro}</Text> : null}
          {bodyChildren}

          {primaryCta ? (
            <Section style={buttonWrapper}>
              <Button style={primaryButton} href={primaryCta.href}>
                {primaryCta.label.toUpperCase()}
              </Button>
            </Section>
          ) : null}

          {secondaryCta ? (
            <Section style={{ textAlign: 'center', margin: '0 0 16px' }}>
              <Link href={secondaryCta.href} style={secondaryLink}>
                {secondaryCta.label}
              </Link>
            </Section>
          ) : null}

          {footnote ? <Text style={footnoteText}>{footnote}</Text> : null}
        </Section>

        <Hr style={divider} />

        {/* Footer — three columns + legal */}
        <Section style={footer}>
          <Text style={footerBrand}>OCCTA</Text>
          <Text style={tagline}>Brilliant Made Simple — no contracts, no price-rise nonsense, just proper British telecom.</Text>

          <Row style={{ marginTop: '20px' }}>
            <Column style={footerCol}>
              <Text style={colHeading}>TALK TO US</Text>
              <Text style={colLine}>
                <Link href="mailto:hello@occta.co.uk" style={colLink}>hello@occta.co.uk</Link>
              </Text>
              <Text style={colLine}>
                <Link href="tel:08002606626" style={colLink}>0800 260 6626</Link>
              </Text>
              <Text style={colMuted}>Mon–Fri · 8am–6pm UK</Text>
            </Column>
            <Column style={footerCol}>
              <Text style={colHeading}>SELF-SERVE</Text>
              <Text style={colLine}>
                <Link href={dashboardHref} style={colLink}>Your dashboard</Link>
              </Text>
              <Text style={colLine}>
                <Link href="https://www.occta.co.uk/support" style={colLink}>Help &amp; support</Link>
              </Text>
              <Text style={colLine}>
                <Link href="https://www.occta.co.uk/order-lookup" style={colLink}>Track an order</Link>
              </Text>
            </Column>
            <Column style={footerCol}>
              <Text style={colHeading}>REGISTERED OFFICE</Text>
              <Text style={colMuted}>22 Pavilion View</Text>
              <Text style={colMuted}>Huddersfield, HD3 3WU</Text>
              <Text style={colMuted}>Company No. 13828933</Text>
            </Column>
          </Row>

          <Hr style={dividerSubtle} />

          <Text style={legal}>
            You're getting this email because it relates to your OCCTA account, quote or order — it's a service
            message, not marketing. Manage preferences in{' '}
            <Link href={dashboardHref} style={legalLink}>your dashboard</Link>. © {new Date().getFullYear()} OCCTA Limited.
            Regulated under UK Ofcom General Conditions. Calls may be recorded for training.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default BrandLayout

/* ── Styles ── */
const main: React.CSSProperties = {
  backgroundColor: '#f4f4f5',
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Arial, sans-serif",
  margin: 0,
  padding: '24px 0',
}
const container: React.CSSProperties = {
  maxWidth: '620px',
  margin: '0 auto',
  backgroundColor: '#ffffff',
  border: '3px solid #0d0d0d',
}
const header: React.CSSProperties = {
  backgroundColor: '#facc15',
  padding: '18px 28px',
  borderBottom: '3px solid #0d0d0d',
}
const logoMark: React.CSSProperties = {
  width: '32px',
  height: '32px',
  backgroundColor: '#0d0d0d',
  color: '#facc15',
  fontWeight: 900,
  fontSize: '20px',
  textAlign: 'center',
  lineHeight: '32px',
  display: 'inline-block',
}
const logoText: React.CSSProperties = {
  fontSize: '18px',
  fontWeight: 800,
  letterSpacing: '3px',
  color: '#0d0d0d',
  margin: 0,
  paddingLeft: '12px',
}
const logoTagline: React.CSSProperties = {
  fontSize: '9px',
  fontWeight: 700,
  letterSpacing: '2px',
  color: '#0d0d0d',
  margin: '2px 0 0',
  paddingLeft: '12px',
  textTransform: 'uppercase',
  opacity: 0.75,
}
const content: React.CSSProperties = { padding: '32px 32px 8px' }
const h1: React.CSSProperties = {
  fontSize: '22px',
  fontWeight: 800,
  color: '#0d0d0d',
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
  margin: '0 0 16px',
  lineHeight: 1.2,
}
const text: React.CSSProperties = { fontSize: '15px', color: '#27272a', lineHeight: 1.65, margin: '0 0 16px' }
const buttonWrapper: React.CSSProperties = { textAlign: 'left', margin: '8px 0 24px' }
const primaryButton: React.CSSProperties = {
  backgroundColor: '#0d0d0d',
  color: '#facc15',
  fontSize: '14px',
  fontWeight: 800,
  letterSpacing: '2px',
  textTransform: 'uppercase',
  borderRadius: 0,
  padding: '14px 24px',
  textDecoration: 'none',
  border: '2px solid #0d0d0d',
  display: 'inline-block',
}
const secondaryLink: React.CSSProperties = {
  fontSize: '13px',
  color: '#0d0d0d',
  textDecoration: 'underline',
  fontWeight: 600,
}
const footnoteText: React.CSSProperties = { fontSize: '12px', color: '#71717a', margin: '16px 0 8px', lineHeight: 1.5 }
const divider: React.CSSProperties = { borderColor: '#e4e4e7', margin: '8px 0 0' }
const dividerSubtle: React.CSSProperties = { borderColor: '#e4e4e7', margin: '20px 0 12px' }
const footer: React.CSSProperties = { padding: '24px 28px 22px', backgroundColor: '#ffffff' }
const footerBrand: React.CSSProperties = { fontSize: '14px', fontWeight: 800, letterSpacing: '2px', color: '#0d0d0d', margin: 0 }
const tagline: React.CSSProperties = { fontSize: '12px', color: '#52525b', fontStyle: 'italic', margin: '4px 0 0' }
const footerCol: React.CSSProperties = { verticalAlign: 'top', width: '33.33%', paddingRight: '12px' }
const colHeading: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 800,
  letterSpacing: '1.5px',
  color: '#0d0d0d',
  margin: '0 0 8px',
  textTransform: 'uppercase',
}
const colLine: React.CSSProperties = { fontSize: '12px', color: '#27272a', margin: '0 0 4px', lineHeight: 1.5 }
const colMuted: React.CSSProperties = { fontSize: '12px', color: '#52525b', margin: '0 0 4px', lineHeight: 1.5 }
const colLink: React.CSSProperties = { color: '#27272a', textDecoration: 'none', fontWeight: 600 }
const legal: React.CSSProperties = { fontSize: '11px', color: '#a1a1aa', lineHeight: 1.6, margin: 0 }
const legalLink: React.CSSProperties = { color: '#71717a', textDecoration: 'underline' }
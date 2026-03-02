/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
  Row,
  Column,
} from 'npm:@react-email/components@0.0.22'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

const LOGO_URL = 'https://oexgjmuvgdndizsufipe.supabase.co/storage/v1/object/public/email-assets/logo.png'
const CONFETTI_URL = 'https://oexgjmuvgdndizsufipe.supabase.co/storage/v1/object/public/email-assets/confetti-small.png'

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Welcome to OCCTA – confirm your email to get started</Preview>
    <Body style={main}>
      <Container style={container}>
        {/* ── Header ── */}
        <Section style={header}>
          <Row>
            <Column style={{ width: '48px' }}>
              <Img src={LOGO_URL} width="40" height="40" alt="OCCTA" style={{ display: 'block' }} />
            </Column>
            <Column>
              <Text style={logoText}>OCCTA</Text>
            </Column>
          </Row>
        </Section>

        {/* ── Confetti falling from header ── */}
        <Img src={CONFETTI_URL} width="600" alt="" style={confettiImg} />

        {/* ── Hero celebration block ── */}
        <Section style={heroSection}>
          <Heading style={heroHeading}>You're in. 🎉</Heading>
          <Text style={heroSubtext}>Welcome to OCCTA — proper British telecom.</Text>
        </Section>

        {/* ── Yellow accent divider ── */}
        <Section style={accentBar} />

        {/* ── Body ── */}
        <Section style={content}>
          <Text style={text}>
            One last thing — confirm your email address (
            <Link href={`mailto:${recipient}`} style={link}>{recipient}</Link>
            ) so we know it's really you.
          </Text>

          <Section style={buttonWrapper}>
            <Button style={button} href={confirmationUrl}>
              CONFIRM EMAIL ADDRESS
            </Button>
          </Section>

          <Section style={featureRow}>
            <Row>
              <Column style={featureCol}>
                <Text style={featureIcon}>⚡</Text>
                <Text style={featureLabel}>No contracts</Text>
              </Column>
              <Column style={featureCol}>
                <Text style={featureIcon}>🇬🇧</Text>
                <Text style={featureLabel}>UK support</Text>
              </Column>
              <Column style={featureCol}>
                <Text style={featureIcon}>🛡️</Text>
                <Text style={featureLabel}>No hidden fees</Text>
              </Column>
            </Row>
          </Section>

          <Text style={footnote}>
            Didn't create an account? Just ignore this email — nothing will happen.
          </Text>
        </Section>

        {/* ── Footer ── */}
        <Section style={footer}>
          <Text style={footerBrand}>OCCTA</Text>
          <Text style={footerText}>
            Need help? Call <strong>0800 260 6626</strong> or email{' '}
            <Link href="mailto:hello@occta.co.uk" style={footerLink}>hello@occta.co.uk</Link>
          </Text>
          <Text style={footerLegal}>
            © {new Date().getFullYear()} OCCTA Limited. Company No. 13828933.<br />
            22 Pavilion View, Huddersfield, HD3 3WU, United Kingdom
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

/* ── Styles ── */
const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { maxWidth: '600px', margin: '0 auto', border: '4px solid #0d0d0d' }
const header: React.CSSProperties = { backgroundColor: '#0d0d0d', padding: '20px 32px' }
const logoText: React.CSSProperties = { fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: '28px', letterSpacing: '4px', color: '#ffffff', margin: '0', verticalAlign: 'middle', lineHeight: '40px' }

const confettiImg: React.CSSProperties = { display: 'block', width: '100%', maxWidth: '600px', height: 'auto', marginTop: '-2px' }

const heroSection: React.CSSProperties = { padding: '0 32px 40px', textAlign: 'center', marginTop: '-60px' }
const heroHeading: React.CSSProperties = { fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: '48px', fontWeight: 'bold', color: '#0d0d0d', letterSpacing: '3px', textTransform: 'uppercase', margin: '0 0 8px', lineHeight: '1.1' }
const heroSubtext: React.CSSProperties = { fontSize: '16px', color: '#333333', margin: '0', fontWeight: '500' }

const accentBar = { backgroundColor: '#facc15', height: '6px' }
const content = { padding: '32px' }
const text = { fontSize: '15px', color: '#333333', lineHeight: '1.7', margin: '0 0 24px' }
const link = { color: '#0d0d0d', textDecoration: 'underline', fontWeight: 'bold' as const }
const buttonWrapper: React.CSSProperties = { textAlign: 'center', margin: '8px 0 32px' }
const button: React.CSSProperties = { backgroundColor: '#0d0d0d', color: '#ffffff', fontSize: '14px', fontWeight: 'bold', letterSpacing: '2px', textTransform: 'uppercase', borderRadius: '0', padding: '16px 32px', textDecoration: 'none', border: '3px solid #0d0d0d' }

const featureRow: React.CSSProperties = { margin: '0 0 24px', padding: '20px 0', borderTop: '2px solid #f0f0f0', borderBottom: '2px solid #f0f0f0' }
const featureCol: React.CSSProperties = { textAlign: 'center', verticalAlign: 'top', width: '33.33%' }
const featureIcon: React.CSSProperties = { fontSize: '24px', margin: '0 0 4px', lineHeight: '1' }
const featureLabel: React.CSSProperties = { fontSize: '12px', color: '#666666', margin: '0', fontWeight: 'bold' as const, textTransform: 'uppercase', letterSpacing: '1px' }

const footnote = { fontSize: '13px', color: '#888888', margin: '0', lineHeight: '1.5' }
const footer: React.CSSProperties = { backgroundColor: '#0d0d0d', padding: '24px 32px', textAlign: 'center' }
const footerBrand: React.CSSProperties = { fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: '20px', letterSpacing: '4px', color: '#facc15', margin: '0 0 12px' }
const footerText = { fontSize: '12px', color: '#ffffff', margin: '0 0 12px', lineHeight: '1.6' }
const footerLink = { color: '#facc15', textDecoration: 'none' }
const footerLegal = { fontSize: '10px', color: '#666666', margin: '0', lineHeight: '1.5' }

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
} from 'npm:@react-email/components@0.0.22'

interface EmailChangeEmailProps {
  siteName: string
  email: string
  newEmail: string
  confirmationUrl: string
}

const LOGO_URL = 'https://oexgjmuvgdndizsufipe.supabase.co/storage/v1/object/public/email-assets/logo.png'

export const EmailChangeEmail = ({ siteName, email, newEmail, confirmationUrl }: EmailChangeEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Confirm your new email address for OCCTA</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Img src={LOGO_URL} width="40" height="40" alt="OCCTA" />
          <Text style={logoText}>OCCTA</Text>
        </Section>
        <Section style={accentBar} />
        <Section style={content}>
          <Heading style={h1}>Confirm email change.</Heading>
          <Text style={text}>
            You've requested to change your OCCTA email from{' '}
            <Link href={`mailto:${email}`} style={link}>{email}</Link> to{' '}
            <Link href={`mailto:${newEmail}`} style={link}>{newEmail}</Link>.
          </Text>
          <Text style={text}>Hit the button below to confirm:</Text>
          <Button style={button} href={confirmationUrl}>
            CONFIRM EMAIL CHANGE
          </Button>
          <Text style={footnote}>
            Didn't request this? Secure your account immediately.
          </Text>
        </Section>
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

export default EmailChangeEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { maxWidth: '600px', margin: '0 auto', border: '4px solid #0d0d0d' }
const header: React.CSSProperties = { backgroundColor: '#0d0d0d', padding: '20px 32px' }
const logoText: React.CSSProperties = { fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: '28px', letterSpacing: '4px', color: '#ffffff', margin: '0' }
const accentBar = { backgroundColor: '#facc15', height: '6px' }
const content = { padding: '32px' }
const h1: React.CSSProperties = { fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: '28px', fontWeight: 'bold', color: '#0d0d0d', letterSpacing: '2px', textTransform: 'uppercase', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#333333', lineHeight: '1.7', margin: '0 0 20px' }
const link = { color: '#0d0d0d', textDecoration: 'underline' }
const button: React.CSSProperties = { backgroundColor: '#0d0d0d', color: '#ffffff', fontSize: '14px', fontWeight: 'bold', letterSpacing: '2px', textTransform: 'uppercase', borderRadius: '0', padding: '14px 28px', textDecoration: 'none', border: '3px solid #0d0d0d' }
const footnote = { fontSize: '13px', color: '#888888', margin: '24px 0 0', lineHeight: '1.5' }
const footer: React.CSSProperties = { backgroundColor: '#0d0d0d', padding: '24px 32px', textAlign: 'center' }
const footerBrand: React.CSSProperties = { fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: '20px', letterSpacing: '4px', color: '#facc15', margin: '0 0 12px' }
const footerText = { fontSize: '12px', color: '#ffffff', margin: '0 0 12px', lineHeight: '1.6' }
const footerLink = { color: '#facc15', textDecoration: 'none' }
const footerLegal = { fontSize: '10px', color: '#666666', margin: '0', lineHeight: '1.5' }

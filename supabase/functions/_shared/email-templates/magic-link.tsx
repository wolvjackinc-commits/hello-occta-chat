/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { BrandLayout } from './BrandLayout.tsx'

interface Props { siteName: string; confirmationUrl: string }

export const MagicLinkEmail = ({ confirmationUrl }: Props) => (
  <BrandLayout
    preview="Your one-tap sign-in link for OCCTA"
    heading="Your sign-in link"
    intro="Tap the button below to sign straight in to your OCCTA dashboard. No password required."
    primaryCta={{ label: 'Sign in to OCCTA', href: confirmationUrl }}
    footnote="This link expires in 60 minutes and can only be used once. Didn't request it? Ignore this email."
  />
)

export default MagicLinkEmail
/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Text } from 'npm:@react-email/components@0.0.22'
import { BrandLayout } from './BrandLayout.tsx'

interface Props { siteName: string; confirmationUrl: string }

export const RecoveryEmail = ({ confirmationUrl }: Props) => (
  <BrandLayout
    preview="Set or reset your OCCTA password — secure link inside"
    heading="Set your OCCTA password"
    intro="Use the secure button below to choose a new password. You'll be signed straight in and taken to your dashboard, where your orders, invoices and Contract Summary are already linked to this email."
    primaryCta={{ label: 'Set password & open dashboard', href: confirmationUrl }}
    footnote="This link expires in 60 minutes and can only be used once. Didn't request it? Ignore this email — your password won't change."
    bodyChildren={
      <Text style={{ fontSize: '13px', color: '#52525b', margin: '0 0 8px', lineHeight: 1.6 }}>
        For your security we'll never ask for your password by email or phone.
      </Text>
    }
  />
)

export default RecoveryEmail
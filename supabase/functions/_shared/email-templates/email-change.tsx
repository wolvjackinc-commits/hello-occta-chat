/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Text } from 'npm:@react-email/components@0.0.22'
import { BrandLayout } from './BrandLayout.tsx'

interface Props { siteName: string; email: string; newEmail: string; confirmationUrl: string }

export const EmailChangeEmail = ({ email, newEmail, confirmationUrl }: Props) => (
  <BrandLayout
    preview="Confirm your new OCCTA email address"
    heading="Confirm your new email"
    intro={`You asked to change the email on your OCCTA account from ${email} to ${newEmail}.`}
    primaryCta={{ label: 'Confirm new email', href: confirmationUrl }}
    footnote="Didn't request this change? Contact us immediately on 0800 260 6626 — we'll lock the account down."
    bodyChildren={
      <Text style={{ fontSize: '13px', color: '#52525b', margin: '0 0 8px', lineHeight: 1.6 }}>
        For your security the change won't take effect until you confirm.
      </Text>
    }
  />
)

export default EmailChangeEmail
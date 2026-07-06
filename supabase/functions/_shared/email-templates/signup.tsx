/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Text } from 'npm:@react-email/components@0.0.22'
import { BrandLayout } from './BrandLayout.tsx'

interface Props {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({ recipient, confirmationUrl }: Props) => (
  <BrandLayout
    preview="Welcome to OCCTA — confirm your email to activate your account"
    heading="Welcome to OCCTA"
    intro="Thanks for joining — proper British telecom, flexible monthly options available."
    primaryCta={{ label: 'Confirm email & open dashboard', href: confirmationUrl }}
    footnote={`One last step: confirm ${recipient} so we know it's really you. Didn't sign up? Just ignore this email — no account is created until you click the button.`}
    bodyChildren={
      <Text style={{ fontSize: '14px', color: '#27272a', margin: '0 0 8px', lineHeight: 1.6 }}>
        Confirming activates your account so you can track orders, manage Direct Debit and download every Contract Summary in one place.
      </Text>
    }
  />
)

export default SignupEmail
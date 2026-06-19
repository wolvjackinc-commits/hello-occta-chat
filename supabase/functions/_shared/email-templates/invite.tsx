/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { BrandLayout } from './BrandLayout.tsx'

interface Props { siteName: string; siteUrl: string; confirmationUrl: string }

export const InviteEmail = ({ confirmationUrl }: Props) => (
  <BrandLayout
    preview="You've been invited to OCCTA"
    heading="You're invited to OCCTA"
    intro="Accept your invite to set a password and access your dashboard, orders and billing."
    primaryCta={{ label: 'Accept invite', href: confirmationUrl }}
    footnote="This invite expires soon. Didn't expect this? You can safely ignore it."
  />
)

export default InviteEmail
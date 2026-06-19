/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Text } from 'npm:@react-email/components@0.0.22'
import { BrandLayout } from './BrandLayout.tsx'

interface Props { token: string }

export const ReauthenticationEmail = ({ token }: Props) => (
  <BrandLayout
    preview="Your OCCTA verification code"
    heading="Your verification code"
    intro="Use the code below to finish what you were doing. It expires in 10 minutes."
    footnote="Never share this code. OCCTA staff will never ask for it."
    bodyChildren={
      <div
        style={{
          fontSize: '32px',
          fontWeight: 800,
          letterSpacing: '8px',
          color: '#0d0d0d',
          background: '#facc15',
          border: '3px solid #0d0d0d',
          padding: '18px 12px',
          textAlign: 'center' as const,
          margin: '8px 0 20px',
        }}
      >
        {token}
      </div>
    }
  />
)

export default ReauthenticationEmail
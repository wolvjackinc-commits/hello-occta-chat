export interface LocationFAQ {
  question: string;
  answer: string;
}

export interface Location {
  slug: string;
  city: string;
  region: string;
  intro: string;
  metaDescription: string;
  faqs: LocationFAQ[];
}

export const locations: Location[] = [
  {
    slug: 'london',
    city: 'London',
    region: 'Greater London',
    intro: 'Looking for cheap broadband in London? OCCTA delivers fast, reliable fibre broadband across Greater London with no contracts, no price rises, and speeds up to 900Mbps. Whether you're in Zone 1 or the suburbs, get connected without the big-provider price tag.',
    metaDescription: 'Cheap broadband in London from £22.99/mo. No contract fibre up to 900Mbps across Greater London. No price rises, cancel anytime. Get connected today.',
    faqs: [
      { question: 'Can I get OCCTA broadband in London?', answer: 'Yes — OCCTA broadband is available across Greater London via the Openreach fibre network. Enter your postcode on our broadband page to check speeds and availability at your address.' },
      { question: 'How fast is OCCTA broadband in London?', answer: 'Speeds depend on your address and the infrastructure available. Most London postcodes can access speeds from 36Mbps up to 900Mbps through FTTP (full fibre) or FTTC connections.' },
      { question: 'Is there a contract for London broadband?', answer: 'No. All OCCTA broadband plans are rolling monthly with no lock-in, no exit fees, and no mid-contract price rises — whether you're in Hackney or Hounslow.' },
    ],
  },
  {
    slug: 'manchester',
    city: 'Manchester',
    region: 'Greater Manchester',
    intro: 'Get affordable, no-contract broadband in Manchester. OCCTA provides fibre broadband across Greater Manchester with speeds up to 900Mbps and no hidden fees. Simple, honest internet for a city that doesn't do nonsense.',
    metaDescription: 'Cheap broadband in Manchester from £22.99/mo. No contract fibre up to 900Mbps. No hidden fees, cancel anytime. Check availability now.',
    faqs: [
      { question: 'Is OCCTA broadband available in Manchester?', answer: 'Yes — OCCTA covers most of Greater Manchester via the Openreach network. Check your postcode on our broadband page to confirm availability and speeds at your address.' },
      { question: 'What speeds can I get in Manchester?', answer: 'Most Manchester addresses can access speeds from 36Mbps to 900Mbps depending on whether your area has FTTC or full fibre (FTTP) coverage.' },
      { question: 'Do I need a contract for Manchester broadband?', answer: 'No. Every OCCTA plan is rolling monthly. No lock-in, no exit fees, and your price stays the same for as long as you're with us.' },
    ],
  },
  {
    slug: 'birmingham',
    city: 'Birmingham',
    region: 'West Midlands',
    intro: 'Affordable fibre broadband in Birmingham with no contracts and no surprises. OCCTA offers speeds up to 900Mbps across the West Midlands — straightforward internet at a fair price, with free installation and a router included.',
    metaDescription: 'Cheap broadband in Birmingham from £22.99/mo. No contract fibre up to 900Mbps across the West Midlands. Cancel anytime, no price rises.',
    faqs: [
      { question: 'Can I get OCCTA broadband in Birmingham?', answer: 'Yes — OCCTA broadband is available across Birmingham and the wider West Midlands through the Openreach fibre network. Enter your postcode to check what speeds are available.' },
      { question: 'What broadband speeds are available in Birmingham?', answer: 'Depending on your address, you can get speeds from 36Mbps (FTTC) up to 900Mbps (FTTP full fibre). Many Birmingham postcodes now have access to ultrafast full fibre.' },
      { question: 'Are there any setup fees for Birmingham broadband?', answer: 'No — OCCTA includes free standard installation and a Wi-Fi router with every plan. There are no hidden setup costs.' },
    ],
  },
  {
    slug: 'leeds',
    city: 'Leeds',
    region: 'West Yorkshire',
    intro: 'Fast, cheap broadband in Leeds with no contract tie-ins. OCCTA serves homes across West Yorkshire with fibre speeds up to 900Mbps, free installation, and a price that won't change. Honest broadband for Yorkshire.',
    metaDescription: 'Cheap broadband in Leeds from £22.99/mo. No contract fibre up to 900Mbps in West Yorkshire. No price rises, cancel anytime.',
    faqs: [
      { question: 'Is OCCTA available in Leeds?', answer: 'Yes — OCCTA broadband covers Leeds and much of West Yorkshire via the Openreach network. Check your postcode to see available speeds at your address.' },
      { question: 'What fibre speeds can I get in Leeds?', answer: 'Most Leeds postcodes have access to speeds from 36Mbps up to 900Mbps, depending on whether your street has FTTC or full fibre (FTTP) infrastructure.' },
      { question: 'Can I cancel my Leeds broadband anytime?', answer: 'Yes — all OCCTA plans are rolling monthly. Cancel whenever you like with no exit fees and no penalty charges.' },
    ],
  },
  {
    slug: 'glasgow',
    city: 'Glasgow',
    region: 'Scotland',
    intro: 'Affordable broadband in Glasgow with no contracts and no catches. OCCTA brings fast fibre internet to homes across Scotland's largest city — from the city centre to the suburbs — with speeds up to 900Mbps and honest, fixed pricing.',
    metaDescription: 'Cheap broadband in Glasgow from £22.99/mo. No contract fibre up to 900Mbps. No hidden fees, cancel anytime. Check Glasgow availability.',
    faqs: [
      { question: 'Can I get OCCTA broadband in Glasgow?', answer: 'Yes — OCCTA provides broadband across Glasgow through the Openreach fibre network. Enter your postcode to check what speeds and plans are available at your address.' },
      { question: 'What broadband speeds are available in Glasgow?', answer: 'Glasgow has good fibre coverage. Most addresses can access speeds from 36Mbps to 900Mbps depending on local infrastructure. Full fibre (FTTP) is expanding rapidly across the city.' },
      { question: 'Is OCCTA broadband really no contract in Glasgow?', answer: 'Yes — every OCCTA plan is rolling monthly, regardless of location. No minimum term, no exit fees, and your monthly price is fixed for as long as you stay.' },
    ],
  },
  {
    slug: 'liverpool',
    city: 'Liverpool',
    region: 'Merseyside',
    intro: 'Get cheap, no-contract broadband in Liverpool. OCCTA delivers fibre internet across Merseyside with speeds up to 900Mbps, free installation, and a price that stays the same. No drama, just broadband.',
    metaDescription: 'Cheap broadband in Liverpool from £22.99/mo. No contract fibre up to 900Mbps across Merseyside. Cancel anytime, no price rises.',
    faqs: [
      { question: 'Is OCCTA broadband available in Liverpool?', answer: 'Yes — OCCTA covers Liverpool and surrounding areas in Merseyside via the Openreach network. Check your postcode to confirm availability.' },
      { question: 'How fast is broadband in Liverpool with OCCTA?', answer: 'Speeds in Liverpool range from 36Mbps to 900Mbps depending on your address and whether full fibre (FTTP) has been rolled out to your street.' },
      { question: 'What's included with Liverpool broadband?', answer: 'Every OCCTA plan includes unlimited data, a Wi-Fi router, free installation, and no contract. You can also add Digital Home Phone from £4.99/mo.' },
    ],
  },
  {
    slug: 'sheffield',
    city: 'Sheffield',
    region: 'South Yorkshire',
    intro: 'Reliable, affordable broadband in Sheffield — no contracts, no gimmicks. OCCTA offers fibre internet across South Yorkshire with speeds up to 900Mbps, free setup, and monthly pricing that never changes.',
    metaDescription: 'Cheap broadband in Sheffield from £22.99/mo. No contract fibre up to 900Mbps in South Yorkshire. No hidden fees, cancel anytime.',
    faqs: [
      { question: 'Can I get OCCTA broadband in Sheffield?', answer: 'Yes — OCCTA broadband is available across Sheffield and South Yorkshire through the Openreach fibre network. Enter your postcode to see what's available.' },
      { question: 'What speeds are available in Sheffield?', answer: 'Sheffield has growing full fibre coverage. Most addresses can access at least 36Mbps, with many areas now offering up to 900Mbps via FTTP.' },
      { question: 'Do I need to pass a credit check for Sheffield broadband?', answer: 'No — OCCTA does not require a credit check for any of our broadband plans. Sign up and get connected without credit concerns.' },
    ],
  },
  {
    slug: 'bristol',
    city: 'Bristol',
    region: 'South West England',
    intro: 'Cheap fibre broadband in Bristol with no contracts. OCCTA provides fast, honest internet across the South West with speeds up to 900Mbps, free router and installation, and a fixed monthly price. Broadband that respects your wallet.',
    metaDescription: 'Cheap broadband in Bristol from £22.99/mo. No contract fibre up to 900Mbps in the South West. Cancel anytime, no price rises.',
    faqs: [
      { question: 'Is OCCTA broadband available in Bristol?', answer: 'Yes — OCCTA covers Bristol and surrounding areas in the South West via the Openreach network. Check your postcode to see available plans and speeds.' },
      { question: 'What broadband speeds can I get in Bristol?', answer: 'Bristol has strong fibre coverage. Depending on your address, you can access speeds from 36Mbps up to 900Mbps with OCCTA.' },
      { question: 'Can I add a home phone to my Bristol broadband?', answer: 'Yes — you can add OCCTA Digital Home Phone to any broadband plan from £4.99/mo. It works through your broadband connection with crystal-clear HD calls.' },
    ],
  },
  {
    slug: 'leicester',
    city: 'Leicester',
    region: 'East Midlands',
    intro: 'Affordable, no-contract broadband in Leicester. OCCTA offers fibre internet across the East Midlands with speeds up to 900Mbps, free installation, and fixed pricing. Get online without the hassle or hidden costs.',
    metaDescription: 'Cheap broadband in Leicester from £22.99/mo. No contract fibre up to 900Mbps in the East Midlands. No hidden fees, cancel anytime.',
    faqs: [
      { question: 'Can I get OCCTA broadband in Leicester?', answer: 'Yes — OCCTA broadband is available in Leicester and surrounding East Midlands areas through the Openreach fibre network. Check your postcode to confirm.' },
      { question: 'What fibre speeds are available in Leicester?', answer: 'Most Leicester postcodes can access speeds from 36Mbps up to 900Mbps. Full fibre (FTTP) availability is expanding across the city.' },
      { question: 'How quickly can I get broadband set up in Leicester?', answer: 'Most OCCTA installations are completed within 7 working days. Your free router is included, and standard installation is also free.' },
    ],
  },
  {
    slug: 'nottingham',
    city: 'Nottingham',
    region: 'East Midlands',
    intro: 'Fast, cheap broadband in Nottingham with no contracts and no price rises. OCCTA serves the East Midlands with fibre speeds up to 900Mbps and a refreshingly simple service — fixed pricing, free setup, and no lock-in.',
    metaDescription: 'Cheap broadband in Nottingham from £22.99/mo. No contract fibre up to 900Mbps in the East Midlands. Cancel anytime, no hidden fees.',
    faqs: [
      { question: 'Is OCCTA broadband available in Nottingham?', answer: 'Yes — OCCTA covers Nottingham and the wider East Midlands via the Openreach network. Enter your postcode to check speeds and plans available at your address.' },
      { question: 'What speeds can I get in Nottingham?', answer: 'Nottingham has expanding fibre coverage. Speeds from 36Mbps to 900Mbps are available depending on your address and local infrastructure.' },
      { question: 'Is there really no contract for Nottingham broadband?', answer: 'Correct — all OCCTA plans are rolling monthly. No minimum term, no exit fees, and your price is locked in from day one.' },
    ],
  },
];

export const getLocationBySlug = (slug: string): Location | undefined =>
  locations.find((l) => l.slug === slug);

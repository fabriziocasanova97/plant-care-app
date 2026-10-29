import type { SVGProps } from 'react'

/** Small line icons drawn inline so they look the same on iPhone and Android (emoji don't). */
const base = (p: SVGProps<SVGSVGElement>): SVGProps<SVGSVGElement> => ({
  width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, ...p,
})

export const LeafIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14z" />
    <path d="M5 19c3-4 6-7 10-10" />
  </svg>
)

export const CameraIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.2-2h6.6L16.5 7h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" />
    <circle cx="12" cy="13" r="3.2" />
  </svg>
)

export const GearIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M5.6 18.4l1.6-1.6M16.8 7.2l1.6-1.6" />
  </svg>
)

export const DropIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 3.5c3.5 4.3 6 7.6 6 10.7a6 6 0 0 1-12 0c0-3.1 2.5-6.4 6-10.7z" />
  </svg>
)

export const PencilIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 20l4.2-1 10.1-10.1a2 2 0 0 0 0-2.8l-.4-.4a2 2 0 0 0-2.8 0L5 15.8z" />
    <path d="M13.5 7.5l3 3" />
  </svg>
)

export const CalendarIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="4" y="5.5" width="16" height="14.5" rx="2" />
    <path d="M4 10h16M8 3.5v4M16 3.5v4" />
  </svg>
)

export const SearchIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="6" />
    <path d="M20 20l-4.5-4.5" />
  </svg>
)

export const BackIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M15 5l-7 7 7 7" />
  </svg>
)

export const CheckIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
)

/** A potted sprout for empty states. */
export const SproutArt = (p: SVGProps<SVGSVGElement>) => (
  <svg width="120" height="120" viewBox="0 0 120 120" fill="none" aria-hidden="true" {...p}>
    <path d="M36 78h48l-5 30H41z" fill="var(--pot)" />
    <path d="M32 72h56v8H32z" fill="var(--pot-rim)" />
    <path d="M60 72V48" stroke="var(--green)" strokeWidth="4" strokeLinecap="round" />
    <path d="M60 56c-2-14-12-22-26-22 2 14 10 22 26 22z" fill="var(--leaf)" />
    <path d="M60 50c2-14 12-22 26-22-2 14-10 22-26 22z" fill="var(--leaf-2)" />
  </svg>
)

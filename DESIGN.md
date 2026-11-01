# OguLix PaaS Frontend Design Guidelines

Direction recorded 2026-11-01. This file is owned by the design owner (Frontend 1). An agent
transcribed it; no identity, palette, font, copy sample or asset was invented here.

## Design philosophy

A clean, white, minimalist, developer-focused interface. The visual direction is inspired by the
existing ServerTheIwaks project, adapted for a professional cloud platform dashboard.

## Dial

`Dial: ENERGY 2 / RHYTHM 1 / MOTION 1`

- **ENERGY 2**: presence comes from the green accent and the type scale, not from decoration.
  Gradients, glow, orbs and background patterns stay at zero.
- **RHYTHM 1**: a dashboard has to be predictable to scan, so uniform composition is a deliberate
  choice. Consistency is enforced through shared components, not per-page styling.
- **MOTION 1**: hover, focus and short transitions only. No scroll reveal, no parallax.

## Color system

| Role                 | Value     |
| -------------------- | --------- |
| Primary background   | `#FFFFFF` |
| Secondary background | `#F8FAF9` |
| Primary accent       | `#4CAF50` |
| Deep accent          | `#1B4332` |
| Primary text         | `#1F2937` |
| Secondary text       | `#64748B` |
| Border               | `#E5E7EB` |

## Typography

- Outfit for headings.
- Nunito for body text.
- Maintain a clear typographic hierarchy and readable sizing.

## UI principles

- Prefer whitespace over unnecessary decoration.
- Use subtle borders and minimal shadows.
- Keep cards simple and consistent.
- Use green primarily for primary actions and positive states.
- Use semantic colors for deployment and system statuses.
- Keep animations subtle and purposeful.
- Ensure responsive layouts for desktop, tablet and mobile.
- Maintain consistent spacing, border radius and component sizing.

## Avoid

- Excessive gradients and glowing effects.
- Excessive shadows.
- Oversized decorative illustrations.
- Unnecessary animations.
- Dark backgrounds as the default dashboard theme.
- Inconsistent colors and component styles.

## Contrast constraints

These follow from the palette above and are not a change of direction. They exist because
`#4CAF50` cannot carry text at WCAG AA:

| Combination                 | Ratio       | Verdict                                       |
| --------------------------- | ----------- | --------------------------------------------- |
| `#4CAF50` text on `#FFFFFF` | about 2.8:1 | Fails AA, never used for text                 |
| `#FFFFFF` text on `#4CAF50` | about 2.8:1 | Fails AA, never used for button labels        |
| `#1B4332` text on `#FFFFFF` | about 11:1  | Passes, used for headings and primary buttons |
| `#64748B` text on `#FFFFFF` | about 4.7:1 | Passes AA for normal text                     |

Rules that follow:

1. Primary button: `#1B4332` fill with white text.
2. `#4CAF50` is reserved for non-text indicators: status dots, focus rings, small accent marks,
   and borders where no text sits on top.
3. Body and label text never use `#4CAF50` on a light surface.

## Theme

Light only. Dark backgrounds are excluded by this direction, so no theme toggle is shipped. Shipping
a toggle whose second mode is unverified would be worse than shipping one verified mode. If dark mode
is wanted later, it is a new decision with its own contrast pass.

## Design system rules

- Build a cohesive design system with reusable components and centralized design tokens.
- Do not create different visual styles for individual pages.
- Tokens live in `frontend/src/app/globals.css` under `@theme`. Components consume tokens, not raw
  hex values.

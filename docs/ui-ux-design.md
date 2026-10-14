# FarmLink — UI/UX Design System

## Visual identity
Sustainable-farming editorial style. Cream page backgrounds, white cards, forest-green actions.

| Token | Value | Usage |
|---|---|---|
| Deep forest | `#163D2B` | Headings, footer |
| Primary green | `#28784A` | Primary buttons, links |
| Leaf | `#75A85B` | Accents, charts |
| Cream | `#F8F7F0` | Page bg |
| White | `#FFFFFF` | Cards |
| Charcoal | `#202923` | Body text |
| Muted | `#66736A` | Secondary text |
| Line | `#E4E9E1` | Borders |

## Typography
Inter (Google Fonts, system fallback). H1 30–48px extrabold, H2 20–24px, body 15–16px, small 12–14px. Prices always `₹X /unit` on one line; stock shown as `N unit left` or `Out of stock` (text + color, never color alone).

## Spacing & layout
4/8pt scale; cards `rounded-2xl`, `shadow-card`, 16–24px padding; max-w-7xl container; grids: products 1→2→3→4 cols; seller/admin tables collapse to cards on mobile (horizontal scroll with min-width as fallback).

## Components
Buttons (primary/secondary), inputs (label above, error below with `role=alert`), badges (status + text), cards, dialogs (filter drawer, confirm via `confirm()` replaced by inline dialogs where critical — cart remove uses confirm for simplicity, documented), skeletons, empty states (icon + title + next action), error box with retry, timeline (order tracking), tabs with `role=tablist`.

## Responsive strategy
- 320–390px: single column, sticky filter becomes drawer, tables scroll.
- 768px: 2-col grids, sidebar→tabs.
- 1024–1440px: 3-col grids, 240px filter rail.
- No horizontal overflow; dialogs capped at `w-80`/`max-w-xl`.

## Accessibility (WCAG 2.2 AA)
Visible `:focus-visible` ring, semantic landmarks, labelled inputs, alt text + image fallback, keyboard-operable drawer/dialog, `aria-busy`/`aria-live` for loading/qty, `prefers-reduced-motion` disables animation.

## Motion
Framer Motion hero entrance only; card hover scale; chart fades. No WebGL/video.

## Component inventory
Navbar, Footer, ProductCard, Filters, CartRow, PriceBreakdown, OrderTimeline, StatusBadge, StatCard, SalesChart, DemandCharts, LaneGroup, AuditTable, LanguageSwitcher.

## Wireframes (key pages)
- Landing: nav → hero (headline + 2 CTAs + stats) → benefits → featured grid → how-it-works → farmer CTA + testimonials (labelled illustrative) → FAQ → footer.
- Marketplace: search → rail (category/sort/stock) → grid → pagination.
- Product: gallery | info + qty + add-to-cart + fulfillment note + reviews + related.
- Checkout: address radio → fulfillment/payment → confirm → success cards with order numbers.

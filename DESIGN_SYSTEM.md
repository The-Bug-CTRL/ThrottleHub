# ThrottleHub — Dirt & Stone

The redesign keeps the existing Next.js/Firebase application and content contracts. `src/app/globals.css` owns reusable visual tokens and component styles. `src/lib/design-tokens.ts` is the portable token reference for a future Flutter Theme. The brand name, homepage copy and accent configuration remain in `src/lib/config.ts`.

## Palette

| Role           | Value     | Use                                                 |
| -------------- | --------- | --------------------------------------------------- |
| Dirt Brown     | `#78543D` | Primary actions, selected controls, links, focus    |
| Charcoal       | `#272725` | Header/footer, headings, strong text                |
| Warm Off-White | `#FAF9F6` | Main canvas                                         |
| Stone          | `#F3EEE6` | Secondary panels, selected rows, quiet empty states |
| White          | `#FFFFFF` | Cards, forms and input surfaces                     |
| Muted text     | `#6F6860` | Descriptions and supporting metadata                |
| Border         | `#DED9D2` | Controls, cards and section boundaries              |
| Success        | `#35614A` | Persisted success and recovered state               |
| Error          | `#A33632` | Validation and failed requests                      |
| Warning        | `#895E20` | Restrained alerts and stolen-bike reports           |

Hover brown is `#61422F`. Supporting tints stay neutral. Public images and actual editorial photographs provide color when genuine records exist. The interface contains no invented photographs, counts or inventory.

Six automated contrast checks cover white on brown, charcoal on off-white, muted text on off-white/stone, brown links on off-white, and white on charcoal. Each meets the WCAG AA 4.5:1 normal-text threshold. These checks do not replace a complete accessibility audit.

## Typography

Manrope variable font is loaded with `next/font/local`, weight range 400–800, display swap, with Arial/sans-serif fallback. The official Google Fonts font file and OFL licence are in `src/app/fonts`. There is no runtime Google Fonts request or decorative secondary typeface. Primary styles use regular 400, medium 500, semibold 600, bold 700 and sparse extra-bold 800.

Core scale: 12px metadata, 13px controls/small text, 15px interface body, 18px card headings, 22/28px section headings and responsive page titles. Dense supporting metadata uses smaller sizes; those need manual inspection for comfort on actual devices. Reading content is approximately 16px with generous paragraph spacing and a maximum readable width. Mobile form inputs use 16px where necessary to avoid automatic input zoom.

## Geometry and interaction

Spacing base: 4, 8, 12, 16, 24, 32, 48 and 64px. Control radius 6px, cards 10px, larger panels 12px. Borders carry most separation; shadows are subtle and used for raised cards/dialogs. Primary controls normally have 44–48px touch height; some compact metadata controls are smaller and remain a manual touch/accessibility review item.

Primary/secondary/quiet buttons, focus rings, labelled inputs/selects/checkboxes, active tabs, applied-filter chips, badges, notices, loading states, skeletons, empty states and section headings share the same tokens. `components/ui/primitives.tsx` provides reusable button/heading/loading/skeleton/badge building blocks without replacing every existing native form control.

`DialogHost`, `confirmAction` and `requestText` replace native confirm/prompt interactions across account, reporting, editorial and moderation flows. Native modal dialogs provide focus containment and Escape support; the host restores prior focus and queues requests. `Gallery` provides real-image thumbnail selection, previous/next controls, swipe selection and a keyboard-enabled larger viewer.

The mobile navigation is a native modal drawer with a labelled search form, full section/category access, account/messages and Sell action. The marketplace filter panel supports close/backdrop/Escape, focus cycling, return focus and scroll locking. Reduced-motion preferences disable animation/transitions and smooth scrolling.

## Layouts

- Header: restrained charcoal wordmark/nav, active section marker, account/search/Sell access. Marketplace routes expose a secondary category rail.
- Homepage: compact introduction/search, seven authentic off-road categories, real listings/discussions/news/reports/events, purposeful zero-data states and a modest seller invitation.
- Marketplace: bounded cursor query remains; sidebar on wide screens, dedicated filtering panel below 900px, active chips, sort/count controls and reset actions. Exact model-year filter is additive to existing structured queries.
- Listings: photography-led cards, structured metadata/price, image gallery, seller/contact panel, readable notes and optional-field suppression. Draft/sold owner cards lead to editing rather than a non-public advert URL.
- Selling: three validated stages, progress indication, compressed upload previews/reordering, review gallery and success screens shown after successful Firebase writes.
- Accounts: compact garage navigation, listings/favourites/profile views, approximate home-location controls, consistent auth/reset forms. No analytics widgets or invented metrics.
- Inbox: real participant names, listing context, latest-message previews, read-state indicators, quiet bubbles and mobile list/conversation navigation. It keeps the existing schema and role checks.
- Community/editorial: discussion rows and categories, restrained forum reply panels, comfortable reading measure, image/caption presentation, genuine article/event cards and distinct stolen-report status styling.
- Admin: shared role-aware utility navigation plus existing secure editors and moderation controls.

## Flutter mapping

Map brand to ColorScheme.primary, charcoal to onSurface, off-white to scaffold background, white/stone to surface roles and the semantic colors to their corresponding status states. Apply Manrope through TextTheme with the same weight hierarchy. Port spacing and radii directly as logical pixels, then test native-platform touch/typographic behavior. Firebase business rules remain in the existing shared contracts and Security Rules, not the stylesheet.

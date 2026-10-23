# Redesign implementation and review limits

## Implemented coverage

The shell, homepage, marketplace filters/cards/detail gallery, listing form, login/register/password reset, garage/favourites/profile settings, public rider profile, realtime inbox, forum/topics/replies/new-discussion form, news/articles/editor, stolen-bike directory/report/detail/moderation, events/editor, administration navigation and policy/help pages all use the new Manrope / Dirt & Stone system.

The largest structural changes are the charcoal header and mobile drawer, compact marketplace homepage, mobile filter panel, gallery viewer, validated selling steps/review/success state, account navigation, dedicated password-reset view and two-pane/mobile inbox. Community, editorial, stolen-bike and admin pages keep their functioning content structure while receiving consistent layout, controls, reading styles and dialogs.

No route was intentionally left in the former palette/typeface. No final logo or slogan was commissioned, no production service was connected, and no public sample content was added.

## Verification distinction

Browser discovery was attempted and returned **no browsers or native apps**. Consequently there are no screenshots, measured overflow results, client-console inspection or interactively verified focus/touch/form journeys. HTTP success, compiled HTML and tests do not establish visual correctness.

The implementation includes responsive rules for the requested sizes. The following viewport review is still **manual/unverified**, not a completed screenshot matrix:

| Width  | Layout intended by source                                                 | Manual checks still needed                                    |
| ------ | ------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 375px  | Compact header, category rail, stacked search, 2-card grid, filter drawer | Header fit, touch sizes, long titles, input zoom, upload form |
| 430px  | Mobile card/search layout, single-column community and reading            | Gallery gestures, dialog focus, inbox back navigation         |
| 768px  | Tablet grids and mobile navigation/filter panel                           | Drawer/scroll behavior, card density, intermediate spacing    |
| 1366px | Full desktop shell, sidebar search, 3-card browsing grid                  | Header balance, seller panel, editor widths                   |
| 1920px | Capped 1440px canvas, 4-column home listings                              | Content density, image crop, large-screen reading measure     |

## Priority interactive journeys

Use your own local accounts/content or an isolated test environment; do not seed the everyday marketplace for presentation.

1. Open the empty homepage and each main navigation section. Resize to the widths above. Confirm no horizontal overflow and good Manrope rendering.
2. Open/close mobile navigation by button and Escape; traverse focus. Search by one prefix, switch countries/categories and use filter chips/reset/dismissal. Test browser back/forward between category query URLs.
3. Register two accounts via the forms; exercise reset and verification links. Create a draft, upload/reorder/remove photos, validate stages, review/publish, edit, favourite, mark sold and archive. Verify only successful Firebase writes show success.
4. Inspect a genuine listing gallery, larger viewer, keyboard arrows and swipe; inspect optional motorcycle/parts notes. Check seller contact and report dialogs.
5. Send messages between actual participants. Confirm previews/unread state, privacy, long messages, keyboard composer and the mobile back-to-list action. Historical pagination still has the documented limits.
6. Create/edit/reply/report a discussion; test moderator lock/hide. Publish a genuine article/event as an admin and inspect reading layouts, cover captions and date/location presentation.
7. Submit a pending stolen report with public photos and restricted evidence. Check owner/admin-only evidence access, moderation, safe tips and recovery/archive states.

## Remaining design weaknesses / limits

Real photograph crops, very long titles, populated inboxes, lengthy discussions and dense admin queues have not been visually inspected here. Supporting metadata and some compact secondary controls need device-level readability/touch review. Native dialog behavior and Storage image/CORS behavior need the browser pass. Arbitrary compound Firestore filter indexes, historical pagination, privacy/support/abuse controls and final production SEO remain functional launch concerns, not solved by the redesign.

Motorcycle maintenance/rebuild/modification and parts-fitment notes still use the existing seller-provided free-text data contract. The redesign displays them in a dedicated readable section; it does not claim to have introduced a fully typed technical-specification schema.

The design is implemented as a coherent product system. Its final visual quality and mobile interaction quality still require the viewport review above before claiming commercial polish or launch readiness.

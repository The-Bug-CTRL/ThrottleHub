# Account navigation cleanup

29 October 2026.

Removed standalone Support links from desktop/mobile header navigation; nothing added to More. Existing footer Help & support remains /help. General notifications, favourites, messages, account and sell controls are unchanged.

My Account sidebar order: main account options (listings, favourites, profile settings, messages, promotions, public profile/reviews, follows), Help & Support, verified-admin tools (dashboard, support tickets, payment review, community moderation), then Sign Out. Admin support notification settings remain in that section, with the existing shared listener and unread support count. The duplicate admin card in main account content was removed. Non-admins, including moderator-only accounts, do not receive this admin section; existing server authorization is unchanged.

Added subtle section dividers, matching icons, small section labels and responsive single-column grouping. Sign Out remains the final sidebar action and uses the unchanged logout callback. The rest of the account page is unchanged.

Validation: TypeScript passed; ESLint 0 errors / 20 existing warnings; targeted navigation/role tests 3 passed. Production build result recorded after completion. Reviewed desktop/mobile CSS and route placement in source; no live browser/device visual acceptance performed. No Firebase Rules, authentication implementation, payments, Functions or live data changed. Nothing deployed.

Isolated production Next.js build passed, exit 0. Existing development .next preserved. Evidence: .tools/release-security-build.log and .tools/account-nav-lint.log.

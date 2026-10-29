# Support navigation and homepage spacing

28 October 2026. No deployment, Firebase policy/index/Functions change, Paystack change or live record modification.

- Header Support link points to /help on desktop/mobile. Removed its extra permission bell and popup; existing general Notifications component, messages/favourites/account controls remain unchanged.
- My Account now includes Administrator Tools for the existing verified admin custom claim only: Administrator Dashboard, Manage Support Tickets (/admin/support) with the existing staff unread count, and Support Notification Settings. Moderators without admin do not receive this section. Server-side API authorization remains unchanged.
- Moved the existing supportSignals badge/foreground-notification listener into one shared provider above Shell and account content. Desktop/mobile badges no longer create separate copies of that listener. Customers continue receiving their own unread reply count and the Support Centre's live conversation updates.
- Admin settings show enabled state, browser permission, explicit enable/disable button and support inbox link. Customer reply-alert settings are available in My Account too. Permission is requested only by button action. First snapshot establishes a baseline rather than producing stale notifications. Settings reset on account/role changes; browser errors have visible feedback.
- Alerts last only for the current open page/tab session; reload/close disables the opt-in. This is foreground browser Notification support, not background FCM push.
- Brown #78543D, charcoal #272725 and off-white #FAF9F6 account panel uses responsive card links and wrapping text.
- Added 32px separation when the stolen-bike awareness panel directly precedes the seller invitation, reduced to 24px at <=640px. When report cards occupy the space between them, their existing section spacing remains unchanged. Copy and colours preserved.

Validation: TypeScript passed; ESLint 0 errors / 20 existing warnings; isolated production Next.js build passed. Full emulator/integration results recorded below after completion. New static-render tests check customer/admin/checking-state navigation and absence of the extra header button. Existing security tests retain authoritative API and Rules denial coverage. Browser permission clicks and real desktop/mobile visual inspection have not been performed in this tool session; static rendering/build and responsive CSS review are not substitutes for device acceptance.

Final full isolated suite: **267 tests passed across 51 files, 0 failed, exit 0**, including support security, notification permissions, attachments, payment and marketplace regressions. Evidence: .tools/release-security-tests.log; production build .tools/release-security-build.log and exit JSON (0); lint .tools/support-navigation-lint.log. No live cloud acceptance was performed.

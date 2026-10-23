# First local administrator

1. Start `start-dev.bat` and create your own account through `/auth`.
2. Find its UID in the local emulator UI at http://127.0.0.1:4000/auth (or your authenticated account details).
3. Open `local-terminal.bat` in this project and run:

```text
npm run admin:bootstrap -- YOUR_EXISTING_LOCAL_UID
```

4. Sign out and back in to refresh claims. Visit `/admin`, `/admin/community`, `/admin/editorial` or `/admin/events`.

The trusted command refuses every mode/project except local emulator `demo-throttlehub`, routes Auth to loopback 9099 and requires the UID to exist. It grants `admin: true`, preserving existing custom claims; it creates no identity, password or public promotion endpoint. There is no predefined administrator.

`moderator: true` is also understood by Rules for forum/stolen review, but has no public grant interface. Admins may publish official news/events; moderators may not. A future remote-development role grant must use a separately authorised trusted Admin SDK operation for the explicitly named project. Never assign privileges using editable profile fields.

Account impersonation and unauthorised profile privilege fields are covered by emulator tests. Participation restrictions are role-protected Firestore records, not Auth identity deletion or suspension.

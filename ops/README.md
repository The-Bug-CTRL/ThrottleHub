# Media maintenance and monitoring

`ops/media-maintenance.ps1` wraps the existing trusted Next.js media maintenance modules. Default is read-only dry-run. It checks the fixed cloud project in the TypeScript entry point, takes a local exclusive lock, logs a structured summary under ignored `.tools/maintenance-logs`, and exits nonzero on failure. The photo/video scans are paginated, claim orphans transactionally and retain referenced historical media. They require their composite group indexes READY.

```powershell
# After approved index creation: supervised read-only inventory.
.\ops\media-maintenance.ps1
```

After separately approving cloud cleanup, a supervised apply is:

```powershell
.\ops\media-maintenance.ps1 -ApprovedCloudMaintenance
```

No apply or task registration was performed. For private testing, review a dry-run at the end of each test session and arrange explicitly approved cleanup. Do not run automatically while deciding retention or before reviewing candidates.

For a later approved Windows schedule on an always-on trusted operator machine, review this concrete command before registration:

```powershell
$maintenanceAction = New-ScheduledTaskAction -Execute "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -Argument '-NoProfile -NonInteractive -WindowStyle Hidden -File "E:\ThrottleHub_codex_code\ops\media-maintenance.ps1" -ApprovedCloudMaintenance'
$maintenanceTrigger = New-ScheduledTaskTrigger -Daily -At '03:00'
$maintenanceSettings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 15)
# MUTATING LOCAL REGISTRATION + FUTURE CLOUD DELETIONS: explicit approval required.
Register-ScheduledTask -TaskName 'ThrottleHub media cleanup' -Action $maintenanceAction -Trigger $maintenanceTrigger -Settings $maintenanceSettings -Description 'Approved orphan-only cleanup; inspect logs and task result daily.'
```

The executing identity needs authorized renewable credentials for the exact project/bucket. A task configured for an interactive user will not reliably run while logged out; use a deliberately provisioned operator/service identity for an unattended schedule. Never paste a private key into task arguments. The PC must be on, the checkout/bundled Node retained, and logs monitored. Do not use a laptop schedule as a public-launch reliability guarantee.

Monitoring is not installed. Before public launch, deploy an approved always-on scheduling mechanism, alert on any nonzero result, failed retries or no successful run within36 hours, and define a log retention/incident owner. Also monitor listing cleanupPending responses, application5xx/429, validation timeouts/CPU/RAM, bucket bytes/egress and Firestore reads/index fanout. Do not log request bodies, ID tokens, evidence contents or download tokens. Alerts-only budgets do not stop spend; separately review supported spend controls/quotas.

Known limits: no complete legacy image/news/stolen/evidence orphan scan; no recordless-object inventory/deletion; private evidence/PDF trusted validation and retention unresolved; file soft-delete may retain bytes after ordinary access is revoked. Do not expand cleanup prefixes or remove referenced sold/expired media to reduce costs.

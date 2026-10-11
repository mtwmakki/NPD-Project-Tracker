# Moving V1 features into V2

Since V77.11 the main address opens V2; V1 stays at `…/NPD-Project-Tracker/?v1` until everything below is
ported or dropped. Size: S = under half a day, M = about a day, L = several days.

## Already in V2
Sign-in, Dashboard (KPIs, chart, SLA, won/lost, factory load, "Needs you"), Inquiries (filters, search,
factory filter, pins, SLA sheet, tasks, next actions, ball in court, outcome, products, links, pipeline
statuses), Projects (cards / board, project page with milestones, actions, updates, overview, history,
KIV), Notifications (missed / due soon / awaiting reply, swipe done / snooze), create / edit / delete for
inquiries, projects, actions, tasks, next actions, updates and milestones (deletes go to V1's Recycle Bin
with Undo), changelog entries, own calendar picker, 10 styles, Ctrl+K search, merge-safe saving.

## Still only in V1

### Wave 1 — daily work (~3–4 days)
| Feature | Size |
|---|---|
| Standalone Tasks page: create / edit / duplicate / archive / bulk actions, categories, "all users" view for master | L |
| Follow-up prompt after ticking a task done ("Follow up: …" task with deadline + PIC) | S–M |
| Notifications: filter by person, This week / This month, edit deadline inline, once-a-day missed banner | S each |
| Next actions in alerts; stale projects and "waiting on others" in Needs you (V1 My Day sections) | S–M |
| Edit project PICs (name + role) | S |
| Gantt button on the project page (opens the existing gantt.html) | S |

### Wave 2 — finding things (~2 days)
| Feature | Size |
|---|---|
| Projects: type filter, KIV filter, search, sort | S each |
| Inquiries: sort, browse by year / month, saved views | S–M |
| Duplicate (copy) an inquiry or project | S |
| Calendar page (month / week view of every deadline) | M |

### Wave 3 — reporting (~3 days)
| Feature | Size |
|---|---|
| Full Excel export | S |
| Inquiry report (date range, choose fields) → Excel / PDF | M |
| Project report → PDF | M |
| Delivery Matrix tab + yellow / red day thresholds setting | M |
| Dashboard: project health table, workload per person, status / trend charts | M |
| Scheduler (weekly activity log) + weekly Excel export | M |

### Wave 4 — safety and housekeeping (~2 days)
| Feature | Size |
|---|---|
| Recycle Bin page: restore, permanent delete | M |
| Changelog viewer | S |
| Inactivity auto-logout + timeout setting | S |
| Backup Now (snapshot to Firestore) | S |
| Change own password | S |
| Presence (who's online) + display name | S |

### Wave 5 — admin and optional (~3–5 days)
| Feature | Size |
|---|---|
| Users & permissions admin (better done server-side, see the security fix) | L |
| Excel import (tracker's own format) | M |
| Duplicate-detection cleaner | M |
| NPD Pipeline page (kanban, stages, yearly targets) — only if used | L |
| Project "Current Activities" — only if used | M |

## Drop instead of porting
One-time PROJECT_SEEDS block; OneDrive code and the OneDrive daily backup (never runs); the hidden inline
Gantt tab (replaced by gantt.html); old sidebar code; Firebase setup guide / status UI; storage indicator;
density slider; draggable detail windows; nav-bar style and font switches (replaced by V2 styles); card vs
list view; Clear All Data; legacy "Overview" Excel importer (unless old sheets still arrive).

## Security fix (do before or alongside wave 1)
The Sheet bridge accepts anyone holding the token that is visible in the public code. Fix: bridge checks the
signed-in Firebase user against an allowed-email list, new token, old deployments archived, Firestore rules
locked, public sign-up off, V1 text escaped. Needs Apps Script + Firebase console access (see OPEN-QUESTIONS 3.1).

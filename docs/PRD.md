# F1 League Game — Product Requirements Document

---

## 1. Project Overview

F1 League Game is a responsive web application that lets groups of friends compete in private leagues alongside the Formula 1 season. Each race weekend, every player selects one driver from the F1 grid and earns the points that driver scores in the main race. Players cannot reuse a driver seat until they have worked through the entire grid, adding a layer of long-term strategy to each weekly pick.

Leagues run for the duration of the F1 season. The player with the most cumulative points at the end of the season wins. The app is free, requires no native install, and is designed to work seamlessly on both desktop and mobile browsers.

---

## 2. Core Requirements

### Functional Requirements

| # | Requirement |
|---|---|
| FR-01 | Users must create an account with an email address and password to participate |
| FR-02 | Any user can create a league and receive a shareable invite link |
| FR-03 | Users who click the invite link can join the league after authenticating |
| FR-04 | Each player must select one driver seat per race weekend before FP1 begins |
| FR-05 | Picks are hidden from other league members until the FP1 deadline passes |
| FR-06 | Players who miss the FP1 deadline receive zero points for that race week |
| FR-07 | A player cannot reuse a driver seat until they have used every seat on the grid |
| FR-08 | Once all 20 seats have been used, the player's pool resets completely |
| FR-09 | Selection is seat-based — if a driver is replaced mid-season, the seat is still considered used |
| FR-10 | Points are awarded using the standard F1 points system (main Sunday race only) |
| FR-11 | Sprint race points are excluded in V1 |
| FR-12 | Standings are cumulative across all races in the season |
| FR-13 | League admins can add/remove players, rename the league, and promote other members to admin |
| FR-14 | Leagues are archived at the end of the season and can be renewed for the next season |
| FR-15 | Players can be members of multiple leagues simultaneously |
| FR-16 | Players who join mid-season start with zero points and a full driver pool |
| FR-17 | The app sends email reminders before FP1 if a player has not yet submitted a pick |
| FR-18 | The app sends a post-race summary email with results and updated standings |

### Non-Functional Requirements

| # | Requirement |
|---|---|
| NFR-01 | The app must be fully responsive and usable on mobile browsers |
| NFR-02 | FP1 deadline enforcement must be accurate to the minute |
| NFR-03 | The app is free with no paid tiers |
| NFR-04 | Email/password is the only authentication method (no social login) |

---

## 3. Core Features

### 3.1 Authentication
- Email and password registration and login
- Password reset via email

### 3.2 League Management
- Create a league with a name; receive a unique invite link
- Join a league via invite link
- League admin panel: rename league, add/remove members, promote members to admin
- Support for multiple admins per league
- End-of-season archiving with full standings preserved
- League renewal at the start of a new F1 season (members retained, no new invite required)

### 3.3 Driver Selection
- Per-race pick interface displaying all 20 driver seats (name + team)
- Visual indicator showing which seats the player has already used
- Picks locked at FP1 deadline — no changes after cutoff
- Picks hidden from other members until FP1 deadline passes
- Pool reset logic: all seats become available again once the player has used all 20

### 3.4 Scoring
- Standard F1 points system: 25-18-15-12-10-8-6-4-2-1
- Zero points awarded for missed picks
- Bonus points system (to be defined in a future version)

### 3.5 Leaderboard & Stats
- Cumulative leaderboard for each league showing rank, player name, and total points
- Full per-race breakdown for every player: driver selected and points earned that week
- Unified dashboard for players in multiple leagues

### 3.6 Race Calendar
- Full F1 season schedule displayed in-app
- FP1 deadline shown for each race
- Upcoming race highlighted with countdown

### 3.7 Email Notifications
- **Pick reminder:** sent to players who have not yet submitted a pick ahead of the FP1 deadline
- **Post-race summary:** sent after race results are finalized, includes race outcome, player's points earned, and current league standings

---

## 4. Core Components

### 4.1 Frontend Components

| Component | Description |
|---|---|
| `AuthForms` | Login, registration, and password reset forms |
| `Dashboard` | Unified home screen showing all leagues the user belongs to, with pick status and rank for each |
| `LeagueCard` | Summary tile on the dashboard: league name, user rank, total points, pick status |
| `LeagueView` | Full league page with leaderboard and race-by-race breakdown |
| `Leaderboard` | Ranked list of all members with total points and drilldown access |
| `PlayerBreakdown` | Race-by-race history for a single player: driver picked, points earned |
| `DriverSelector` | Grid of all 20 driver seats; used seats marked; hidden picks for others revealed post-deadline |
| `RaceCalendar` | Season schedule with FP1 deadlines and pick status per race |
| `AdminPanel` | League settings: rename, manage members, promote admins |
| `InviteLink` | Generate and copy shareable league invite URL |

### 4.2 Backend Services

| Service | Description |
|---|---|
| `AuthService` | Registration, login, session management, password reset |
| `LeagueService` | Create, update, archive, and renew leagues; manage membership and admin roles |
| `PickService` | Submit and validate picks; enforce FP1 deadline; manage seat pool and reset logic |
| `ScoringService` | Ingest race results from F1 data API; calculate and store points per player per race |
| `NotificationService` | Trigger reminder emails before FP1 and summary emails after race results are available |
| `F1DataService` | Fetch and cache race schedule, FP1 session times, race results, and driver/team roster from external API |

### 4.3 Data Models

| Model | Key Fields |
|---|---|
| `User` | id, email, password_hash, created_at |
| `League` | id, name, invite_code, season_year, status (active/archived), created_by |
| `LeagueMember` | id, league_id, user_id, role (member/admin), joined_at |
| `Race` | id, season_year, round, name, fp1_deadline, race_datetime |
| `Pick` | id, league_id, user_id, race_id, seat_id, submitted_at |
| `Seat` | id, team_name, driver_name, season_year (represents a driver seat per season) |
| `RaceResult` | id, race_id, seat_id, position, points |
| `PlayerScore` | id, league_id, user_id, race_id, pick_id, points_earned |

---

## 5. App / User Flow

### 5.1 Onboarding Flow
```
Landing Page
  → Register (email + password)
  → Email verification
  → Dashboard (empty state — create or join a league)
```

### 5.2 League Creation Flow
```
Dashboard → "Create League"
  → Enter league name
  → League created → Invite link generated
  → Share invite link with friends
```

### 5.3 League Join Flow
```
User receives invite link
  → If not logged in: Register/Login
  → League join confirmation screen
  → Redirected to League View
```

### 5.4 Weekly Pick Flow
```
Dashboard → League Card shows "Pick pending" for upcoming race
  → Open Driver Selector
    → View all 20 seats (used seats marked)
    → Select an available seat
    → Confirm pick (locked until race week reset)
  → Pick saved; status updates to "Pick submitted"

FP1 Deadline passes
  → All picks revealed in League View
  → Driver Selector locked for this race

Race concludes
  → F1DataService fetches results
  → ScoringService calculates points
  → PlayerScore records created
  → Post-race summary email sent
  → Leaderboard updated
```

### 5.5 Leaderboard Drilldown Flow
```
League View → Leaderboard
  → Click any player
    → View race-by-race breakdown:
       Race | Driver Picked | Points Earned
```

### 5.6 End-of-Season Flow
```
Final race results processed
  → League status set to "archived"
  → Final standings locked and preserved
  → League accessible in read-only mode

Next season begins
  → Admin navigates to archived league
  → "Renew for [new season]" action
  → New league instance created with same members
  → Invite link available to add new members
```

---

## 6. Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| **Framework** | Next.js (React) | Full-stack, SSR/SSG, API routes, excellent DX |
| **Styling** | Tailwind CSS | Utility-first, fast responsive layouts |
| **Database** | PostgreSQL | Relational model fits leagues, picks, and scoring cleanly |
| **ORM** | Prisma | Type-safe schema management and migrations |
| **Authentication** | NextAuth.js | Built-in email/password support, session handling |
| **Email** | Resend | Modern transactional email API, generous free tier |
| **F1 Data API** | Jolpica API (formerly Ergast) | Free, well-documented, covers schedule, results, drivers |
| **Hosting** | Vercel | Zero-config Next.js deployment, edge functions |
| **Database Hosting** | Supabase or Railway | Managed PostgreSQL, easy Prisma integration |
| **Background Jobs** | Vercel Cron Jobs | Schedule deadline checks and post-race email triggers |

---

## 7. Implementation Plan

### Phase 1 — Foundation
- [ ] Initialize Next.js project with Tailwind CSS and Prisma
- [ ] Set up PostgreSQL database (Supabase or Railway)
- [ ] Implement data models: User, League, LeagueMember, Race, Seat, Pick, RaceResult, PlayerScore
- [ ] Implement authentication (NextAuth.js): register, login, password reset
- [ ] Integrate Jolpica API: fetch season schedule, FP1 times, driver/team roster
- [ ] Seed database with current season races and driver seats

### Phase 2 — Core Game Loop
- [ ] League creation with invite link generation
- [ ] League join flow via invite link
- [ ] Driver Selector component with seat pool logic and deadline enforcement
- [ ] Pick submission and validation (deadline check, pool check)
- [ ] Post-deadline pick reveal logic
- [ ] Seat pool reset when all 20 seats have been used

### Phase 3 — Scoring & Standings
- [ ] F1DataService: ingest race results after each race
- [ ] ScoringService: calculate points per pick using standard F1 system
- [ ] Leaderboard with cumulative standings
- [ ] Player race-by-race breakdown view

### Phase 4 — Notifications
- [ ] NotificationService: pre-FP1 pick reminder emails (players without a pick)
- [ ] NotificationService: post-race summary email (results + standings)
- [ ] Vercel Cron Jobs for deadline monitoring and result ingestion triggers

### Phase 5 — League Management & Dashboard
- [ ] Unified dashboard: all leagues, pick status, current rank per league
- [ ] Admin panel: rename league, add/remove members, promote admins
- [ ] Race Calendar view with FP1 deadlines
- [ ] In-season join flow (mid-season onboarding with zero points, full pool)

### Phase 6 — Season Lifecycle
- [ ] End-of-season archiving: lock league, preserve final standings
- [ ] League renewal flow for returning seasons

### Phase 7 — Polish & Launch
- [ ] Mobile responsiveness audit across all views
- [ ] Empty states, error states, and loading states
- [ ] Performance optimization (caching F1 data responses)
- [ ] Security review (auth, invite link validation, deadline enforcement)
- [ ] Beta test with a small group of real users

---

## Appendix: Out of Scope (V1)

- Sprint race points
- In-app chat or social features
- Native iOS / Android apps
- Monetization or paid tiers
- Custom bonus point rules

## Appendix: Open Questions

- Exact bonus points criteria and values (to be defined before V2 scoring work begins)
- Tie-breaking rules on the leaderboard (e.g., most recent race winner, most race wins)
- How many hours before FP1 the pick reminder email should be sent

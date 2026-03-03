 PRD: F1 League Game

  1. Overview

  A web application where friends compete in private leagues by picking one Formula 1 driver per race weekend and accumulating the points that driver earns in the main race. The player with the most points at the end of the F1 season
  wins their league.

  ---
  2. Goals

  - Give F1 fans a lightweight, strategic game to play alongside each race weekend
  - Require minimal time investment per week (one pick per race)
  - Work seamlessly on both desktop and mobile browsers

  ---
  3. Core Game Mechanics

  Driver Selection

  - Each player selects one driver seat per race weekend before FP1 begins
  - Once the FP1 deadline passes, picks are locked and revealed to all league members
  - A player cannot reuse a driver seat until they have used every seat on the grid at least once
  - When all 20 seats have been used, the player's pool resets and they can pick any seat again
  - Selection is seat-based, not driver-based — if a team replaces a driver mid-season, the seat is still considered used

  Scoring

  - Points are awarded based on the standard F1 points system (25-18-15-12-10-8-6-4-2-1)
  - Sprint race points are excluded (main Sunday race only)
  - Bonus points system to be defined in a later version
  - Players who miss the FP1 deadline receive zero points for that race week
  - Players who join mid-season start with zero points and a full driver pool

  Leaderboard

  - Cumulative total points across all races in the season
  - Full per-race breakdown visible for every player: which driver they picked and how many points they scored that week
  - Unified dashboard for players in multiple leagues showing status across all leagues

  ---
  4. Leagues

  Creation & Membership

  - Any registered user can create a league
  - The creator shares an invite link — anyone with the link can join
  - No minimum or maximum player count
  - Players can be members of multiple leagues simultaneously, each tracked independently

  Admin Controls

  - League creator is the default admin
  - Admins can:
    - Add and remove players
    - Rename the league
    - Promote other members to admin
  - Multiple admins are allowed per league

  Season Lifecycle

  - Leagues are active for one F1 season
  - At season end, leagues are archived — final standings remain viewable
  - Archived leagues can be renewed at the start of the next season, retaining existing members without requiring a new invite link

  ---
  5. User Accounts

  - Email and password authentication only (no social login)
  - Account required to join or create a league
  - Email address used for game notifications

  ---
  6. Email Notifications

  ┌────────────────────────────────────────────────┬──────────────────────────────────────────────────────────────────────────────────────────┐
  │                    Trigger                     │                                      Email Content                                       │
  ├────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────┤
  │ FP1 deadline approaching and no pick submitted │ Reminder to make their selection before the deadline                                     │
  ├────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────┤
  │ Race results finalized                         │ Post-race summary with race results, their driver's points, and current league standings │
  └────────────────────────────────────────────────┴──────────────────────────────────────────────────────────────────────────────────────────┘

  ---
  7. In-App Experience

  Driver Selection Screen

  - Displays all 20 driver seats with driver name and team
  - Seats the player has already used are visually marked (unavailable until pool resets)
  - Other players' picks for that race are hidden until the FP1 deadline passes

  Race Calendar

  - Displays the full F1 season schedule
  - Shows the FP1 deadline datetime for each upcoming race
  - Highlights the next upcoming race

  Dashboard (Home Screen)

  - Unified view across all leagues the player belongs to
  - For each league: current rank, total points, and pick status for the upcoming race (submitted or pending)

  League View

  - Leaderboard with cumulative standings
  - Drilldown per player: race-by-race history of driver picked and points scored

  ---
  8. F1 Data

  - A third-party F1 data API will be evaluated during the build phase to provide:
    - Race schedule and FP1 session times
    - Race results and points
    - Current driver/team roster

  ---
  9. Tech Stack (Recommended)

  ┌──────────┬────────────────────────────────────────────────────┬──────────────────────────────────────────────────────────────┐
  │  Layer   │                     Technology                     │                          Rationale                           │
  ├──────────┼────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────┤
  │ Frontend │ Next.js (React)                                    │ SSR for performance, great mobile experience, wide ecosystem │
  ├──────────┼────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────┤
  │ Styling  │ Tailwind CSS                                       │ Fast responsive UI development                               │
  ├──────────┼────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────┤
  │ Backend  │ Next.js API Routes or Node.js (Express)            │ Unified codebase, easy deployment                            │
  ├──────────┼────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────┤
  │ Database │ PostgreSQL                                         │ Relational data fits leagues, picks, scoring well            │
  ├──────────┼────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────┤
  │ ORM      │ Prisma                                             │ Type-safe, clean schema management                           │
  ├──────────┼────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────┤
  │ Auth     │ NextAuth.js                                        │ Email/password support, session management                   │
  ├──────────┼────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────┤
  │ Email    │ Resend or SendGrid                                 │ Transactional email for reminders and summaries              │
  ├──────────┼────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────┤
  │ Hosting  │ Vercel (frontend) + Supabase or Railway (database) │ Low-ops, scalable free tiers                                 │
  ├──────────┼────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────┤
  │ F1 Data  │ Jolpica API (formerly Ergast) or OpenF1            │ Free, reliable F1 data                                       │
  └──────────┴────────────────────────────────────────────────────┴──────────────────────────────────────────────────────────────┘

  ---
  10. Out of Scope (V1)

  - Sprint race points
  - In-app chat or social features
  - Monetization / paid tiers
  - Native mobile apps
  - Custom bonus point rules (defined in a later version)

  ---
  11. Open Questions

  - Exact bonus points system (to be defined before implementation)
  - Tie-breaking rules on the leaderboard
  - How far in advance the FP1 deadline reminder email is sent

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

This is the project's only rules file. Change it through a PR.

## Overview

StudySpot helps students find study places near campus and see how crowded and noisy a place is right now. That live status comes from students' own check-ins.

- `backend/`: the finished API (Node 20+, ESM, Express 5, Mongoose, Socket.IO, Zod). It returns JSON only and renders no HTML.
- `frontend/mobile`: the student mobile app. **Build this first.**
- `frontend/admin`: the web admin (built after mobile was finished). It covers every `/api/admin` endpoint plus creating approved places; Swagger UI at `http://localhost:4000/api/docs` is still there for anything else.
- **Out of scope because the backend has no API for them:** password reset, profile editing, image upload by students.

Mobile feature order: accounts and place discovery → check-in and realtime → reviews, favorites, reports, place submission, leaderboard → polish.

## Commands

**Backend**, run from `backend/`. No linter, formatter, or build step is configured.

```bash
npm ci
cp .env.example .env            # then set MONGODB_URI and two distinct JWT secrets (32+ chars)
npm run dev                     # http://localhost:4000

npm test
npm run test:coverage
node --test test/unit/config.test.js                                           # one file
node --test --test-name-pattern="rating includes" test/unit/services.test.js   # one test

npm run create-admin                            # upsert admin from ADMIN_EMAIL / ADMIN_PASSWORD (12+ chars)
npm run seed:hcm -- admin@example.com           # idempotent; only inserts missing places
npm run seed:erd-demo                           # writes only to studyspot_erd_demo; MONGODB_URI path must be /studyspot
npm run smoke:cloudinary -- admin@example.com   # touches real Cloudinary; SMOKE_BASE_URL targets a running server
python scripts/generate-diagrams.py             # rewrites docs/StudySpot-ERD-System-Architecture.drawio
```

`dotenv` resolves `.env` from the working directory, so npm scripts need `backend/.env`. A `.env` at the repo root is not loaded, and `config()` then throws `MONGODB_URI is required`.

Tests need neither `.env` nor a running MongoDB. `test/api.test.js` starts `mongodb-memory-server`, which downloads a `mongod` binary on first run. `test/unit/` uses no database.

**Mobile**, run from `frontend/mobile` (Expo SDK 58, created with `create-expo-app`). Copy `.env.example` to `.env` first.

```bash
npm ci
npx expo start
npm run lint
npx tsc --noEmit
npm test
npx expo export --platform android                                                   # bundle check without a device
npx openapi-typescript ../../backend/src/docs/openapi.yaml -o src/api/schema.d.ts   # rerun when the API changes
EXPO_OFFLINE=1 npx expo install <package>                                            # add a library at the SDK version
```

`openapi-typescript` runs through `npx` only; its TypeScript 5 peer conflicts with the app's TypeScript 6. Use `EXPO_OFFLINE=1` with `expo install` when the network blocks Expo's version API.

**Admin**, run from `frontend/admin` (Vite, React, TypeScript). Copy `.env.example` to `.env`; `VITE_API_URL` is the backend URL without `/api`.

```bash
npm ci
npm run dev                     # http://localhost:3000, already in the backend's default CLIENT_ORIGINS
npm run lint                    # oxlint
npm run typecheck               # tsc -b
npm test                        # vitest
npm run build
npx openapi-typescript ../../backend/src/docs/openapi.yaml -o src/api/schema.d.ts   # rerun when the API changes
```

## Backend architecture

**Composition.** `server.js` connects to Mongo, starts the expired-status timer, and listens. `http.js` builds the HTTP server and Socket.IO. `app.js` mounts middleware and routers. Keep this split: `createApp(cfg, io)` must stay free of side effects so tests can build it directly.

**Dependency injection.** `cfg` (from `config()`) and `io` are passed down through router factories, e.g. `placesRouter(cfg, io)` → `checkinController(cfg, io)`. Controllers that need neither are plain objects. Don't read `process.env` in `src/` outside `config.js`; the exception is Cloudinary credentials, which `imageService` reads per call so that a missing configuration only causes a 503 on upload. `app.js` receives a `{ to }` shim rather than the real `io`, and only `.to(room).emit(...)` is available on it.

**Request flow.** Route → `asyncRoute(handler)` → controller → `services/` or models → JSON. Controllers validate with `parse(zodSchema, input)` and `assertId(id)` from `utils/common.js`, and fail by throwing `HttpError(status, message)`. `middleware/error.js` is the only place that writes error responses, and it also maps Mongo duplicate keys to 409 and cast errors to 400. Serialize users through `views/userView.js`.

**Route mounting order.** `communityRouter` is mounted at `/api` last and applies `requireAuth` to everything reaching it, so any unmatched `/api/*` path returns 401 instead of 404. New public routers must be mounted before it.

**Place moderation.** Student submissions start as `approval: 'pending'`; admin submissions are approved immediately. Every public operation (list, get, reviews, check-ins, socket join) must filter on `approval: 'approved'`. Only `/api/admin` sees other states.

**Derived state.** These fields are stored on documents, so whatever changes the source must also refresh them:

- `Place.liveStatus` comes from `recalculateStatus` in `statusService.js`: the latest unexpired check-in per user, averaged, and `unknown` below `cfg.minSamples`. It saves to Mongo first, then emits `place:status` to room `place:<id>`, for approved places only. Calls are queued per place in an in-memory map, which assumes a single API process. Expiry is handled by `refreshExpiredStatuses` on a timer, and on `place:join` in `gateways/placeSocket.js`.
- `Place.ratingAverage` and `ratingCount` come from `updateRating` in `ratingService.js`, which counts non-hidden reviews only. Call it after any review create, update, delete, or hide.
- `User.reputation` is incremented by `awardReputation`. Idempotency comes from the unique index on `ReputationEvent {user, place, kind, day}`: a duplicate key skips the increment. `day` is a UTC date for check-ins and `'lifetime'` for reviews.

**Auth.** Access and refresh JWTs use separate secrets, pin HS256, and carry a verified `type` claim. Refresh tokens are stored as SHA-256 hashes and rotate on every use. `requireAuth` reloads the user on each request, so `req.user` is a Mongoose document. Public registration only creates `student` accounts; admins come from `npm run create-admin`.

**Keeping the backend in sync.**

- `src/docs/openapi.yaml` is hand-written, not generated from routes. Update it when an endpoint changes. Tests assert only a few paths, so a missing endpoint will not fail them.
- `test/api.test.js` defines its own `cfg`, so new config keys must be added there too. It calls `Model.init()` because `$near` and unique-index behaviour depend on indexes existing.
- `scripts/generate-diagrams.py` encodes the data model itself and does not read `src/models/`, so schema changes need editing there before regenerating.

## Mobile: stack and structure

Prioritize Android, and also check on a real phone.

| Concern | Choice |
|---|---|
| Platform | Expo, React Native, TypeScript |
| Navigation | Expo Router |
| Server data | TanStack Query |
| Maps | `react-native-maps` (Android builds need a Google Maps API key: `GOOGLE_MAPS_API_KEY` in `frontend/mobile/.env`, read by `app.config.ts`) |
| Location | `expo-location` |
| Token storage | `expo-secure-store` |
| Realtime | `socket.io-client` |
| API types | Generated with `openapi-typescript` |
| Fonts | `@expo-google-fonts/barlow-condensed`, `@expo-google-fonts/be-vietnam-pro` |
| Icons | `react-native-svg`, with paths copied from `frontend/design/` |
| Tests | `jest-expo` |

```text
frontend/mobile/
  src/app/          Screens and navigation (Expo Router); composition only
  src/api/          API client, generated schema, API hooks
  src/auth/         Token storage, session handling
  src/realtime/     Socket.IO connection
  src/components/   Shared components
  src/theme/        Colors, spacing, font sizes
```

Set `EXPO_PUBLIC_API_URL` in `frontend/mobile/.env` and commit the variable name to `.env.example`. The URL has no `/api` suffix, because the OpenAPI paths already include it. Socket.IO connects to the same URL. `EXPO_PUBLIC_*` variables end up in the app bundle, so never put secrets in them.

- Android emulator: `http://10.0.2.2:4000`
- Real phone: `http://<LAN IP of the machine running the backend>:4000`

## Mobile: visual design

`frontend/design/` is the visual source of truth for all 15 screens. `<screen>.dc.html` holds the layout, copy, and values for every state, and `<screen>.png` shows one state. Follow them, and don't redesign. `frontend/PLAN-B.md` explains how to read these files. People can also view them at https://claude.ai/artifact/NMFgBbUsV3toaKCAWPvoKV, which needs a shared, signed-in browser. Map areas are placeholders, and all ratings, counts, names, and review text are example data.

The look is a ruled student notebook: flat paper and blue ballpoint ink. No gradients, shadows, emoji, glass effects, or rounded cards. The red margin line in `frontend/design/` and on the canvas was removed from the app; don't build it.

| Token | Value |
|---|---|
| Paper background | `#F6F7F9` |
| Ink (primary) | `#16308F` |
| Text | `#141A2E` |
| Secondary text | `#3F4963` |
| Placeholder text | `#5A647D` |
| Field underline | `#8C96AE` |
| Row rule | `#C9D1E3` |
| Error and highest level | `#B8321C` |
| Loading block | `#E1E5EF` |

- Fonts: Barlow Condensed 700 for screen titles (44px; 68px on Login), Be Vietnam Pro for everything else. Row title 16px/600, secondary 13px, meta 12px.
- Layout: content starts 40px from the left and ends 20px from the right.
- Lists: separate rows with a 1px rule, not cards. A 1.5px ink rule sits under the screen title.
- Controls: primary button 54px high, secondary 48px, radius 2px. Inputs have a 1.5px underline and no box. Touch targets are at least 44px.
- Tab bar: 84px high, 1.5px ink rule on top, active tab has a 3px ink bar and a filled icon.
- Live status: three bars 6px wide and 8, 13, 18px high, 2px apart. Fill one bar per level with ink; level 3 fills all bars in the error color. Crowd labels are `Vắng`, `Vừa`, `Đông`; noise labels are `Yên tĩnh`, `Vừa`, `Ồn`.
- Loading uses static blocks in the row layout. Empty and error states are left-aligned: heading, one sentence, one button.

## Mobile: screens

The tab bar has four tabs: Khám phá, Yêu thích, Xếp hạng, Hồ sơ. Guests open straight into Khám phá and can browse. Any action that needs an account sends them to Đăng nhập; "Để sau" returns them. Yêu thích and Hồ sơ show a sign-in prompt to guests.

| # | Screen | Opened from | API | Extra states besides loading and error |
|---|---|---|---|---|
| 1 | Đăng nhập | Login-required action | `POST /api/auth/login` | Invalid input, wrong credentials |
| 2 | Đăng ký | Đăng nhập | `POST /api/auth/register` | Invalid input, email already used (409) |
| 3 | Khám phá | Tab | `GET /api/places` | Map, list, no location, no results |
| 4 | Bộ lọc | Khám phá | Query params of `GET /api/places` | Default, selected |
| 5 | Chi tiết địa điểm | Khám phá, Yêu thích | `GET /api/places/{id}`, `PUT` and `DELETE /api/favorites/{placeId}`, socket | With photo, connection lost, not found (404) |
| 6 | Check-in | Chi tiết | `POST /api/places/{id}/checkins` | Too far (403), cooldown (429), no location permission, success |
| 7 | Hồ sơ | Tab | `GET /api/auth/me`, `POST /api/auth/logout` | Guest |
| 8 | Yêu thích | Tab | `GET /api/favorites` | Empty, guest |
| 9 | Xếp hạng | Tab | `GET /api/reputation/leaderboard` | Empty |
| 10 | Danh sách đánh giá | Chi tiết | `GET /api/places/{id}/reviews` | Empty |
| 11 | Viết hoặc sửa đánh giá | Chi tiết, Danh sách đánh giá | `PUT` and `DELETE /api/places/{id}/reviews/me` | Invalid input, edit, hidden by admin (403) |
| 12 | Báo cáo địa điểm | Chi tiết | `POST /api/reports` | Invalid input, already pending (409), success |
| 13 | Báo cáo của tôi | Hồ sơ | `GET /api/reports/me` | Empty |
| 14 | Đề xuất địa điểm | Hồ sơ | `POST /api/places` | Invalid input, sent |
| 15 | Chọn vị trí | Đề xuất địa điểm | None | No current location |

Backend gaps the screens already account for:

- `GET /api/reports/me` returns the place ID only, so Báo cáo của tôi shows no place name.
- The leaderboard returns only `name` and `reputation`. Highlight the user's row only when it is in the list.
- There is no endpoint for a user's own review or submitted places. Find the review in the reviews list; submitted places can't be listed.
- `GET /api/favorites` and the leaderboard return `{ items }` with no pagination.

### Work split

- Person A: screens 3, 4, 5, 6, 15, and Socket.IO. Shared parts: `usePlaces` and `useCheckin` in `src/api/hooks/`, Socket.IO in `src/realtime/` (`usePlaceRealtime(id)` writes `place:status` into the `usePlace` cache), position helpers in `src/location/location.ts` and `useCurrentLocation.ts`, and the Khám phá filters store in `src/explore/filters.ts`.
- Person B: screens 1, 2, 7 to 14, `src/api/`, and `src/auth/`. Person B's plan, routes, and progress are in `frontend/PLAN-B.md`; read it when working on these.
- Whoever needs a shared part first builds it at the path in `frontend/PLAN-B.md`. Reuse it rather than creating another.

Don't build the other person's screens.

## Mobile: code rules

- All requests go through the API client in `src/api/`. Don't call `fetch` directly from screens.
- Server data lives in TanStack Query; don't copy it into separate state.
- API types come from `schema.d.ts`. Don't hand-write them, and don't edit that file by hand.
- Screens that show lists or call the API must handle loading, empty, and error states.
- Colors and spacing come from `src/theme/`, not hard-coded values in screens.
- All user-facing text is in Vietnamese.

## Admin web

Only accounts with `role: 'admin'` can sign in; others are signed out at once with "Tài khoản này không có quyền quản trị." Create admins with `npm run create-admin`.

| Concern | Choice |
|---|---|
| Build | Vite, React, TypeScript |
| Routing | `react-router` |
| Server data | TanStack Query |
| Fonts | `@fontsource/barlow-condensed`, `@fontsource/be-vietnam-pro` |
| Tests | `vitest` |

```text
frontend/admin/src/
  pages/        Tổng quan, Địa điểm (inline editor, image upload), Thêm địa điểm, Báo cáo, Đánh giá, Đăng nhập
  components/   ui.tsx (Button, fields, FilterTabs, StateMessage, LoadingRows, Pagination...), Layout, PlaceForm
  api/          client.ts, errors.ts, endpoints.ts, hooks.ts, types.ts, generated schema.d.ts
  auth/         tokens.ts, session.tsx, sessionContext.ts
  utils/        format, labels, validation, placeForm, placeDiff
  theme.css     Design tokens as CSS variables; app.css uses only these
```

- There are no admin designs. The admin reuses the mobile notebook look (tokens, fonts, 1px row rules, 1.5px ink title rule, 2px radius, underlined inputs, no margin line) with wide layouts and row lists instead of cards.
- The API client follows the same rules as mobile (single refresh, retry once, no refresh on auth endpoints, network failure keeps tokens). The access token lives in memory; the refresh token is in `localStorage` so a reload keeps the session.
- `PATCH /api/admin/places/{id}` gets only the fields that changed (`utils/placeDiff.ts`). There is no admin endpoint to read one place in any approval state, so editing happens inline from the list.
- The admin lists populate `user` (`name`, `email`) and `place` (`name`, `address`), but `openapi.yaml` types them as ID strings. Read them through `populated()` in `api/types.ts`; don't hand-write types.
- Coordinates are typed as latitude and longitude fields and sent as `[longitude, latitude]`. There is no map library in the admin.
- Image upload needs Cloudinary on the backend; without it the API answers 503 and the editor says so.

## API conventions and easy mistakes

**General**
- Lists return `{ items, page, limit, total }`; `page` starts at 1 and `limit` is capped at 100.
- Errors are `{ "error": "..." }` with English messages. Map them to Vietnamese in the API client by status and message, with a general Vietnamese fallback. Never show the raw English text.
- Coordinates are always `[longitude, latitude]`. Request bodies use `coordinates`; models store GeoJSON `location`. Query strings use `lat` and `lng`, which must be sent together.
- `null` for `amenities.wifi`, `amenities.outlets`, or `minDrinkPrice` means unverified, not "none".
- Filtering on `wifi`, `outlets`, or `maxPrice` excludes places where that value is `null`. Seed data uses `null` for all of them, so these filters may return nothing.
- `crowd` and `noise` can be `unknown` when too few people have checked in. A check-in may only send `low | medium | high` and `quiet | moderate | loud`.

**Auth**
- `accessToken` expires after 15 minutes, and each `refreshToken` works only once.
- On a 401, call `/api/auth/refresh` and retry the request exactly once. If the refresh fails, clear the tokens and return to the login screen.
- Allow only one refresh at a time; other requests wait for its result. A parallel refresh gets a 401 because the token was already used.
- After a refresh, also store the new `refreshToken`.
- `/api/auth` allows 60 requests per 15 minutes and returns 429 beyond that. Don't retry indefinitely.

**Check-in**
- Send the current coordinates; the user must be within 250 m. A wrong location returns 403.
- Each user can check in once per 15 minutes at a place, otherwise the API returns 429.
- When testing on an emulator, mock a location near the place.

**Realtime**
- When a place detail screen opens, send `place:join` with `placeId` and read the `{ ok, error }` callback. When it closes, send `place:leave`.
- Listen for `place:status` with `{ placeId, liveStatus }` and update the TanStack Query cache.
- On reconnect, send `place:join` again and refetch over REST. MongoDB is the source of truth; the socket is only a notification.
- The socket works per place, so map markers do not update on their own.

**Reviews and places**
- Each user has one review per place: `PUT` creates or updates it, `DELETE` removes it. A review hidden by an admin cannot be edited (403).
- Places submitted by students wait for approval and don't appear in public lists until then. Tell the user this clearly.

## Limits for AI

- Use only APIs listed in `backend/src/docs/openapi.yaml`. Don't invent endpoints or fields.
- When working on the frontend, don't change `backend/` without team agreement. If an API is missing, stop and tell the person you're working with.
- Reuse existing components, hooks, and the API client rather than creating duplicates.
- Don't add libraries outside the stack table without updating this file.
- Don't build features outside the scope in Overview.

## Git

- For now `haupham` is the working branch: branch `feature/<feature-name>` from the latest `haupham` and open PRs into it. Never push directly to `main`.
- Before opening a PR, mobile lint and type checks must pass. If you changed the backend, `npm test` must pass too.
- Each PR covers one feature and is reviewed by the other person, even when AI wrote the code.
- Add a line here for each new decision or recurring AI mistake.

# Person B work plan

This file lets a new session with no chat history continue Person B's work. Read `CLAUDE.md` first, then this file.

## How to work

1. Find the first unchecked task under Tasks. Do that task only.
2. Base the work on the latest `haupham`. Create a new branch and open the PR into `haupham`. Don't touch `main`.
3. Don't stop to ask about anything this file or `CLAUDE.md` answers. If something is genuinely blocked, finish what you can and report the blocker in the PR.
4. In the same PR, tick the task and add a line under Session notes with anything the next session must know.
5. End with a report: what changed, which commands passed, what you could not verify, and what to run on a real device.

Every task must pass these from `frontend/mobile` before the PR:

```bash
npm run lint
npx tsc --noEmit
npx expo export --platform android
```

Task B2 and later also run `npm test`. These sessions can't open the app on a phone, so never claim a screen works on a device. List it for manual checking instead.

## Context

- Person B and Person A work separately for now. Person A's work may not exist on `haupham` yet.
- If a shared part this plan needs is missing, build it at the path given here. Person A will reuse it. Don't build Person A's screens.
- Backend code is finished. Don't change `backend/`.
- The design for each screen is in `frontend/design/`. See Reading the design files.

## Reading the design files

Each `<screen>.dc.html` is one screen, and `<screen>.png` shows one state.

- Lists of states are in `data-props`, under `state.options`.
- In most files each state is one `<sc-if value="{{sN}}">` block. `sN` is the state at index N in `state.options`. Read the block for each state you build.
- `login.dc.html` and `favorites.dc.html` are hand-written. Their states are chosen by flags in `renderVals()`, and `favorites.dc.html` repeats rows with `<sc-for>`.
- Copy text, colors, sizes, and spacing from the inline styles. Translate the layout to React Native; don't port the HTML.
- Names, ratings, counts, and dates in these files are example data. Render real API data.

## Routes

Use these exact Expo Router paths. If the template puts routes in `src/app/`, keep that folder and the same names below it.

| Route | Screen | Owner |
|---|---|---|
| `app/(tabs)/index.tsx` | Khám phá | A, placeholder by B |
| `app/(tabs)/favorites.tsx` | Yêu thích | B |
| `app/(tabs)/leaderboard.tsx` | Xếp hạng | B |
| `app/(tabs)/profile.tsx` | Hồ sơ | B |
| `app/(auth)/login.tsx` | Đăng nhập | B |
| `app/(auth)/register.tsx` | Đăng ký | B |
| `app/places/[id]/index.tsx` | Chi tiết địa điểm | A, placeholder by B |
| `app/places/[id]/checkin.tsx` | Check-in | A |
| `app/places/[id]/reviews.tsx` | Danh sách đánh giá | B |
| `app/places/[id]/review.tsx` | Viết hoặc sửa đánh giá | B |
| `app/places/[id]/report.tsx` | Báo cáo địa điểm | B |
| `app/my-reports.tsx` | Báo cáo của tôi | B |
| `app/propose.tsx` | Đề xuất địa điểm | B |
| `app/pick-location.tsx` | Chọn vị trí | A, placeholder by B |
| `app/filter.tsx` | Bộ lọc | A |

## API client rules

- Base URL comes from `EXPO_PUBLIC_API_URL`, with no `/api` suffix.
- Attach `Authorization: Bearer <accessToken>` when a token exists.
- On a 401 from a protected request, refresh once, then retry that request once.
- Never refresh for `/api/auth/login`, `/api/auth/register`, `/api/auth/refresh`, or `/api/auth/logout`. A wrong password is also a 401 and must show as a login error.
- Only one refresh may run at a time; other requests wait for it. Refresh tokens work once, so a second parallel refresh fails.
- `POST /api/auth/refresh` takes `{ refreshToken }` and returns `{ user, accessToken, refreshToken }`. Store both new tokens.
- If the refresh fails, clear tokens, set the session to guest, and send the user to login when the current action needs an account.
- A network failure is not a logout. Keep the tokens and show the connection error.
- Don't parse every response as JSON. 204 responses have no body, and the `/api/auth` rate limiter answers 429 with plain text.

### Error mapping

Map errors in one place, `src/api/errors.ts`, and never show the raw English text. Keep the `status` on the error so screens can pick a state.

| Status | Backend message | Vietnamese text |
|---|---|---|
| 400 | Starts with a field name, such as `email: Invalid email` | Validate on the client first. Otherwise `Thông tin chưa hợp lệ. Kiểm tra lại rồi thử lần nữa.` |
| 401 | `Invalid email or password` | `Email hoặc mật khẩu không đúng. Kiểm tra lại rồi thử lần nữa.` |
| 401 | Other messages | `Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.` |
| 403 | `Check-in requires location within 250 meters` | `Chỉ check-in được khi ở trong bán kính 250 m.` |
| 403 | `This review was hidden by moderation` | `Đánh giá của bạn đã bị ẩn bởi quản trị viên.` |
| 404 | `Place not found` | `Không tìm thấy địa điểm.` |
| 404 | `Review not found` | `Không tìm thấy đánh giá.` |
| 409 | `You already have a pending report for this place` | `Bạn đã có một báo cáo đang chờ xử lý cho địa điểm này.` |
| 409 | `Resource already exists` (on register) | `Email này đã có tài khoản. Hãy đăng nhập.` |
| 429 | `Wait 15 minutes before another check-in at this place` | `Bạn vừa check-in ở đây. Đợi 15 phút rồi thử lại.` |
| 429 | Any other, including plain text | `Bạn thao tác quá nhanh. Đợi một lúc rồi thử lại.` |
| 5xx | Any | `Máy chủ đang gặp sự cố. Thử lại sau.` |
| None | Network failure | `Chưa kết nối được. Kiểm tra mạng rồi thử lại.` |

## Tasks

- [x] **B1. Create the app.** Run `npx create-expo-app@latest mobile` in `frontend/` if `frontend/mobile` is missing. Install the libraries in the stack table of `CLAUDE.md`. Add `.env.example` with `EXPO_PUBLIC_API_URL`, and `src/theme/` with every design token. Load both fonts at startup. Add the `lint` script if the template lacks it. Remove the template's demo screens and update `CLAUDE.md` if the commands or folders differ.
- [x] **B2. API client and session.** Build `src/api/client.ts`, `src/api/errors.ts`, `src/auth/tokens.ts` (`expo-secure-store`), and `src/auth/session.tsx`, following API client rules. Generate `src/api/schema.d.ts`. Add the TanStack Query provider. The session loads saved tokens at startup, calls `GET /api/auth/me`, and exposes `user`, `status` (`loading`, `guest`, `signed-in`), `signIn`, `signOut`, and a `requireAuth()` helper that opens login for guests. Sign-out calls `POST /api/auth/logout`, then always clears local tokens. Add `jest-expo` and test: retry after refresh, a single refresh under parallel 401s, no refresh on wrong password, failed refresh clears tokens, network failure keeps tokens, and the error mapping.
- [x] **B3. Shared components.** In `src/components/`, build `Screen` (with the red margin line), `Header`, `Button` (primary, secondary, busy, disabled), `TextField`, `TextArea`, `ChoiceChip`, `LoadingList`, `MessageState` (heading, sentence, optional button), `LiveStatusMeter`, `RatingStars`, and `PlaceRow`. Sizes and colors come from `CLAUDE.md` and the design files. `PlaceRow` takes a `Place` from the API and handles `unknown` status and `ratingCount` of 0.
- [x] **B4. Navigation shell.** Create the root layout, the four-tab layout, and placeholder screens for routes owned by Person A. Placeholders show only the screen name. Guests land on Khám phá.
- [x] **B5. Đăng nhập.** Design `login`. `POST /api/auth/login` with `{ email, password }`. Lowercase and trim the email. Validate email format and a password of 8 to 128 characters before sending. States: default, invalid input, submitting, wrong credentials. "Để sau" goes back, or to Khám phá when there is nothing to go back to. There is no forgot-password link. After success, return to the screen that asked for login.
- [x] **B6. Đăng ký.** Design `register`. `POST /api/auth/register` with `{ name, email, password }`; a name is 2 to 80 characters. A 201 returns the same shape as login, so sign the user in. A 409 shows the error under the email field.
- [x] **B7. Hồ sơ.** Design `profile`. Show name, email, and `reputation` from `GET /api/auth/me`, refreshed when the tab opens. Links go to `/my-reports` and `/propose`. States: signed in, guest, loading, error.
- [x] **B8. Yêu thích.** Design `favorites`. `GET /api/favorites` returns `{ items }` of places with no pagination, so show the count from `items.length`. Rows use `PlaceRow` with a filled heart. Removing calls `DELETE /api/favorites/{placeId}` (204) and updates the list. States: list, loading, empty, error, guest.
- [x] **B9. Xếp hạng.** Design `leaderboard`. `GET /api/reputation/leaderboard` returns `{ items }` with `_id`, `name`, and `reputation`, 20 by default. Highlight the row whose `_id` equals `user.id`. No rank is shown when the user isn't listed. Guests can open this tab. States: list, loading, empty, error.
- [ ] **B10. Danh sách đánh giá.** Design `reviews`. `GET /api/places/{id}/reviews` is public and paged. Load more on scroll. Each item has `rating`, `text`, `createdAt`, and `user` with `_id`, `name`, `reputation`. The button opens `/places/[id]/review`, through `requireAuth()`. States: list, loading, empty, error.
- [ ] **B11. Viết hoặc sửa đánh giá.** Design `write-review`. Find the user's review in the reviews list; if found, the screen is in edit mode, because there is no endpoint for it. `PUT /api/places/{id}/reviews/me` with `{ rating, text }`: `rating` is 1 to 5, and `text` is 3 to 1,000 characters. `DELETE` the same path removes it after a confirmation. A 403 shows the hidden state. After success, invalidate that place and its reviews. States: new, invalid input, submitting, edit, hidden.
- [ ] **B12. Báo cáo địa điểm.** Design `report`. `POST /api/reports` with `{ placeId, reason, detail }`; `detail` is 10 to 2,000 characters. Reasons in order: `closed`, `incorrect_info`, `inappropriate`, `other`. States: default, invalid input, submitting, already pending (409), success.
- [ ] **B13. Báo cáo của tôi.** Design `my-reports`. `GET /api/reports/me` is paged, and `place` is only an ID, so show no place name. Status text: `pending` is `Đang chờ`, `resolved` is `Đã xử lý`, `dismissed` is `Đã bỏ qua`. Show the `Đang chờ` tag in ink and the others in secondary text. States: list, loading, empty, error.
- [ ] **B14. Đề xuất địa điểm.** Design `propose`. `POST /api/places` with `{ name, description, address, coordinates, amenities, minDrinkPrice }`: `name` is 2 to 120 characters, `address` 5 to 300, `description` up to 2,000. `coordinates` is `[longitude, latitude]`. For Wi-Fi and outlets, `Có` is `true`, `Không` is `false`, `Chưa rõ` is `null`. An empty price is `null`. Share the location through `src/location/pickedLocation.ts`, a small store that the `/pick-location` screen sets. The placeholder from B4 explains the screen isn't ready. States: default, invalid input, submitting, sent. Guests go through `requireAuth()`.

## Session notes

Add one dated line per task. Keep only what the next session needs.

- 2026-11-01 B1: Expo SDK 58 app in `frontend/mobile`; routes live in `src/app/` (paths in Routes apply below it). Theme in `src/theme/` (`colors`, `spacing`, `sizes`, `fonts`, `type`). Added `react-native-svg` for design icons (in CLAUDE.md stack). The Expo version API is blocked here: use `EXPO_OFFLINE=1 npx expo install`. ESLint config is `eslint.config.js` (eslint-config-expo).
- 2026-11-01 B2: `api.request(path, {method, body, query})` in `src/api/client.ts`; endpoint wrappers per area (e.g. `src/api/auth.ts`); types via `src/api/types.ts` (aliases of `schema.d.ts`); query keys in `src/api/queryKeys.ts`. `useSession()` from `src/auth/session.tsx`; `requireAuth()` pushes `/login`. Errors: `ApiError` has `status` and Vietnamese `message`; use `errorMessage(e)`. tsconfig needs `types: ["jest","node"]` (TS 6). Tests in `src/**/__tests__`.
- 2026-11-01 B3: Import shared parts from `@/components` (also `Icon` with design SVG paths, `Spinner`, `LiveStatusBars`). `Button` defaults to 48px; `block` primary is 54px. `TextField`/`TextArea` take `error` text. `PlaceRow` takes `favorite`/`onToggleFavorite` for the heart. Helpers: `@/utils/format` (comma decimals, dd/mm/yyyy), `@/utils/liveStatus` (levels, labels, `MIN_SAMPLES` = backend default 2).
- 2026-11-01 B4: Tabs use `expo-router/js-tabs` with the custom `TabBar` (SDK 58 tab bar props: `state`, `navigateToTab`). Person A placeholders use `<Placeholder title back />`: `(tabs)/index`, `places/[id]/index`, `pick-location`. Favorites, leaderboard and profile are temporary placeholders until B7 to B9. Root Stack anchors on `(tabs)`.
- 2026-11-01 B5: Login at `(auth)/login`; success or "Để sau" calls `router.back()` (or `/` with no history). The "Đăng ký" link uses `router.replace('/register')` so register can also just go back to the screen that asked. Field rules live in `@/utils/validation`. `TextField` has `invalid` (red without text). `FormScroll` wraps forms for the keyboard. `(auth)/register` is a placeholder until B6.
- 2026-11-01 B6: Register at `(auth)/register`; signs in with the 201 body and goes back. 409 shows under email; other errors use `FormAlert` above the button. New shared parts: `ActionBar` (bottom button bar with safe area) and `FormAlert`.
- 2026-11-01 B7: Profile reads `useMe()` (`src/api/hooks/useMe.ts`, same cache as the session) and refetches on tab focus with `useRefetchOnFocus`. Error state (not in the design) uses the favorites error pattern. `/my-reports` and `/propose` are placeholders until B13 and B14.
- 2026-11-01 B8: Favorites hooks in `src/api/hooks/useFavorites.ts`: `useFavorites`, `useRemoveFavorite`, `useAddFavorite` (Person A can reuse the last two on place detail; both keep `user.favorites` in the me cache in sync). Row tap opens `/places/[id]`. A failed removal shows a `FormAlert` above the list.
- 2026-11-01 B9: Leaderboard uses `useLeaderboard()`; rank is list position (top 3 large ink, rest grey). The user's row (`_id === user.id`) gets the loading-grey background and "(bạn)". "Top 20" shows only with data.

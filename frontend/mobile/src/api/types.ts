/**
 * Short names for API types. Everything is derived from the generated schema.d.ts;
 * nothing here is hand-written. Regenerate schema.d.ts when the API changes.
 */
import type { components, operations, paths } from './schema';

type Schemas = components['schemas'];

export type Place = Schemas['Place'];
export type PlaceInput = Schemas['PlaceInput'];
export type PlacePage = Schemas['PlacePage'];
export type LiveStatus = Schemas['LiveStatus'];
export type Amenities = Schemas['Amenities'];
export type User = Schemas['User'];
export type AuthTokens = Schemas['AuthTokens'];
export type Credentials = Schemas['Credentials'];
export type Review = Schemas['Review'];
export type ReviewPage = Schemas['ReviewPage'];
export type Report = Schemas['Report'];
export type ReportPage = Schemas['ReportPage'];

type JsonBody<T> = T extends { content: { 'application/json': infer B } } ? B : never;

/** JSON body of a successful response. */
export type ResponseBody<Op extends keyof operations, Code extends number = 200> =
  operations[Op]['responses'] extends Record<Code, infer R> ? JsonBody<R> : never;

/** JSON request body of an operation. */
export type RequestBody<Op extends keyof operations> =
  operations[Op] extends { requestBody: { content: { 'application/json': infer B } } }
    ? B
    : operations[Op] extends { requestBody?: { content: { 'application/json': infer B } } }
      ? B
      : never;

export type RegisterInput = RequestBody<'register'>;
export type ReviewInput = RequestBody<'upsertMyReview'>;
export type ReportInput = RequestBody<'createReport'>;
export type MeResponse = ResponseBody<'getMe'>;
export type FavoritesResponse = ResponseBody<'listFavorites'>;
export type LeaderboardResponse = ResponseBody<'leaderboard'>;
export type LeaderboardEntry = NonNullable<LeaderboardResponse['items']>[number];
export type ReportReason = NonNullable<Report['reason']>;
export type ReportStatus = NonNullable<Report['status']>;

export type ApiPath = keyof paths;
export type PlaceResponse = ResponseBody<'getPlace'>;
export type CreatePlaceResponse = ResponseBody<'createPlace', 201>;
export type ReviewResponse = ResponseBody<'upsertMyReview'>;
export type CreateReportResponse = ResponseBody<'createReport', 201>;

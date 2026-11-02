/** Short names for API types, all derived from the generated schema.d.ts. */
import type { components, operations } from './schema';

type Schemas = components['schemas'];
type JsonBody<T> = T extends { content: { 'application/json': infer B } } ? B : never;

export type ResponseBody<Op extends keyof operations, Code extends number = 200> =
  operations[Op]['responses'] extends Record<Code, infer R> ? JsonBody<R> : never;

export type JsonRequestBody<Op extends keyof operations> = operations[Op] extends {
  requestBody: { content: { 'application/json': infer B } };
}
  ? B
  : never;

export type Place = Schemas['Place'];
export type PlaceInput = Schemas['PlaceInput'];
export type PlacePage = Schemas['PlacePage'];
export type Review = Schemas['Review'];
export type ReviewPage = Schemas['ReviewPage'];
export type Report = Schemas['Report'];
export type ReportPage = Schemas['ReportPage'];
export type User = Schemas['User'];
export type AuthTokens = Schemas['AuthTokens'];
export type Credentials = Schemas['Credentials'];

export type Approval = NonNullable<Place['approval']>;
export type ReportStatus = NonNullable<Report['status']>;
export type ReportReason = NonNullable<Report['reason']>;

export type Analytics = ResponseBody<'adminAnalytics'>;
export type PlaceUpdate = JsonRequestBody<'adminUpdatePlace'>;
export type PlaceResponse = ResponseBody<'adminUpdatePlace'>;
export type CreatePlaceResponse = ResponseBody<'createPlace', 201>;
export type UploadImageResponse = ResponseBody<'adminUploadPlaceImage', 201>;
export type ReportResponse = ResponseBody<'adminUpdateReport'>;
export type ReviewResponse = ResponseBody<'adminUpdateReview'>;
export type MeResponse = ResponseBody<'getMe'>;

/**
 * The admin lists populate `user` (name, email) and `place` (name, address), but openapi.yaml
 * types them as ID strings. Read those fields through this guard instead of hand-writing types.
 */
export type PopulatedRef = { _id?: string; name?: string; email?: string; address?: string };

export function populated(value: unknown): PopulatedRef | null {
  return value && typeof value === 'object' ? (value as PopulatedRef) : null;
}

/** The referenced document's id, populated or not. */
export function refId(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  return populated(value)?._id;
}

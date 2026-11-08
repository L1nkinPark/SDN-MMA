/**
 * Short names for API types, derived from the generated schema.d.ts. The only hand-written shapes
 * are in the marked section, for responses openapi.yaml does not describe.
 */
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

export type UserRole = NonNullable<User['role']>;
export type UserStatus = NonNullable<User['status']>;
export type AdminPermission = NonNullable<User['adminPermissions']>[number];

export type Booking = Schemas['Booking'];
export type BookingStatus = NonNullable<Booking['status']>;
export type MerchantClaim = Schemas['MerchantClaim'];
export type ClaimStatus = NonNullable<MerchantClaim['status']>;
export type OpeningHours = NonNullable<NonNullable<Place['business']>['openingHours']>[number];

export type MerchantClaimInput = JsonRequestBody<'submitMerchantClaim'>;
export type MerchantPlaceUpdate = JsonRequestBody<'updateMerchantPlace'>;
export type BookingDecisionInput = JsonRequestBody<'merchantBookingDecision'>;
export type BookingAction = BookingDecisionInput['action'];
export type ClaimDecisionInput = JsonRequestBody<'adminDecideMerchantClaim'>;
export type UserStatusInput = JsonRequestBody<'adminUpdateUser'>;

/*
 * The shapes below are returned by the backend but openapi.yaml only describes them in words
 * ("Danh sách booking", "Danh sách phân trang"...). They mirror the controllers in backend/src and
 * use the generated schemas wherever one exists. Replace them when openapi.yaml gets response schemas.
 */

export type PageMeta = { page: number; limit: number; total: number };
export type Page<T> = PageMeta & { items: T[] };

/** `POST /api/merchant/places`: the shared place fields plus contact phone and HTTPS evidence links. */
export type MerchantPlaceInput = PlaceInput & { contactPhone: string; evidenceUrls: string[] };
export type MerchantPlaceList = { items: Place[] };
export type MerchantClaimResponse = { claim: MerchantClaim };
/** Fields a merchant can ask to change; an admin approves them before they go live. */
export type PlaceChangeFields = { name?: string; description?: string; address?: string; coordinates?: [number, number] };
export type PlaceChangeRequest = {
  _id: string;
  place: unknown;
  merchant: unknown;
  changes: PlaceChangeFields & { imagesToAdd?: string[] };
  status: ClaimStatus;
  decisionNote: string | null;
  createdAt: string;
  decidedAt?: string | null;
};
export type VisitCode = { code: string; expiresInSeconds: number };
export type BookingResponse = { booking: Booking };

export type AdminUser = {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  reputation?: number;
  adminPermissions?: AdminPermission[];
  createdAt?: string;
};
export type UserHistory = {
  user: AdminUser;
  bookings: (Booking & { createdAt?: string })[];
  checkins: { _id: string; createdAt?: string; crowd?: string; noise?: string; flagged?: boolean; place?: unknown }[];
  reviews: (Review & { createdAt?: string })[];
  reports: (Report & { createdAt?: string })[];
  visits: { _id: string; createdAt?: string; method?: string; place?: unknown }[];
  flags: FraudFlag[];
  audit: AuditEvent[];
};
export type SupportCase = {
  _id: string;
  user: unknown;
  kind: 'review_appeal' | 'booking_dispute';
  targetId: string;
  reason: string;
  status: 'pending' | 'accepted' | 'rejected';
  decisionNote?: string | null;
  createdAt?: string;
};
export type AuditEvent = {
  _id: string;
  actor: unknown;
  action: string;
  targetType: string;
  targetId: string;
  detail: string | null;
  createdAt: string;
};
export type FraudStatus = 'pending' | 'resolved' | 'dismissed';
export type FraudFlag = {
  _id: string;
  user: unknown;
  place: unknown;
  checkin: string;
  reason: 'impossible_travel';
  detail: string;
  evidence?: { distanceMeters?: number | null; elapsedMinutes?: number | null; gpsAccuracyMeters?: number | null;
    previousAt?: string | null; currentAt?: string | null; verificationLevel?: string | null };
  status: FraudStatus;
  createdAt: string;
};

export type AppNotification = {
  _id: string;
  kind: string;
  title: string;
  body: string;
  resourceType: string | null;
  resourceId: string | null;
  readAt: string | null;
  createdAt: string;
};
export type NotificationPage = Page<AppNotification> & { unreadCount: number };

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

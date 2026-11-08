/**
 * Short names for API types, derived from the generated schema.d.ts.
 * Regenerate schema.d.ts when the API changes. The only hand-written shapes are in the marked
 * section at the end, for responses openapi.yaml does not describe.
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

export type PlaceListQuery = NonNullable<operations['listPlaces']['parameters']['query']>;
export type CheckinInput = RequestBody<'createCheckin'>;
export type CheckinResponse = ResponseBody<'createCheckin', 201>;
export type Crowd = NonNullable<LiveStatus['crowd']>;
export type Noise = NonNullable<LiveStatus['noise']>;
export type CheckinCrowd = CheckinInput['crowd'];
export type CheckinNoise = CheckinInput['noise'];
export type VerificationLevel = NonNullable<Schemas['Checkin']['verificationLevel']>;

/** JSON request body of an endpoint that has no operationId in openapi.yaml. */
export type PathRequestBody<P extends ApiPath, M extends keyof paths[P]> = paths[P][M] extends {
  requestBody: { content: { 'application/json': infer B } };
}
  ? B
  : never;

export type UserRole = NonNullable<User['role']>;
export type NotificationSettings = NonNullable<User['notificationSettings']>;
export type UpdateMeInput = PathRequestBody<'/api/auth/me', 'patch'>;
export type ChangePasswordInput = PathRequestBody<'/api/auth/change-password', 'post'>;
export type ForgotPasswordInput = PathRequestBody<'/api/auth/forgot-password', 'post'>;
export type ResetPasswordInput = PathRequestBody<'/api/auth/reset-password', 'post'>;
export type DeleteAccountInput = PathRequestBody<'/api/auth/me', 'delete'>;

export type Booking = Schemas['Booking'];
export type BookingStatus = NonNullable<Booking['status']>;
export type CreateBookingInput = RequestBody<'createBooking'>;
export type OpeningHours = NonNullable<NonNullable<Place['business']>['openingHours']>[number];

/*
 * The shapes below are returned by the backend but openapi.yaml only describes them in words
 * ("Danh sách booking", "Thông báo phân trang"...). They mirror the controllers in backend/src and
 * use the generated schemas wherever one exists. Replace them when openapi.yaml gets response schemas.
 */

/** List metadata shared by every paged endpoint. */
export type PageMeta = { page: number; limit: number; total: number };

/** `GET /api/bookings/me` populates `place` with name, address and images. */
export type BookingPlace = { _id: string; name?: string; address?: string; images?: string[] };
export type MyBooking = Omit<Booking, 'place'> & { place?: BookingPlace | string | null; createdAt?: string };
export type MyBookingPage = PageMeta & { items: MyBooking[] };
/** `POST /api/bookings`: 201 with a new booking, or 200 with `alreadyExists` for the same user, place and time. */
export type CreateBookingResponse = { booking: Booking; alreadyExists?: boolean };
export type CancelBookingResponse = { booking: Booking };

/** `GET /api/places/{id}/availability`. `slots` only lists times that already have bookings. */
export type BookingSlot = { _id?: string; startsAt: string; capacity: number; reserved: number };
export type Availability = {
  placeId: string;
  date: string;
  closedOnDate: boolean;
  /** False when booking is off, the place is temporarily closed or closed on this date. */
  enabled: boolean;
  capacityPerSlot: number | null;
  slotMinutes: number;
  openingHours: OpeningHours[];
  closedDates: string[];
  slots: BookingSlot[];
};

/** `resourceType` values the backend sends with a notification. */
export type NotificationResource = 'Booking' | 'Place' | 'Report' | 'Review' | 'MerchantClaim' | 'PlaceChangeRequest' | 'FraudFlag';
export type AppNotification = {
  _id: string;
  kind: string;
  title: string;
  body: string;
  resourceType: NotificationResource | string | null;
  resourceId: string | null;
  readAt: string | null;
  createdAt: string;
};
export type NotificationPage = PageMeta & { items: AppNotification[]; unreadCount: number };

/** `GET /api/auth/me/export`: the user and every record tied to them. */
export type DataExport = { generatedAt: string; user: User } & Record<string, unknown>;

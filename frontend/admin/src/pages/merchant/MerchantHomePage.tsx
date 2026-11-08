import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router';

import { merchantApi, PAGE_SIZE } from '../../api/endpoints';
import { errorMessage } from '../../api/errors';
import { useMerchantClaims, useMerchantPlaces } from '../../api/hooks';
import { populated, type MerchantClaim, type Place } from '../../api/types';
import { useSession } from '../../auth/sessionContext';
import { Button, LoadingRows, PageHeader, Pagination, StateMessage, Tag } from '../../components/ui';
import { formatDateTime } from '../../utils/format';
import { APPROVAL_LABELS, CLAIM_STATUS_LABELS } from '../../utils/labels';

function PlaceRow({ place }: { place: Place }) {
  const approval = place.approval ?? 'pending';
  const booking = place.booking;
  return (
    <li className="row">
      <div className="row__main">
        <span className="row__title">
          {place.name}
          <Tag tone={approval === 'approved' ? 'ink' : approval === 'rejected' ? 'error' : 'muted'}>{APPROVAL_LABELS[approval]}</Tag>
          {place.business?.temporaryClosed ? <Tag tone="error">Tạm đóng cửa</Tag> : null}
        </span>
        <span className="row__secondary">{place.address}</span>
        {approval === 'approved' ? (
          <span className="row__meta">
            <span>{booking?.enabled ? `Nhận đặt chỗ · ${booking.approvalMode === 'manual' ? 'quán xác nhận' : 'tự xác nhận'}` : 'Chưa nhận đặt chỗ'}</span>
            <span>{place.business?.openingHours?.length ? `${place.business.openingHours.length} ngày mở cửa/tuần` : 'Chưa có giờ mở cửa'}</span>
          </span>
        ) : approval === 'pending' ? (
          <p className="row__body">Hồ sơ đang chờ quản trị viên duyệt. Quán chỉ hiện trong app sau khi được duyệt.</p>
        ) : (
          <p className="row__body">Hồ sơ chưa được duyệt{place.moderationNote ? `: ${place.moderationNote}` : '.'}</p>
        )}
      </div>
      <div className="row__actions">
        {approval === 'approved' ? (
          <Link className="btn btn--primary btn--small" to={`/merchant/places/${place._id}`}>
            Quản lý quán
          </Link>
        ) : null}
      </div>
    </li>
  );
}

function ClaimRow({ claim }: { claim: MerchantClaim }) {
  const place = populated(claim.place);
  const status = claim.status ?? 'pending';
  return (
    <li className="row">
      <div className="row__main">
        <span className="row__title">
          {place?.name ?? 'Địa điểm'}
          <Tag tone={status === 'approved' ? 'ink' : status === 'rejected' ? 'error' : 'muted'}>{CLAIM_STATUS_LABELS[status]}</Tag>
        </span>
        <span className="row__secondary">
          {claim.businessName}
          {place?.address ? ` · ${place.address}` : ''}
        </span>
        {claim.decisionNote ? <p className="row__body">Phản hồi của quản trị viên: {claim.decisionNote}</p> : null}
        {/* createdAt is stored by the backend but not described in openapi.yaml */}
        <span className="row__meta">{formatDateTime((claim as { createdAt?: string }).createdAt)}</span>
      </div>
    </li>
  );
}

/** Quán của tôi: places the account owns, and its applications to manage existing places. */
export function MerchantHomePage() {
  const navigate = useNavigate();
  const { user } = useSession();
  const places = useMerchantPlaces();
  const [claimPage, setClaimPage] = useState(1);
  const claims = useMerchantClaims(claimPage);
  const accountApplication = useQuery({ queryKey: ['merchant', 'account-application'], queryFn: merchantApi.accountApplication,
    enabled: user?.role === 'student' });
  const items = places.data?.items ?? [];
  const claimItems = claims.data?.items ?? [];

  if (user?.role === 'student') {
    const application = accountApplication.data?.application;
    return <>
      <PageHeader title="Tài khoản chủ quán" />
      {accountApplication.isPending ? <LoadingRows rows={1} /> : accountApplication.isError ?
        <StateMessage tone="error" heading="Chưa tải được hồ sơ tài khoản" sentence={errorMessage(accountApplication.error)}
          action={{ label: 'Thử lại', onClick: () => void accountApplication.refetch() }} /> :
        <StateMessage heading={application?.status === 'pending' ? 'Hồ sơ tài khoản đang chờ admin duyệt' :
          application?.status === 'rejected' ? 'Hồ sơ tài khoản chưa được duyệt' : 'Đăng ký tài khoản chủ quán'}
          sentence={application?.status === 'pending' ? 'Sau khi tài khoản được duyệt, bạn mới có thể đăng ký hoặc quản lý quán.' :
            application?.status === 'rejected' ? (application.decisionNote ?? 'Hãy bổ sung minh chứng và gửi lại hồ sơ.') :
              'Gửi hồ sơ tài khoản và minh chứng để admin xét duyệt.'}
          action={application?.status === 'pending' ? { label: 'Kiểm tra kết quả', onClick: () => window.location.reload() } :
            { label: application?.status === 'rejected' ? 'Gửi lại hồ sơ' : 'Nộp hồ sơ tài khoản',
              onClick: () => navigate('/merchant/apply') }} />}
    </>;
  }

  return (
    <>
      <PageHeader
        title="Quán của tôi"
        right={
          <div className="form-actions">
            <Button variant="secondary" size="small" onClick={() => navigate('/merchant/claim')}>
              Nhận quyền quán có sẵn
            </Button>
            <Button size="small" onClick={() => navigate('/merchant/new')}>
              Đăng ký quán mới
            </Button>
          </div>
        }
      />
      {places.isPending ? (
        <LoadingRows rows={2} />
      ) : places.isError ? (
        <StateMessage
          tone="error"
          heading="Chưa tải được danh sách quán"
          sentence={errorMessage(places.error)}
          action={{ label: 'Thử lại', onClick: () => void places.refetch(), busy: places.isFetching }}
        />
      ) : items.length === 0 ? (
        <StateMessage
          heading="Bạn chưa quản lý quán nào"
          sentence="Đăng ký quán mới kèm minh chứng, hoặc nhận quyền một quán đã có trên StudySpot."
          action={{ label: 'Đăng ký quán mới', variant: 'primary', onClick: () => navigate('/merchant/new') }}
        />
      ) : (
        <ul className="rows">
          {items.map((place) => (
            <PlaceRow key={place._id} place={place} />
          ))}
        </ul>
      )}

      <h2 className="section-title">Hồ sơ nhận quyền đã gửi</h2>
      {claims.isPending ? (
        <LoadingRows rows={1} />
      ) : claims.isError ? (
        <StateMessage
          tone="error"
          heading="Chưa tải được hồ sơ"
          sentence={errorMessage(claims.error)}
          action={{ label: 'Thử lại', onClick: () => void claims.refetch(), busy: claims.isFetching }}
        />
      ) : claimItems.length === 0 ? (
        <p className="section state__sentence">Bạn chưa gửi hồ sơ nhận quyền nào.</p>
      ) : (
        <>
          <ul className="rows">
            {claimItems.map((claim) => (
              <ClaimRow key={claim._id} claim={claim} />
            ))}
          </ul>
          <Pagination page={claimPage} limit={claims.data?.limit ?? PAGE_SIZE} total={claims.data?.total ?? 0} onChange={setClaimPage} />
        </>
      )}
    </>
  );
}

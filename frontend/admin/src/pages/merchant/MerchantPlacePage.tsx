import { useNavigate, useParams, useSearchParams } from 'react-router';

import { errorMessage } from '../../api/errors';
import { useMerchantPlaces } from '../../api/hooks';
import { FilterTabs, LoadingRows, PageHeader, StateMessage, Tag } from '../../components/ui';
import { BookingsPanel } from './BookingsPanel';
import { PublicInfoPanel } from './PublicInfoPanel';
import { SettingsPanel } from './SettingsPanel';
import { VisitCodePanel } from './VisitCodePanel';

type Tab = 'bookings' | 'qr' | 'settings' | 'info';

const TABS: { value: Tab; label: string }[] = [
  { value: 'bookings', label: 'Đặt chỗ' },
  { value: 'qr', label: 'Mã QR tại quầy' },
  { value: 'settings', label: 'Vận hành' },
  { value: 'info', label: 'Thông tin và ảnh' },
];

function readTab(value: string | null): Tab {
  return TABS.some((tab) => tab.value === value) ? (value as Tab) : 'bookings';
}

/** One owned, approved place. There is no endpoint for a single owned place, so it comes from the owned list. */
export function MerchantPlacePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = readTab(params.get('tab'));
  const places = useMerchantPlaces();
  const place = places.data?.items.find((item) => item._id === id);

  if (places.isPending) return <LoadingRows rows={3} />;
  if (places.isError) {
    return (
      <StateMessage
        tone="error"
        heading="Chưa tải được quán"
        sentence={errorMessage(places.error)}
        action={{ label: 'Thử lại', onClick: () => void places.refetch(), busy: places.isFetching }}
      />
    );
  }
  if (!place?._id) {
    return (
      <StateMessage
        heading="Không tìm thấy quán"
        sentence="Quán này không thuộc tài khoản của bạn hoặc quyền quản lý đã được chuyển."
        action={{ label: 'Về Quán của tôi', onClick: () => navigate('/merchant') }}
      />
    );
  }
  if (place.approval !== 'approved') {
    return (
      <>
        <PageHeader title={place.name ?? 'Quán'} />
        <StateMessage
          heading="Quán chưa được duyệt"
          sentence="Bạn cấu hình được giờ mở cửa, đặt chỗ và mã QR sau khi quản trị viên duyệt quán."
          action={{ label: 'Về Quán của tôi', onClick: () => navigate('/merchant') }}
        />
      </>
    );
  }

  const selectTab = (next: Tab) => setParams(next === 'bookings' ? {} : { tab: next }, { replace: true });

  return (
    <>
      <PageHeader
        title={place.name ?? 'Quán'}
        right={
          <span className="form-actions">
            {place.address}
            {place.business?.temporaryClosed ? <Tag tone="error">Tạm đóng cửa</Tag> : null}
          </span>
        }
      />
      <div className="section">
        <FilterTabs label="Phần quản lý" value={tab} options={TABS} onChange={selectTab} />
      </div>
      {tab === 'bookings' ? (
        place.booking?.enabled ? (
          <BookingsPanel placeId={place._id} manual={place.booking.approvalMode === 'manual'} />
        ) : (
          <>
            <StateMessage
              heading="Quán chưa nhận đặt chỗ"
              sentence="Bật Nhận đặt chỗ, nhập số chỗ mỗi khung giờ và giờ mở cửa ở tab Vận hành."
              action={{ label: 'Mở tab Vận hành', onClick: () => selectTab('settings') }}
            />
            <BookingsPanel placeId={place._id} manual={false} />
          </>
        )
      ) : tab === 'qr' ? (
        <VisitCodePanel key={place._id} place={place} />
      ) : tab === 'settings' ? (
        <SettingsPanel key={place._id} place={place} onShowBookings={() => selectTab('bookings')} />
      ) : (
        <PublicInfoPanel key={place._id} place={place} />
      )}
    </>
  );
}

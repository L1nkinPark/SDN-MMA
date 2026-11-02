import { useNavigate } from 'react-router';

import { errorMessage } from '../api/errors';
import { useCreatePlace } from '../api/hooks';
import { PlaceForm } from '../components/PlaceForm';
import { PageHeader, StateMessage } from '../components/ui';

export function NewPlacePage() {
  const navigate = useNavigate();
  const create = useCreatePlace();

  if (create.isSuccess) {
    return (
      <>
        <PageHeader title="Thêm địa điểm" />
        <StateMessage
          heading="Đã thêm địa điểm"
          sentence={`${create.data.place?.name ?? 'Địa điểm'} đã được duyệt và hiện trong app ngay.`}
          action={{ label: 'Về danh sách địa điểm', onClick: () => navigate('/places?approval=approved') }}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Thêm địa điểm" right="Địa điểm do quản trị viên thêm được duyệt ngay." />
      <div className="section">
        <PlaceForm
          submitLabel="Thêm địa điểm"
          busy={create.isPending}
          error={create.isError ? errorMessage(create.error) : null}
          onSubmit={(input) => create.mutate(input)}
          onCancel={() => navigate('/places')}
          onEdit={() => {
            if (create.isError) create.reset();
          }}
        />
      </div>
    </>
  );
}

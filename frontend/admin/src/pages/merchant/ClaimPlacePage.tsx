import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';

import { errorMessage } from '../../api/errors';
import { usePlaceSearch, useSubmitClaim } from '../../api/hooks';
import type { Place } from '../../api/types';
import { Button, FormAlert, LoadingRows, PageHeader, StateMessage, Tag, TextArea, TextField } from '../../components/ui';
import { evidenceError, parseLinks, phoneError } from '../../utils/validation';

type Errors = { businessName: string | null; phone: string | null; evidence: string | null };
const NO_ERRORS: Errors = { businessName: null, phone: null, evidence: null };

/** Waits for typing to pause before searching. */
function useDebounced(value: string, delay = 350): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** Nhận quyền quán: find an approved place without an owner and send evidence of ownership. */
export function ClaimPlacePage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const term = useDebounced(query);
  const search = usePlaceSearch(term);
  const submit = useSubmitClaim();
  const [chosen, setChosen] = useState<Place | null>(null);
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [evidence, setEvidence] = useState('');
  const [errors, setErrors] = useState<Errors>(NO_ERRORS);

  if (submit.isSuccess) {
    return (
      <>
        <PageHeader title="Nhận quyền quán" />
        <StateMessage
          heading="Đã gửi hồ sơ nhận quyền"
          sentence={`Quản trị viên sẽ kiểm tra minh chứng cho ${chosen?.name ?? 'quán'}. Bạn sẽ nhận thông báo khi có kết quả.`}
          action={{ label: 'Về Quán của tôi', onClick: () => navigate('/merchant') }}
        />
      </>
    );
  }

  function send(event: FormEvent) {
    event.preventDefault();
    if (!chosen?._id || submit.isPending) return;
    const found: Errors = {
      businessName: businessName.trim().length < 2 ? 'Tên kinh doanh cần ít nhất 2 ký tự.' : null,
      phone: phoneError(phone),
      evidence: evidenceError(evidence),
    };
    setErrors(found);
    if (found.businessName || found.phone || found.evidence) return;
    submit.mutate({
      placeId: chosen._id,
      businessName: businessName.trim(),
      contactPhone: phone.trim(),
      evidenceUrls: parseLinks(evidence),
    });
  }

  const results = search.data?.items ?? [];

  return (
    <>
      <PageHeader title="Nhận quyền quán" />
      <p className="section state__sentence">
        Dành cho quán đã có trên StudySpot nhưng chưa có chủ quản lý. Nếu quán chưa có, hãy đăng ký quán mới.
      </p>

      {!chosen ? (
        <>
          <div className="section search-box">
            <TextField
              label="Tìm quán theo tên hoặc địa chỉ"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ví dụ: Cafe Sách"
              hint="Gõ ít nhất 2 ký tự."
            />
          </div>
          {term.trim().length < 2 ? null : search.isPending ? (
            <LoadingRows rows={2} />
          ) : search.isError ? (
            <StateMessage
              tone="error"
              heading="Chưa tìm được"
              sentence={errorMessage(search.error)}
              action={{ label: 'Thử lại', onClick: () => void search.refetch() }}
            />
          ) : results.length === 0 ? (
            <StateMessage
              heading="Không thấy quán phù hợp"
              sentence="Thử tên khác, hoặc đăng ký quán mới nếu quán chưa có trên StudySpot."
              action={{ label: 'Đăng ký quán mới', onClick: () => navigate('/merchant/new') }}
            />
          ) : (
            <ul className="rows">
              {results.map((place) => (
                <li className="row" key={place._id}>
                  <div className="row__main">
                    <span className="row__title">
                      {place.name}
                      {place.owner ? <Tag>Đã có chủ</Tag> : null}
                    </span>
                    <span className="row__secondary">{place.address}</span>
                  </div>
                  <div className="row__actions">
                    <Button
                      size="small"
                      variant="secondary"
                      disabled={Boolean(place.owner)}
                      onClick={() => {
                        setChosen(place);
                        submit.reset();
                      }}>
                      Chọn quán này
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <form className="section" onSubmit={send} noValidate>
          <div className="chosen">
            <div>
              <strong>{chosen.name}</strong>
              <p className="row__secondary">{chosen.address}</p>
            </div>
            <Button variant="text" size="small" onClick={() => setChosen(null)} disabled={submit.isPending}>
              Chọn quán khác
            </Button>
          </div>
          <div className="form-grid">
            <TextField
              label="Tên kinh doanh"
              value={businessName}
              maxLength={120}
              onChange={(event) => {
                setBusinessName(event.target.value);
                setErrors((current) => ({ ...current, businessName: null }));
              }}
              error={errors.businessName}
              disabled={submit.isPending}
            />
            <TextField
              label="Số điện thoại liên hệ"
              inputMode="tel"
              value={phone}
              maxLength={20}
              onChange={(event) => {
                setPhone(event.target.value);
                setErrors((current) => ({ ...current, phone: null }));
              }}
              error={errors.phone}
              disabled={submit.isPending}
            />
            <div className="form-grid__wide">
              <TextArea
                label="Link minh chứng quyền sở hữu (mỗi dòng một link https://, tối đa 5)"
                value={evidence}
                onChange={(event) => {
                  setEvidence(event.target.value);
                  setErrors((current) => ({ ...current, evidence: null }));
                }}
                error={errors.evidence}
                hint="Ví dụ giấy phép kinh doanh có tên quán, hoặc trang chính thức của quán."
                disabled={submit.isPending}
              />
            </div>
            <div className="form-grid__wide form-actions">
              <Button type="submit" busy={submit.isPending} busyLabel="Đang gửi">
                Gửi hồ sơ nhận quyền
              </Button>
              <FormAlert message={submit.isError ? errorMessage(submit.error) : null} />
            </div>
          </div>
        </form>
      )}
    </>
  );
}

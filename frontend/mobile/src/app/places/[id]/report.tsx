import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { errorMessage, isApiError } from '@/api/errors';
import { usePlace } from '@/api/hooks/usePlace';
import { useCreateReport } from '@/api/hooks/useReports';
import { REPORT_REASONS } from '@/api/reports';
import type { ReportReason } from '@/api/types';
import { useSession } from '@/auth/session';
import { ActionBar, Button, FormAlert, FormScroll, Header, MessageState, RadioRow, Screen, TextArea } from '@/components';
import { colors, fonts, spacing, type } from '@/theme';
import { reportDetailError } from '@/utils/validation';

const DETAIL_MAX = 2000;

export default function ReportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const placeId = id ?? '';
  const { status } = useSession();
  const place = usePlace(placeId);
  const report = useCreateReport();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [detail, setDetail] = useState('');
  const [errors, setErrors] = useState<{ reason: string | null; detail: string | null }>({ reason: null, detail: null });

  const alreadyPending = isApiError(report.error) && report.error.status === 409;

  function backToPlace() {
    router.dismissTo({ pathname: '/places/[id]', params: { id: placeId } });
  }

  function submit() {
    if (report.isPending || alreadyPending) return;
    const next = { reason: reason ? null : 'Hãy chọn lý do.', detail: reportDetailError(detail) };
    setErrors(next);
    if (next.reason || next.detail || !reason) return;
    report.mutate({ placeId, reason, detail: detail.trim() });
  }

  if (status === 'guest') {
    return (
      <Screen>
        <Header title="Báo cáo" back />
        <MessageState
          heading="Đăng nhập để báo cáo"
          sentence="Báo cáo được gửi theo tài khoản của bạn."
          action={{ label: 'Đăng nhập', variant: 'primary', onPress: () => router.push('/login') }}
        />
      </Screen>
    );
  }

  if (report.isSuccess) {
    return (
      <Screen>
        <Header title="Báo cáo" back />
        <MessageState
          heading="Đã gửi báo cáo"
          sentence="Quản trị viên sẽ xem xét. Bạn theo dõi kết quả ở Báo cáo của tôi."
          action={{ label: 'Về địa điểm', onPress: backToPlace }}
        />
      </Screen>
    );
  }

  const placeName = place.data?.place?.name;

  return (
    <Screen>
      <Header title="Báo cáo" back />
      <FormScroll contentStyle={styles.body}>
        {placeName ? <Text style={styles.placeName}>{placeName}</Text> : null}
        <View accessibilityRole="radiogroup">
          <Text style={[styles.legend, errors.reason ? styles.legendError : null]}>Lý do</Text>
          {REPORT_REASONS.map((item) => (
            <RadioRow
              key={item.value}
              label={item.label}
              selected={reason === item.value}
              disabled={report.isPending}
              onPress={() => {
                setReason(item.value);
                if (errors.reason) setErrors((current) => ({ ...current, reason: null }));
              }}
            />
          ))}
          {errors.reason ? <Text style={styles.fieldError}>{errors.reason}</Text> : null}
        </View>
        <View>
          <TextArea
            label="Chi tiết"
            value={detail}
            onChangeText={(value) => {
              setDetail(value);
              if (errors.detail) setErrors((current) => ({ ...current, detail: null }));
            }}
            placeholder="Mô tả điều bạn thấy chưa đúng"
            rows={5}
            maxLength={DETAIL_MAX}
            error={errors.detail}
            editable={!report.isPending}
          />
          {!errors.detail ? <Text style={styles.hint}>Từ 10 đến 2.000 ký tự.</Text> : null}
        </View>
        <FormAlert message={report.isError ? errorMessage(report.error) : null} />
      </FormScroll>
      <ActionBar>
        <Button
          label="Gửi báo cáo"
          busyLabel="Đang gửi"
          busy={report.isPending}
          disabled={alreadyPending}
          onPress={submit}
          block
          size="large"
        />
      </ActionBar>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg, paddingVertical: spacing.xl, paddingLeft: spacing.contentLeft, paddingRight: spacing.contentRight },
  placeName: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 22, color: colors.text },
  legend: { ...type.label, color: colors.textSecondary, marginBottom: spacing.xs },
  legendError: { color: colors.error },
  fieldError: { ...type.error, marginTop: spacing.xs },
  hint: { ...type.secondary, marginTop: 6 },
});

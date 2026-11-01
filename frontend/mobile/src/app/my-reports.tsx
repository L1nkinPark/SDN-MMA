import { router } from 'expo-router';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { errorMessage } from '@/api/errors';
import { useMyReports } from '@/api/hooks/useReports';
import { reasonLabel, REPORT_STATUS_LABELS } from '@/api/reports';
import type { Report } from '@/api/types';
import { useSession } from '@/auth/session';
import { Button, FormAlert, Header, LoadingList, MessageState, Screen } from '@/components';
import { colors, fonts, sizes, spacing } from '@/theme';
import { formatDate } from '@/utils/format';

function ReportItem({ report }: { report: Report }) {
  const status = report.status ?? 'pending';
  const pending = status === 'pending';
  const tagColor = pending ? colors.ink : colors.textSecondary;
  return (
    <View style={styles.item}>
      <View style={styles.itemTop}>
        <Text style={styles.reason}>{reasonLabel(report.reason)}</Text>
        <Text style={[styles.tag, { borderColor: tagColor, color: tagColor }]}>{REPORT_STATUS_LABELS[status]}</Text>
      </View>
      {report.detail ? <Text style={styles.detail}>{report.detail}</Text> : null}
      <Text style={styles.date}>{formatDate(report.createdAt)}</Text>
    </View>
  );
}

export default function MyReportsScreen() {
  const { status } = useSession();
  const reports = useMyReports();

  let body;
  let count: string | undefined;
  if (status === 'guest') {
    body = (
      <MessageState
        heading="Đăng nhập để xem báo cáo"
        sentence="Báo cáo được lưu theo tài khoản của bạn."
        action={{ label: 'Đăng nhập', variant: 'primary', onPress: () => router.push('/login') }}
      />
    );
  } else if (status === 'loading' || reports.isPending) {
    body = <LoadingList />;
  } else if (reports.isError && !reports.data) {
    body = (
      <MessageState
        tone="error"
        heading="Chưa tải được danh sách"
        sentence={errorMessage(reports.error)}
        action={{ label: 'Thử lại', onPress: () => reports.refetch(), busy: reports.isFetching }}
      />
    );
  } else if (reports.items.length === 0) {
    body = (
      <MessageState
        heading="Bạn chưa gửi báo cáo nào"
        sentence="Khi thấy thông tin sai, hãy báo cáo từ trang chi tiết địa điểm."
      />
    );
  } else {
    count = `${reports.total} báo cáo`;
    body = (
      <FlatList
        data={reports.items}
        keyExtractor={(report, index) => report._id ?? String(index)}
        renderItem={({ item }) => <ReportItem report={item} />}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (reports.hasNextPage && !reports.isFetchingNextPage && !reports.isFetchNextPageError) reports.fetchNextPage();
        }}
        refreshControl={
          <RefreshControl
            refreshing={reports.isRefetching && !reports.isFetchingNextPage}
            onRefresh={() => {
              reports.refetch();
            }}
            colors={[colors.ink]}
            tintColor={colors.ink}
          />
        }
        ListFooterComponent={
          reports.isFetchingNextPage ? (
            <LoadingList rows={1} />
          ) : reports.isFetchNextPageError ? (
            <View style={styles.footerError}>
              <FormAlert message={errorMessage(reports.error)} />
              <Button label="Tải thêm" onPress={() => reports.fetchNextPage()} />
            </View>
          ) : undefined
        }
      />
    );
  }

  return (
    <Screen>
      <Header title="Báo cáo của tôi" back right={count} />
      {body}
    </Screen>
  );
}

const styles = StyleSheet.create({
  item: {
    gap: 6,
    paddingVertical: spacing.md,
    paddingLeft: spacing.contentLeft,
    paddingRight: spacing.contentRight,
    borderBottomWidth: sizes.rowRule,
    borderBottomColor: colors.rule,
  },
  itemTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  reason: { flex: 1, fontFamily: fonts.semibold, fontSize: 15, lineHeight: 22, color: colors.text },
  tag: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderWidth: 1.5,
    borderRadius: sizes.radius,
    fontFamily: fonts.semibold,
    fontSize: 12,
    lineHeight: 16,
  },
  detail: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.text },
  date: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.textSecondary },
  footerError: { gap: spacing.sm, paddingVertical: spacing.lg, paddingLeft: spacing.contentLeft, paddingRight: spacing.contentRight },
});

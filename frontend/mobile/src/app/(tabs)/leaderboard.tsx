import { router } from 'expo-router';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { errorMessage } from '@/api/errors';
import { useLeaderboard } from '@/api/hooks/useLeaderboard';
import { useRefetchOnFocus } from '@/api/hooks/useRefetchOnFocus';
import { LEADERBOARD_LIMIT } from '@/api/reputation';
import type { LeaderboardEntry } from '@/api/types';
import { useSession } from '@/auth/session';
import { Header, LoadingList, MessageState, Screen } from '@/components';
import { colors, fonts, sizes, spacing } from '@/theme';

function Row({ entry, rank, isMe }: { entry: LeaderboardEntry; rank: number; isMe: boolean }) {
  const top = rank <= 3;
  const name = `${entry.name ?? ''}${isMe ? ' (bạn)' : ''}`;
  const points = `${entry.reputation ?? 0} điểm`;
  return (
    <View
      accessible
      accessibilityLabel={`Hạng ${rank}, ${name}, ${points}`}
      style={[styles.row, isMe ? styles.rowMe : null]}>
      <Text style={[styles.rank, top ? styles.rankTop : styles.rankRest]}>{rank}</Text>
      <Text style={[styles.name, isMe ? styles.nameMe : null]} numberOfLines={2}>
        {name}
      </Text>
      <Text style={styles.points}>{points}</Text>
    </View>
  );
}

export default function LeaderboardScreen() {
  const { user } = useSession();
  const leaderboard = useLeaderboard();
  useRefetchOnFocus(leaderboard.refetch);

  const items = leaderboard.data?.items ?? [];

  let body;
  if (leaderboard.isPending) {
    body = <LoadingList />;
  } else if (leaderboard.isError && !leaderboard.data) {
    body = (
      <MessageState
        tone="error"
        heading="Chưa tải được bảng xếp hạng"
        sentence={errorMessage(leaderboard.error)}
        action={{ label: 'Thử lại', onPress: () => leaderboard.refetch(), busy: leaderboard.isFetching }}
      />
    );
  } else if (items.length === 0) {
    body = (
      <MessageState
        heading="Chưa có ai trên bảng xếp hạng"
        sentence="Check-in hoặc viết đánh giá để có điểm đầu tiên."
        action={{ label: 'Tìm địa điểm', onPress: () => router.navigate('/') }}
      />
    );
  } else {
    body = (
      <FlatList
        data={items}
        keyExtractor={(entry, index) => entry._id ?? String(index)}
        refreshControl={
          <RefreshControl
            refreshing={leaderboard.isRefetching}
            onRefresh={() => {
              leaderboard.refetch();
            }}
            colors={[colors.ink]}
            tintColor={colors.ink}
          />
        }
        renderItem={({ item, index }) => (
          <Row entry={item} rank={index + 1} isMe={Boolean(user?.id) && item._id === user?.id} />
        )}
      />
    );
  }

  return (
    <Screen>
      <Header title="Xếp hạng" right={items.length > 0 ? `Top ${LEADERBOARD_LIMIT}` : undefined} />
      {body}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 56,
    paddingLeft: spacing.contentLeft,
    paddingRight: spacing.contentRight,
    borderBottomWidth: sizes.rowRule,
    borderBottomColor: colors.rule,
  },
  rowMe: { backgroundColor: colors.loading },
  rank: { width: 40, fontFamily: fonts.title, fontVariant: ['tabular-nums'] },
  rankTop: { fontSize: 30, lineHeight: 32, color: colors.ink },
  rankRest: { fontSize: 22, lineHeight: 24, color: colors.textSecondary },
  name: { flex: 1, fontFamily: fonts.medium, fontSize: 15, lineHeight: 22, color: colors.text },
  nameMe: { fontFamily: fonts.semibold },
  points: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text, fontVariant: ['tabular-nums'] },
});

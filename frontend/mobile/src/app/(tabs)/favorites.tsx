import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet } from 'react-native';

import { errorMessage } from '@/api/errors';
import { useFavorites, useRemoveFavorite } from '@/api/hooks/useFavorites';
import { useRefetchOnFocus } from '@/api/hooks/useRefetchOnFocus';
import { useSession } from '@/auth/session';
import { FormAlert, Header, LoadingList, MessageState, PlaceRow, Screen } from '@/components';
import { colors, spacing } from '@/theme';

export default function FavoritesScreen() {
  const { status } = useSession();
  const favorites = useFavorites();
  const remove = useRemoveFavorite();
  const [removingId, setRemovingId] = useState<string | null>(null);

  useRefetchOnFocus(favorites.refetch, status === 'signed-in');

  const items = favorites.data?.items ?? [];
  const showList = status === 'signed-in' && items.length > 0;

  function handleRemove(placeId: string) {
    setRemovingId(placeId);
    remove.mutate(placeId, { onSettled: () => setRemovingId(null) });
  }

  let body;
  if (status === 'guest') {
    body = (
      <MessageState
        heading="Đăng nhập để xem chỗ đã lưu"
        sentence="Danh sách yêu thích được lưu theo tài khoản của bạn."
        action={{ label: 'Đăng nhập', variant: 'primary', onPress: () => router.push('/login') }}
      />
    );
  } else if (status === 'loading' || favorites.isPending) {
    body = <LoadingList />;
  } else if (favorites.isError && !favorites.data) {
    body = (
      <MessageState
        tone="error"
        heading="Chưa tải được danh sách"
        sentence={errorMessage(favorites.error)}
        action={{ label: 'Thử lại', onPress: () => favorites.refetch(), busy: favorites.isFetching }}
      />
    );
  } else if (items.length === 0) {
    body = (
      <MessageState
        heading="Chưa lưu địa điểm nào"
        sentence="Bấm biểu tượng trái tim ở một địa điểm để lưu lại đây."
        action={{ label: 'Tìm địa điểm', onPress: () => router.navigate('/') }}
      />
    );
  } else {
    body = (
      <FlatList
        data={items}
        keyExtractor={(place, index) => place._id ?? String(index)}
        ListHeaderComponent={remove.isError ? <FormAlert message={errorMessage(remove.error)} /> : undefined}
        ListHeaderComponentStyle={remove.isError ? styles.alert : undefined}
        refreshControl={
          <RefreshControl
            refreshing={favorites.isRefetching}
            onRefresh={() => {
              favorites.refetch();
            }}
            colors={[colors.ink]}
            tintColor={colors.ink}
          />
        }
        renderItem={({ item }) => (
          <PlaceRow
            place={item}
            favorite
            favoriteBusy={removingId === item._id}
            onToggleFavorite={item._id ? () => handleRemove(item._id as string) : undefined}
            onPress={item._id ? () => router.push({ pathname: '/places/[id]', params: { id: item._id as string } }) : undefined}
          />
        )}
      />
    );
  }

  return (
    <Screen>
      <Header title="Yêu thích" right={showList ? `${items.length} địa điểm` : undefined} />
      {body}
    </Screen>
  );
}

const styles = StyleSheet.create({
  alert: { paddingTop: spacing.md, paddingLeft: spacing.contentLeft, paddingRight: spacing.contentRight },
});

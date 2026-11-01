import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { errorMessage } from '@/api/errors';
import { usePlaces } from '@/api/hooks/usePlaces';
import { useRefetchOnFocus } from '@/api/hooks/useRefetchOnFocus';
import type { Place, PlaceListQuery } from '@/api/types';
import { Icon, LoadingList, MessageState, PlaceRow, Screen } from '@/components';
import { countActiveFilters, hidesUnverified, resetPlaceFilters, usePlaceFilters } from '@/explore/filters';
import { DEFAULT_CENTER, distanceMeters, formatDistance, fromCoordinates, openLocationSettings, type LatLng } from '@/location/location';
import { useCurrentLocation } from '@/location/useCurrentLocation';
import { colors, fonts, sizes, spacing, type } from '@/theme';
import { crowdLevel, isStatusKnown } from '@/utils/liveStatus';

type Mode = 'map' | 'list';

const MAP_DELTA = { latitudeDelta: 0.03, longitudeDelta: 0.03 };
/** Same top spacing as the shared Header: 64px in the 844px design, ~44px of it status bar. */
const HEADER_TOP = spacing.headerTop - 44;

function openPlace(place: Place) {
  if (place._id) router.push({ pathname: '/places/[id]', params: { id: place._id } });
}

function distanceTo(origin: LatLng | null, place: Place): string | null {
  const position = fromCoordinates(place.location?.coordinates);
  return origin && position ? formatDistance(distanceMeters(origin, position)) : null;
}

/** Unknown status: white dot with ink ring. Known: ink, or red when it is crowded. */
function PlaceMarker({ place, selected }: { place: Place; selected: boolean }) {
  const known = isStatusKnown(place.liveStatus);
  const fill = !known ? colors.paper : crowdLevel(place.liveStatus?.crowd) === 3 ? colors.error : colors.ink;
  const size = selected ? 26 : 20;
  return (
    <View
      style={[
        styles.marker,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: fill },
        known ? styles.markerKnown : styles.markerUnknown,
      ]}
    />
  );
}

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>('map');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const filters = usePlaceFilters();
  const location = useCurrentLocation();
  const origin = location.coords;
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    const timer = setTimeout(() => setQ(search.trim()), 400);
    return () => clearTimeout(timer);
  }, [search]);

  // The map may open before the position is known; move there once it is.
  useEffect(() => {
    if (origin) mapRef.current?.animateToRegion({ ...origin, ...MAP_DELTA });
  }, [origin]);

  const query = useMemo<Omit<PlaceListQuery, 'page' | 'limit'>>(() => {
    const { radius, ...rest } = filters;
    return {
      ...rest,
      q: q || undefined,
      // lat, lng and radius only work together; without them the API sorts by newest.
      ...(origin ? { lat: origin.latitude, lng: origin.longitude, radius } : {}),
    };
  }, [filters, q, origin]);

  // Wait for the first location answer so the list isn't fetched twice on open.
  const places = usePlaces(query, location.status !== 'loading' || origin !== null);
  const items = places.items;
  // Others' check-ins, reviews and admin changes don't reach the list by themselves.
  useRefetchOnFocus(places.refetch);
  const activeFilters = countActiveFilters(filters);
  const selected = items.find((place) => place._id === selectedId) ?? items[0];
  const noLocation = location.status === 'denied' || location.status === 'unavailable';

  const enableLocation = () => {
    if (location.status === 'denied' && !location.canAskAgain) openLocationSettings();
    else location.refresh();
  };

  // Re-reads the position (it may have moved); the effect above moves the map when it arrives.
  const locateMe = () => {
    if (origin) mapRef.current?.animateToRegion({ ...origin, ...MAP_DELTA });
    enableLocation();
  };

  let body;
  if (places.isError && items.length === 0) {
    body = (
      <MessageState
        tone="error"
        heading="Chưa tải được địa điểm"
        sentence={errorMessage(places.error)}
        action={{ label: 'Thử lại', onPress: () => places.refetch(), busy: places.isFetching }}
      />
    );
  } else if (!places.isPending && items.length === 0) {
    body = activeFilters > 0 ? (
      <MessageState
        heading="Không có địa điểm phù hợp"
        sentence={
          hidesUnverified(filters)
            ? 'Địa điểm chưa xác minh Wi-Fi, ổ cắm hoặc giá sẽ không hiện khi lọc theo các mục này. Thử bỏ bớt bộ lọc.'
            : 'Thử bỏ bớt bộ lọc.'
        }
        action={{ label: 'Xóa bộ lọc', onPress: resetPlaceFilters }}
      />
    ) : q ? (
      <MessageState
        heading="Không có địa điểm phù hợp"
        sentence="Không tìm thấy địa điểm nào khớp với từ khóa này."
        action={{ label: 'Xóa tìm kiếm', onPress: () => setSearch('') }}
      />
    ) : (
      <MessageState heading="Chưa có địa điểm gần đây" sentence="Thử tăng khoảng cách trong bộ lọc." action={{ label: 'Mở bộ lọc', onPress: () => router.push('/filter') }} />
    );
  } else if (mode === 'list') {
    body = places.isPending ? (
      <LoadingList />
    ) : (
      <FlatList
        data={items}
        keyExtractor={(place, index) => place._id ?? String(index)}
        renderItem={({ item }) => <PlaceRow place={item} distance={distanceTo(origin, item)} onPress={() => openPlace(item)} />}
        onEndReached={() => {
          if (places.hasNextPage && !places.isFetchingNextPage) places.fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={places.isRefetching && !places.isFetchingNextPage}
            onRefresh={() => {
              places.refetch();
            }}
            colors={[colors.ink]}
            tintColor={colors.ink}
          />
        }
      />
    );
  } else {
    const center = origin ?? DEFAULT_CENTER;
    body = (
      <View style={styles.flex}>
        <View style={styles.flex}>
          <MapView ref={mapRef} style={StyleSheet.absoluteFill} initialRegion={{ ...center, ...MAP_DELTA }} toolbarEnabled={false}>
            {items.map((place) => {
              const coordinate = fromCoordinates(place.location?.coordinates);
              if (!coordinate || !place._id) return null;
              const isSelected = place._id === selected?._id;
              return (
                <Marker
                  key={place._id}
                  coordinate={coordinate}
                  anchor={{ x: 0.5, y: 0.5 }}
                  zIndex={isSelected ? 2 : 1}
                  accessibilityLabel={place.name}
                  onPress={() => setSelectedId(place._id ?? null)}>
                  <PlaceMarker place={place} selected={isSelected} />
                </Marker>
              );
            })}
            {origin ? (
              <Marker coordinate={origin} anchor={{ x: 0.5, y: 0.5 }} zIndex={3} accessibilityLabel="Vị trí của bạn">
                <View style={styles.me} />
              </Marker>
            ) : null}
          </MapView>
          <Pressable accessibilityRole="button" accessibilityLabel="Về vị trí của tôi" onPress={locateMe} style={styles.locate}>
            <Icon name="locate" color={colors.ink} />
          </Pressable>
        </View>
        {selected ? (
          <View style={styles.card}>
            <PlaceRow place={selected} distance={distanceTo(origin, selected)} onPress={() => openPlace(selected)} />
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 24) + HEADER_TOP }]}>
        <View style={styles.titleRow}>
          <Text accessibilityRole="header" style={type.screenTitle}>
            Khám phá
          </Text>
          <View accessibilityLabel="Kiểu xem" style={styles.modes}>
            {(['map', 'list'] as const).map((value) => {
              const active = mode === value;
              return (
                <Pressable
                  key={value}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  onPress={() => setMode(value)}
                  style={[styles.mode, { borderBottomColor: active ? colors.ink : 'transparent' }]}>
                  <Text style={[styles.modeLabel, active ? styles.modeActive : null]}>{value === 'map' ? 'Bản đồ' : 'Danh sách'}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <View style={styles.searchRow}>
          <Icon name="search" color={colors.textSecondary} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            accessibilityLabel="Tìm theo tên hoặc địa chỉ"
            placeholder="Tìm tên hoặc địa chỉ"
            placeholderTextColor={colors.placeholder}
            selectionColor={colors.ink}
            returnKeyType="search"
            style={styles.search}
          />
          <Pressable accessibilityRole="button" accessibilityLabel="Mở bộ lọc" onPress={() => router.push('/filter')} style={styles.filter}>
            <Icon name="filter" color={colors.ink} />
            <Text style={styles.filterLabel}>{activeFilters ? `Lọc (${activeFilters})` : 'Lọc'}</Text>
          </Pressable>
        </View>
      </View>

      {noLocation ? (
        <View style={styles.banner}>
          <Text style={[type.secondary, styles.flex]}>Chưa có vị trí nên danh sách xếp theo địa điểm mới.</Text>
          <Pressable accessibilityRole="button" onPress={enableLocation} style={styles.bannerButton}>
            <Text style={styles.link}>Bật vị trí</Text>
          </Pressable>
        </View>
      ) : null}

      {body}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    gap: spacing.sm,
    paddingLeft: spacing.contentLeft,
    paddingRight: spacing.contentRight,
    borderBottomWidth: sizes.titleRule,
    borderBottomColor: colors.ink,
    backgroundColor: colors.paper,
  },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.md },
  modes: { flexDirection: 'row', gap: spacing.lg },
  mode: { minHeight: sizes.touchTarget, justifyContent: 'center', borderBottomWidth: 3 },
  modeLabel: { fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary },
  modeActive: { fontFamily: fonts.semibold, color: colors.ink },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingBottom: spacing.xs },
  search: { flex: 1, minWidth: 0, height: sizes.touchTarget, padding: 0, fontFamily: fonts.regular, fontSize: 16, color: colors.text },
  filter: { height: sizes.touchTarget, flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: spacing.md },
  filterLabel: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingLeft: spacing.contentLeft,
    paddingRight: spacing.contentRight,
    borderBottomWidth: sizes.rowRule,
    borderBottomColor: colors.rule,
  },
  bannerButton: { minHeight: sizes.touchTarget, justifyContent: 'center' },
  link: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  marker: { borderWidth: 2 },
  markerKnown: { borderColor: colors.onInk },
  markerUnknown: { borderColor: colors.ink },
  me: { width: 14, height: 14, borderRadius: 7, borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.onInk },
  locate: {
    position: 'absolute',
    right: spacing.contentRight,
    bottom: spacing.lg,
    width: sizes.touchTarget,
    height: sizes.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: sizes.radius,
    backgroundColor: colors.paper,
  },
  card: { borderTopWidth: sizes.titleRule, borderTopColor: colors.ink, backgroundColor: colors.paper },
});

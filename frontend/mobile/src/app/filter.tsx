import { router, Stack } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Crowd, Noise } from '@/api/types';
import { ActionBar, Button, ChoiceChip, Icon, Screen, TextField } from '@/components';
import { DEFAULT_FILTERS, RADIUS_OPTIONS, setPlaceFilters, usePlaceFilters, type PlaceFilters } from '@/explore/filters';
import { colors, fonts, sizes, spacing, type } from '@/theme';
import { formatThousands } from '@/utils/format';

const crowdOptions: { value: Crowd; label: string }[] = [
  { value: 'low', label: 'Vắng' },
  { value: 'medium', label: 'Vừa' },
  { value: 'high', label: 'Đông' },
  { value: 'unknown', label: 'Chưa rõ' },
];

const noiseOptions: { value: Noise; label: string }[] = [
  { value: 'quiet', label: 'Yên tĩnh' },
  { value: 'moderate', label: 'Vừa' },
  { value: 'loud', label: 'Ồn' },
  { value: 'unknown', label: 'Chưa rõ' },
];

/** "30.000", "30,000" or "30000" -> 30000; empty -> undefined. */
function parsePrice(text: string): number | undefined {
  const digits = text.replace(/[.,\s]/g, '');
  if (!digits) return undefined;
  const value = Number(digits);
  return Number.isFinite(value) ? value : undefined;
}

function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Checkbox({ label, checked, onPress }: { label: string; checked: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={onPress} style={styles.checkRow}>
      <Text style={styles.checkLabel}>{label}</Text>
      <View style={[styles.box, checked ? styles.boxChecked : null]}>
        {checked ? <Icon name="check" size={16} color={colors.onInk} strokeWidth={2} /> : null}
      </View>
    </Pressable>
  );
}

/** Screen 4. Edits a draft and applies it to Khám phá on "Xem kết quả". */
export default function FilterScreen() {
  const insets = useSafeAreaInsets();
  const applied = usePlaceFilters();
  const [draft, setDraft] = useState<PlaceFilters>(applied);
  const [priceText, setPriceText] = useState(applied.maxPrice !== undefined ? formatThousands(applied.maxPrice) : '');

  const update = <K extends keyof PlaceFilters>(key: K, value: PlaceFilters[K]) =>
    setDraft((previous) => ({ ...previous, [key]: value }));

  const clear = () => {
    setDraft(DEFAULT_FILTERS);
    setPriceText('');
  };

  const apply = () => {
    setPlaceFilters({ ...draft, maxPrice: parsePrice(priceText) });
    close();
  };

  return (
    <Screen>
      <Stack.Screen options={{ presentation: 'modal' }} />
      <View style={[styles.top, { paddingTop: Math.max(insets.top, 24) + 8 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Đóng bộ lọc" onPress={close} style={styles.close}>
          <Icon name="close" color={colors.ink} />
        </Pressable>
      </View>
      <View style={styles.titleBlock}>
        <Text accessibilityRole="header" style={type.screenTitle}>
          Bộ lọc
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Section title="Khoảng cách">
          <View style={styles.chips}>
            {RADIUS_OPTIONS.map((radius) => (
              <ChoiceChip
                key={radius}
                label={`${radius / 1000} km`}
                selected={draft.radius === radius}
                onPress={() => update('radius', radius)}
              />
            ))}
          </View>
        </Section>

        <View>
          <Text style={[styles.sectionTitle, styles.amenitiesTitle]}>Tiện ích</Text>
          <Checkbox label="Có Wi-Fi" checked={Boolean(draft.wifi)} onPress={() => update('wifi', draft.wifi ? undefined : true)} />
          <Checkbox
            label="Có ổ cắm"
            checked={Boolean(draft.outlets)}
            onPress={() => update('outlets', draft.outlets ? undefined : true)}
          />
          <Text style={type.secondary}>Chỉ hiện nơi đã xác minh có tiện ích này.</Text>
        </View>

        <TextField
          label="Giá nước tối đa (đồng)"
          value={priceText}
          onChangeText={setPriceText}
          placeholder="Ví dụ 30.000"
          keyboardType="number-pad"
        />

        <Section title="Độ đông">
          <View style={styles.chips}>
            {crowdOptions.map((option) => (
              <ChoiceChip
                key={option.value}
                label={option.label}
                selected={draft.crowd === option.value}
                onPress={() => update('crowd', draft.crowd === option.value ? undefined : option.value)}
              />
            ))}
          </View>
        </Section>

        <Section title="Độ ồn">
          <View style={styles.chips}>
            {noiseOptions.map((option) => (
              <ChoiceChip
                key={option.value}
                label={option.label}
                selected={draft.noise === option.value}
                onPress={() => update('noise', draft.noise === option.value ? undefined : option.value)}
              />
            ))}
          </View>
        </Section>
      </ScrollView>

      <ActionBar>
        <View style={styles.actions}>
          <Button label="Xóa lọc" variant="secondary" size="large" onPress={clear} style={styles.action} />
          <Button label="Xem kết quả" size="large" onPress={apply} style={styles.action} />
        </View>
      </ActionBar>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'flex-end', paddingRight: spacing.sm },
  close: { width: sizes.touchTarget, height: sizes.touchTarget, alignItems: 'center', justifyContent: 'center' },
  titleBlock: {
    paddingLeft: spacing.contentLeft,
    paddingRight: spacing.contentRight,
    paddingBottom: spacing.headerBottom,
    borderBottomWidth: sizes.titleRule,
    borderBottomColor: colors.ink,
  },
  content: { gap: 22, paddingTop: spacing.xl, paddingBottom: spacing.xl, paddingLeft: spacing.contentLeft, paddingRight: spacing.contentRight },
  section: { gap: spacing.sm },
  sectionTitle: { ...type.label, color: colors.textSecondary },
  amenitiesTitle: { marginBottom: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  checkRow: { minHeight: sizes.touchTarget, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  checkLabel: { fontFamily: fonts.regular, fontSize: 15, color: colors.text },
  box: {
    width: 24,
    height: 24,
    borderWidth: 1.5,
    borderColor: colors.fieldLine,
    borderRadius: sizes.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChecked: { borderColor: colors.ink, backgroundColor: colors.ink },
  actions: { flexDirection: 'row', gap: spacing.md },
  action: { flex: 1, alignSelf: 'auto', paddingHorizontal: 0 },
});

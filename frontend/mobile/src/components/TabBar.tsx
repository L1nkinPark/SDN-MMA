import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts, sizes } from '@/theme';

import { Icon, type IconName } from './Icon';

const TABS: Record<string, { label: string; icon: IconName }> = {
  index: { label: 'Khám phá', icon: 'pin' },
  favorites: { label: 'Yêu thích', icon: 'heart' },
  leaderboard: { label: 'Xếp hạng', icon: 'ranking' },
  profile: { label: 'Hồ sơ', icon: 'person' },
};

/** 84px tab bar with a 1.5px ink rule on top; the active tab has a 3px ink bar and a filled icon. */
export function TabBar({ state, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, 24);

  return (
    <View
      accessibilityRole="tablist"
      style={[styles.bar, { height: sizes.tabBarHeight - 24 + bottom, paddingBottom: bottom }]}>
      {state.routes.map((route, index) => {
        const tab = TABS[route.name];
        if (!tab) return null;
        const active = state.index === index;
        const color = active ? colors.ink : colors.textSecondary;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: active }}
            onPress={() => {
              if (!active) navigateToTab(route.key);
            }}
            style={[styles.tab, { borderTopColor: active ? colors.ink : 'transparent' }]}>
            <Icon name={tab.icon} color={color} filled={active} />
            <Text style={[styles.label, { color, fontFamily: active ? fonts.semibold : fonts.medium }]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.paper,
    borderTopWidth: sizes.tabBarRule,
    borderTopColor: colors.ink,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderTopWidth: sizes.tabActiveBar,
    marginTop: -sizes.tabBarRule,
    minHeight: sizes.touchTarget,
  },
  label: { fontSize: 12 },
});

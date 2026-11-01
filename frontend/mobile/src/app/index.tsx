import { Text, View } from 'react-native';

import { colors, spacing, type } from '@/theme';

export default function Home() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.paper, paddingTop: spacing.headerTop, paddingLeft: spacing.contentLeft }}>
      <Text style={type.screenTitle}>StudySpot</Text>
    </View>
  );
}

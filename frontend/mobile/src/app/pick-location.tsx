import { router } from 'expo-router';

import { Header, MessageState, Screen } from '@/components';

/**
 * Placeholder: Chọn vị trí. Person A owns this screen.
 * When built, it must call `setPickedLocation({ latitude, longitude })` from
 * `@/location/pickedLocation` and go back; /propose reads it from there.
 */
export default function PickLocationScreen() {
  return (
    <Screen>
      <Header title="Chọn vị trí" back />
      <MessageState
        heading="Màn hình này chưa sẵn sàng"
        sentence="Chức năng chọn vị trí trên bản đồ đang được làm, nên chưa gửi được đề xuất."
        action={{ label: 'Quay lại', onPress: () => (router.canGoBack() ? router.back() : router.replace('/')) }}
      />
    </Screen>
  );
}

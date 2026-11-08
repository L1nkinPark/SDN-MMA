import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { colors, sizes, spacing, type } from '@/theme';

import { FormAlert } from './FormAlert';
import { LoadingList } from './LoadingList';
import { MessageState } from './MessageState';

type QrScannerProps = {
  /** Return false to keep scanning, e.g. after a QR that isn't the right kind. */
  onScan: (data: string) => boolean;
  /** Shown under the camera, e.g. why the last QR was refused. */
  error?: string | null;
  hint: string;
};

/** Camera view that reads one QR code. Handles the camera permission states itself. */
export function QrScanner({ onScan, error, hint }: QrScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();
  // The camera reports the same code many times a second; handle one at a time.
  const lastData = useRef<string | null>(null);

  if (!permission) return <LoadingList rows={2} />;

  if (!permission.granted) {
    return (
      <MessageState
        heading="Cần quyền camera để quét mã"
        sentence="Camera chỉ dùng để đọc mã QR quán hiển thị tại quầy."
        action={
          permission.canAskAgain
            ? { label: 'Cho phép camera', variant: 'primary', onPress: () => void requestPermission() }
            : { label: 'Mở cài đặt', variant: 'primary', onPress: () => void Linking.openSettings() }
        }
      />
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.frame}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={({ data }) => {
            if (!data || data === lastData.current) return;
            lastData.current = data;
            if (!onScan(data)) {
              // Allow the same code again after a moment, e.g. once the shop shows a new one.
              setTimeout(() => {
                if (lastData.current === data) lastData.current = null;
              }, 2000);
            }
          }}
        />
      </View>
      <Text style={type.body}>{hint}</Text>
      <FormAlert message={error} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.lg, paddingTop: spacing.xl, paddingLeft: spacing.contentLeft, paddingRight: spacing.contentRight },
  frame: {
    aspectRatio: 1,
    overflow: 'hidden',
    borderWidth: sizes.titleRule,
    borderColor: colors.ink,
    borderRadius: sizes.radius,
    backgroundColor: colors.loading,
  },
});

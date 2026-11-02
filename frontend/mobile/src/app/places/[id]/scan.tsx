import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Header, Screen } from '@/components';
import { colors, spacing, type } from '@/theme';

export default function ScanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  return <Screen><Header title="Quét QR tại quầy" back /><View style={styles.content}>
    <Text style={type.secondary}>Nhờ nhân viên hiển thị mã QR StudySpot của quán. Mã có hiệu lực 90 giây.</Text>
    {!permission?.granted ? <Button label="Cho phép camera" onPress={() => void requestPermission()} /> :
      <CameraView style={styles.camera} barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanned ? undefined : ({ data }) => {
          setScanned(true);
          router.replace({ pathname: '/places/[id]/checkin', params: { id, visitCode: data } });
        }} />}
    {scanned ? <Text style={type.secondary}>Đã quét mã. Đang mở check-in...</Text> : null}
  </View></Screen>;
}
const styles = StyleSheet.create({ content: { flex: 1, gap: spacing.lg, padding: spacing.lg }, camera: { flex: 1, minHeight: 320, backgroundColor: colors.loading } });

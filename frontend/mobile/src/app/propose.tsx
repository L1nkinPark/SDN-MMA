import { router } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Pressable, StyleSheet, Text, View, type TextInput } from 'react-native';

import { errorMessage } from '@/api/errors';
import { useCreatePlace } from '@/api/hooks/useCreatePlace';
import { useSession } from '@/auth/session';
import {
  ActionBar,
  Button,
  ChoiceChip,
  FormAlert,
  FormScroll,
  Header,
  Icon,
  MessageState,
  Screen,
  TextArea,
  TextField,
} from '@/components';
import { clearPickedLocation, formatPickedLocation, toCoordinates, usePickedLocation } from '@/location/pickedLocation';
import { colors, fonts, sizes, spacing, type } from '@/theme';
import { addressError, descriptionError, parsePrice, placeNameError, priceError } from '@/utils/validation';

type Amenity = boolean | null;
type Field = 'name' | 'address' | 'location' | 'description' | 'price';
type Errors = Record<Field, string | null>;

const NO_ERRORS: Errors = { name: null, address: null, location: null, description: null, price: null };

const AMENITY_CHOICES: { label: string; value: Amenity }[] = [
  { label: 'Có', value: true },
  { label: 'Không', value: false },
  { label: 'Chưa rõ', value: null },
];

function AmenityPicker({ legend, value, onChange }: { legend: string; value: Amenity; onChange: (value: Amenity) => void }) {
  return (
    <View style={styles.amenity} accessibilityRole="radiogroup" accessibilityLabel={legend}>
      <Text style={styles.legend}>{legend}</Text>
      <View style={styles.chips}>
        {AMENITY_CHOICES.map((choice) => (
          <ChoiceChip
            key={choice.label}
            label={choice.label}
            accessibilityLabel={`${legend}: ${choice.label}`}
            selected={value === choice.value}
            onPress={() => onChange(choice.value)}
          />
        ))}
      </View>
    </View>
  );
}

export default function ProposeScreen() {
  const { status } = useSession();
  const location = usePickedLocation();
  const create = useCreatePlace();
  const addressRef = useRef<ComponentRef<typeof TextInput>>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [wifi, setWifi] = useState<Amenity>(null);
  const [outlets, setOutlets] = useState<Amenity>(null);
  const [price, setPrice] = useState('');
  const [errors, setErrors] = useState<Errors>(NO_ERRORS);

  // Start each visit without a point left over from an earlier proposal.
  useEffect(() => {
    clearPickedLocation();
  }, []);

  function clearError(field: Field) {
    setErrors((current) => (current[field] ? { ...current, [field]: null } : current));
  }

  function submit() {
    if (create.isPending) return;
    const next: Errors = {
      name: placeNameError(name),
      address: addressError(address),
      location: location ? null : 'Hãy chọn vị trí trên bản đồ.',
      description: descriptionError(description),
      price: priceError(price),
    };
    setErrors(next);
    if (Object.values(next).some(Boolean) || !location) return;
    create.mutate(
      {
        name: name.trim(),
        description: description.trim(),
        address: address.trim(),
        coordinates: toCoordinates(location),
        amenities: { wifi, outlets },
        minDrinkPrice: parsePrice(price) ?? null,
      },
      { onSuccess: () => clearPickedLocation() },
    );
  }

  if (status === 'guest') {
    return (
      <Screen>
        <Header title="Đề xuất địa điểm" back />
        <MessageState
          heading="Đăng nhập để đề xuất địa điểm"
          sentence="Đề xuất được gửi theo tài khoản của bạn."
          action={{ label: 'Đăng nhập', variant: 'primary', onPress: () => router.push('/login') }}
        />
      </Screen>
    );
  }

  if (create.isSuccess) {
    return (
      <Screen>
        <Header title="Đề xuất địa điểm" back />
        <MessageState
          heading="Đã gửi đề xuất"
          sentence="Địa điểm đang chờ duyệt và chưa hiện trong danh sách công khai."
          action={{ label: 'Về Hồ sơ', onPress: () => router.navigate('/profile') }}
        />
      </Screen>
    );
  }

  const busy = create.isPending;
  // Picking a point clears the location error.
  const locationError = location ? null : errors.location;

  return (
    <Screen>
      <Header title="Đề xuất địa điểm" back />
      <FormScroll contentStyle={styles.body}>
        <TextField
          label="Tên địa điểm"
          value={name}
          onChangeText={(value) => {
            setName(value);
            clearError('name');
          }}
          placeholder="Ví dụ: Cà phê Sách D1"
          returnKeyType="next"
          onSubmitEditing={() => addressRef.current?.focus()}
          error={errors.name}
          maxLength={120}
          editable={!busy}
        />
        <TextField
          ref={addressRef}
          label="Địa chỉ"
          value={address}
          onChangeText={(value) => {
            setAddress(value);
            clearError('address');
          }}
          placeholder="Số nhà, đường, khu vực"
          error={errors.address}
          maxLength={300}
          editable={!busy}
        />
        <View style={styles.locationField}>
          <Text style={[styles.legend, locationError ? styles.legendError : null]}>Vị trí trên bản đồ</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={location ? `Vị trí ${formatPickedLocation(location)}. Đổi vị trí` : 'Chọn vị trí'}
            disabled={busy}
            onPress={() => router.push('/pick-location')}
            style={[styles.locationRow, { borderBottomColor: locationError ? colors.error : colors.fieldLine }]}>
            <Text style={location ? styles.locationValue : styles.locationAction}>
              {location ? formatPickedLocation(location) : 'Chọn vị trí'}
            </Text>
            <Icon name="pin" size={20} color={colors.ink} />
          </Pressable>
          {locationError ? <Text style={styles.fieldError}>{locationError}</Text> : null}
        </View>
        <TextArea
          label="Mô tả (không bắt buộc)"
          value={description}
          onChangeText={(value) => {
            setDescription(value);
            clearError('description');
          }}
          placeholder="Không gian, giờ mở cửa, điểm đáng chú ý"
          rows={2}
          maxLength={2000}
          error={errors.description}
          editable={!busy}
        />
        <AmenityPicker legend="Wi-Fi" value={wifi} onChange={setWifi} />
        <AmenityPicker legend="Ổ cắm" value={outlets} onChange={setOutlets} />
        <TextField
          label="Giá nước thấp nhất (đồng, không bắt buộc)"
          value={price}
          onChangeText={(value) => {
            setPrice(value);
            clearError('price');
          }}
          placeholder="Ví dụ 25.000"
          keyboardType="number-pad"
          error={errors.price}
          editable={!busy}
        />
      </FormScroll>
      <ActionBar>
        <FormAlert message={create.isError ? errorMessage(create.error) : null} />
        <Text style={type.secondary}>Địa điểm sẽ hiển thị sau khi quản trị viên duyệt.</Text>
        <Button label="Gửi đề xuất" busyLabel="Đang gửi" busy={busy} onPress={submit} block size="large" />
      </ActionBar>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: 18, paddingVertical: spacing.xl, paddingLeft: spacing.contentLeft, paddingRight: spacing.contentRight },
  legend: { ...type.label, color: colors.textSecondary },
  legendError: { color: colors.error },
  amenity: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  locationField: { gap: spacing.xs },
  locationRow: {
    minHeight: sizes.touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderBottomWidth: sizes.fieldLine,
  },
  locationAction: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  locationValue: { fontFamily: fonts.regular, fontSize: 15, color: colors.text },
  fieldError: { ...type.error, marginTop: spacing.xs },
});

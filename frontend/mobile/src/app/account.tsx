import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, Share, StyleSheet, Switch, Text, View } from 'react-native';
import { api } from '@/api/client';
import { errorMessage } from '@/api/errors';
import { useMe } from '@/api/hooks/useMe';
import { queryKeys } from '@/api/queryKeys';
import { useSession } from '@/auth/session';
import { Button, FormAlert, Header, Screen, TextField } from '@/components';
import { spacing, type } from '@/theme';

export default function AccountScreen() {
  const { signOut } = useSession();
  const me = useMe();
  const client = useQueryClient();
  const [name, setName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [notice, setNotice] = useState('');
  const save = useMutation({ mutationFn: (body: unknown) => api.request('/api/auth/me', { method: 'PATCH', body }),
    onSuccess: () => { setNotice('Đã cập nhật hồ sơ.'); void client.invalidateQueries({ queryKey: queryKeys.me }); } });
  const change = useMutation({ mutationFn: () => api.request('/api/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } }),
    onSuccess: async () => { await signOut(); router.replace('/login'); } });
  const remove = useMutation({ mutationFn: () => api.request('/api/auth/me', { method: 'DELETE', body: { password: deletePassword } }),
    onSuccess: async () => { await signOut(); router.replace('/'); } });
  const exportData = useMutation({ mutationFn: () => api.request<Record<string, unknown>>('/api/auth/me/export'),
    onSuccess: data => void Share.share({ message: JSON.stringify(data, null, 2), title: 'Dữ liệu StudySpot của tôi' }) });
  const user = me.data?.user;
  return <Screen><Header title="Tài khoản" back /><ScrollView contentContainerStyle={styles.content}>
    <Text style={type.heading}>Hồ sơ</Text>
    <Text style={type.secondary}>{user?.email}</Text>
    <TextField label="Tên hiển thị" value={name} placeholder={user?.name} onChangeText={setName} />
    <Button label="Lưu tên" disabled={name.trim().length < 2} busy={save.isPending} onPress={() => save.mutate({ name: name.trim() })} />
    <View style={styles.switch}><Text style={type.body}>Nhận email</Text><Switch value={user?.notificationSettings?.email ?? true}
      onValueChange={email => save.mutate({ notificationSettings: { email } })} /></View>
    <View style={styles.switch}><Text style={type.body}>Thông báo trong ứng dụng</Text><Switch value={user?.notificationSettings?.inApp ?? true}
      onValueChange={inApp => save.mutate({ notificationSettings: { inApp } })} /></View>
    <Text style={type.heading}>Bảo mật</Text>
    <TextField label="Mật khẩu hiện tại" password value={currentPassword} onChangeText={setCurrentPassword} />
    <TextField label="Mật khẩu mới" password value={newPassword} onChangeText={setNewPassword} />
    <Button label="Đổi mật khẩu" disabled={currentPassword.length < 8 || newPassword.length < 8} busy={change.isPending} onPress={() => change.mutate()} />
    <Text style={type.secondary}>Sau khi đổi mật khẩu, bạn cần đăng nhập lại trên mọi thiết bị.</Text>
    <Button label="Xuất dữ liệu cá nhân" variant="secondary" busy={exportData.isPending} onPress={() => exportData.mutate()} />
    {user?.role !== 'admin' ? <><Text style={type.heading}>Xóa tài khoản</Text>
      <Text style={type.secondary}>Thao tác này xóa lịch sử cá nhân và vô hiệu hóa tài khoản. Hãy nhập mật khẩu để xác nhận.</Text>
      <TextField label="Mật khẩu xác nhận" password value={deletePassword} onChangeText={setDeletePassword} />
      <Button label="Xóa tài khoản" variant="secondary" disabled={deletePassword.length < 8} busy={remove.isPending}
        onPress={() => Alert.alert('Xóa tài khoản?', 'Dữ liệu cá nhân sẽ bị xóa và không thể khôi phục.', [
          { text: 'Giữ tài khoản', style: 'cancel' }, { text: 'Xóa', style: 'destructive', onPress: () => remove.mutate() }])} /></> : null}
    <FormAlert message={save.isError ? errorMessage(save.error) : change.isError ? errorMessage(change.error) :
      remove.isError ? errorMessage(remove.error) : exportData.isError ? errorMessage(exportData.error) : notice} />
  </ScrollView></Screen>;
}
const styles = StyleSheet.create({ content: { padding: spacing.lg, gap: spacing.md }, switch: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' } });

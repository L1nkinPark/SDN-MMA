import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useSession } from '@/auth/session';

import { authApi } from '../auth';
import { queryKeys } from '../queryKeys';
import type { ChangePasswordInput, DeleteAccountInput, MeResponse, ResetPasswordInput, UpdateMeInput } from '../types';

/** `PATCH /api/auth/me`; writes the returned user into the session cache. */
export function useUpdateMe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateMeInput) => authApi.updateMe(input),
    onSuccess: (result) => {
      if (result.user) queryClient.setQueryData<MeResponse>(queryKeys.me, { user: result.user });
    },
  });
}

/** The backend revokes every session after a password change, so this one is signed out locally too. */
export function useChangePassword() {
  const { signOut } = useSession();
  return useMutation({
    mutationFn: (input: ChangePasswordInput) => authApi.changePassword(input),
    onSuccess: () => signOut(),
  });
}

export function useDeleteAccount() {
  const { signOut } = useSession();
  return useMutation({
    mutationFn: (input: DeleteAccountInput) => authApi.deleteAccount(input),
    onSuccess: () => signOut(),
  });
}

export function useExportData() {
  return useMutation({ mutationFn: () => authApi.exportData() });
}

export function useForgotPassword() {
  return useMutation({ mutationFn: (email: string) => authApi.forgotPassword(email) });
}

export function useResetPassword() {
  return useMutation({ mutationFn: (input: ResetPasswordInput) => authApi.resetPassword(input) });
}

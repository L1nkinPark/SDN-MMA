export function publicUser(user) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    notificationSettings: user.notificationSettings,
    ...(user.role === 'admin' ? { adminPermissions: user.adminPermissions } : {}),
    reputation: user.reputation,
    favorites: user.favorites
  };
}

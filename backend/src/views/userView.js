export function publicUser(user) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    reputation: user.reputation,
    favorites: user.favorites
  };
}

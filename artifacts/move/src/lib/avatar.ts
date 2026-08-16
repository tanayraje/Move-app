const AVATARS = Array.from(
  { length: 24 },
  (_, i) => `/avatars/move avatar (${i + 1}).svg`
);

export function getAvatarUrl(seed?: string, size = 128) {
  const match = seed?.match(/avatar-(\d+)/);
  const index = match
    ? Math.min(Math.max(Number(match[1]) - 1, 0), 23)
    : 0;

  return AVATARS[index];
}
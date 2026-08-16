export const AVATAR_BASE_URL =
  "https://api.dicebear.com/10.x/notionists-neutral/svg?backgroundColor=69d2e7&paperColor=&inkColor=083a54&eyebrowsVariant=variant01,variant02,variant03,variant04,variant05,variant07,variant08,variant09,variant10,variant11,variant12&mouthVariant=variant01,variant02,variant03,variant04,variant05,variant06,variant08,variant09,variant10,variant11,variant12,variant13,variant14,variant15,variant16,variant17,variant18,variant19,variant20,variant21,variant22,variant23,variant24,variant25,variant26,variant27,variant28,variant29,variant30";

export function getAvatarUrl(seed?: string, size = 128) {
  return `${AVATAR_BASE_URL}&seed=${encodeURIComponent(
    seed || "avatar-1"
  )}&size=${size}`;
}
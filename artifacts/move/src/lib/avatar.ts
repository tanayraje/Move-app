export const AVATAR_BASE_URL =
  "https://api.dicebear.com/10.x/notionists-neutral/svg?eyebrowsVariant=variant01,variant04,variant07,variant08,variant09,variant10,variant12&eyesVariant=variant01,variant03,variant05&mouthVariant=variant01,variant02,variant03,variant04,variant05,variant06,variant08,variant09,variant10,variant11,variant12,variant13,variant14,variant15,variant17,variant18,variant19,variant20,variant21,variant22,variant23,variant25,variant28,variant29,variant30&backgroundColor=b6e3f4&inkColor=083a54&paperColor=";

export function getAvatarUrl(seed?: string, size = 128) {
  return `${AVATAR_BASE_URL}&seed=${encodeURIComponent(
    seed || "avatar-1"
  )}&size=${size}`;
}
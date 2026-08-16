export const AVATAR_BASE_URL =
  "https://api.dicebear.com/10.x/lorelei-neutral/svg?backgroundColor=b6e3f4&eyebrowsColor=083a54&eyesColor=083a54&frecklesColor=083a54&glassesColor=083a54&mouthColor=083a54&noseColor=083a54&mouthVariant=happy01,happy02,happy03,happy04,happy05,happy06,happy07,happy08,happy09,happy10,happy11,happy12,happy13,happy14,happy15,happy16,happy17,happy18,sad01,sad02,sad03,sad04,sad05,sad06,sad08,sad09";

export function getAvatarUrl(seed?: string, size = 128) {
  return `${AVATAR_BASE_URL}&seed=${encodeURIComponent(
    seed || "avatar-1"
  )}&size=${size}`;
}
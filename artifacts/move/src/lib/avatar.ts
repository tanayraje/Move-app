import { Style, Avatar } from "@dicebear/core";
import definition from "@dicebear/styles/notionists-neutral.json";

const style = new Style(definition);

export function getAvatarUrl(seed = "avatar-1", size = 128) {
  const avatar = new Avatar(style, {
    eyebrowsVariant: [
      "variant01",
      "variant04",
      "variant07",
      "variant08",
      "variant09",
      "variant10",
      "variant12",
    ],

    eyesVariant: [
      "variant01",
      "variant03",
      "variant05",
    ],

    mouthVariant: [
      "variant01",
      "variant02",
      "variant03",
      "variant04",
      "variant05",
      "variant06",
      "variant08",
      "variant09",
      "variant10",
      "variant11",
      "variant12",
      "variant13",
      "variant14",
      "variant15",
      "variant17",
      "variant18",
      "variant19",
      "variant20",
      "variant21",
      "variant22",
      "variant23",
      "variant25",
      "variant28",
      "variant29",
      "variant30",
    ],

    backgroundColor: ["b6e3f4"],
    inkColor: ["083a54"],
    paperColor: [],
    seed: [seed],
  });

  const svg = avatar.toString();

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
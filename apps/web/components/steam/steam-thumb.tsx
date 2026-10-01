import Image from "next/image";

/** Steam header art is wide (about 460x215), so it is not forced into the square mobile icon. */
export function SteamThumb({ imageUrl, width }: { imageUrl: string | null; width: number }) {
  const height = Math.round(width * 0.467);
  if (!imageUrl) {
    return <span aria-hidden style={{ width, height }} className="shrink-0 rounded bg-surface-alt" />;
  }
  return <Image src={imageUrl} alt="" width={width} height={height} className="shrink-0 rounded bg-surface-alt object-cover" />;
}

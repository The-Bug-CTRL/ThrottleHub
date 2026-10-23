import Image from "next/image";
import { categoryIconPath } from "@/lib/category-icons";
export function CategoryIcon({
  category,
  size = 32,
  className = "",
}: {
  category: string;
  size?: number;
  className?: string;
}) {
  const src = categoryIconPath(category);
  if (!src) return null;
  return (
    <Image
      src={src}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      sizes={`${size}px`}
      className={`category-image ${className}`}
      style={{
        width: size,
        height: size,
        maxWidth: size,
        minWidth: size,
        objectFit: "contain",
        flexShrink: 0,
      }}
    />
  );
}

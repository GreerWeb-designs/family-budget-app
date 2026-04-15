import { cn } from "../../lib/utils";

export interface BrandMarkProps {
  /** Pixel size (both width and height). Defaults to 40. */
  size?: number;
  className?: string;
  alt?: string;
}

/**
 * The two-otter logo mark. Served from /nestotter-logo.svg (public/).
 */
export function BrandMark({ size = 40, className, alt = "NestOtter" }: BrandMarkProps) {
  return (
    <img
      src="/nestotter-logo.svg"
      width={size}
      height={size}
      alt={alt}
      draggable={false}
      className={cn("select-none", className)}
      style={{ width: size, height: size }}
    />
  );
}

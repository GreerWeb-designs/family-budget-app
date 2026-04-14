import logoUrl from "../../assets/nestotter-logo.svg";
import { cn } from "../../lib/utils";

export interface BrandMarkProps {
  /** Pixel size (both width and height). Defaults to 40. */
  size?: number;
  className?: string;
  alt?: string;
}

/**
 * The two-otter logo mark.
 * Replace src/assets/nestotter-logo.svg with the final artwork when ready —
 * this component will automatically pick it up.
 */
export function BrandMark({ size = 40, className, alt = "NestOtter" }: BrandMarkProps) {
  return (
    <img
      src={logoUrl}
      width={size}
      height={size}
      alt={alt}
      draggable={false}
      className={cn("select-none", className)}
      style={{ width: size, height: size }}
    />
  );
}

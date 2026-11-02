import { cn } from "@/lib/utils";

type BrandLogoProps = {
  name?: string;
  compact?: boolean;
  className?: string;
};

export function BrandLogo({
  name = "Smart Cake Shop",
  compact = false,
  className,
}: BrandLogoProps) {
  return (
    <span className={cn("brand-lockup", compact && "brand-lockup--compact", className)}>
      <img
        src="/assets/smart-cake-shop-mark.svg"
        alt=""
        aria-hidden="true"
        width={56}
        height={56}
        className="brand-lockup-mark"
      />
      <span className="brand-lockup-copy">
        <span className="brand-lockup-name">{name}</span>
        {!compact && <span className="brand-lockup-tagline">Cakes for every celebration</span>}
      </span>
    </span>
  );
}

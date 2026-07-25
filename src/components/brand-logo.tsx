import logo from "@/assets/travancore-ayurveda-logo-new.png";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  imgClassName?: string;
  /** Wrap in a light plaque for use on dark backgrounds. */
  onDark?: boolean;
  /** Org-uploaded logo (organizations.logo_url) — falls back to the platform mark when absent. */
  logoUrl?: string | null;
};

export function BrandLogo({ className, imgClassName, onDark = false, logoUrl }: BrandLogoProps) {
  const img = (
    <img
      src={logoUrl || logo}
      alt="Organization logo"
      className={cn("h-full w-auto object-contain", imgClassName)}
      loading="eager"
      decoding="async"
    />
  );
  if (onDark) {
    return (
      <div
        className={cn(
          "inline-flex items-center rounded-md bg-white px-2 py-1 shadow-sm",
          className,
        )}
      >
        {img}
      </div>
    );
  }
  return <div className={cn("inline-flex items-center", className)}>{img}</div>;
}

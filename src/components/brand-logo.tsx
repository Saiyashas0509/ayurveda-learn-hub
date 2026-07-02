import logo from "@/assets/travancore-ayurveda-logo.png.asset.json";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  imgClassName?: string;
  /** Wrap in a light plaque for use on dark backgrounds. */
  onDark?: boolean;
};

export function BrandLogo({ className, imgClassName, onDark = false }: BrandLogoProps) {
  const img = (
    <img
      src={logo.url}
      alt="Travancore Ayurveda"
      className={cn("h-full w-auto object-contain", imgClassName)}
      loading="eager"
      decoding="async"
    />
  );
  if (onDark) {
    return (
      <div className={cn("inline-flex items-center rounded-md bg-white px-2 py-1 shadow-sm", className)}>
        {img}
      </div>
    );
  }
  return <div className={cn("inline-flex items-center", className)}>{img}</div>;
}
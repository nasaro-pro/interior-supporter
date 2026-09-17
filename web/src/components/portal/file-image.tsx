import Image from "next/image";

export function FileImage({
  objectId,
  alt,
  variant = "thumb",
  className,
}: {
  objectId: string;
  alt: string;
  variant?: "thumb" | "full";
  className?: string;
}) {
  const size = variant === "full" ? 1200 : 400;
  return (
    <Image
      src={`/api/files/${objectId}?v=${variant}`}
      alt={alt}
      width={size}
      height={Math.round(size * 0.75)}
      className={className}
      sizes="100vw"
      unoptimized
    />
  );
}

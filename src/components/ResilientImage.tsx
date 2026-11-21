import { useState } from 'react';
import { UtensilsCrossed } from 'lucide-react';

interface ResilientImageProps {
  src?: string;
  alt: string;
  className?: string;
  fallbackLabel?: string;
}

export function ResilientImage({
  src,
  alt,
  className = '',
  fallbackLabel,
}: ResilientImageProps) {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#F4EBDD] to-[#E6D5BE] text-[#7A5B43] ${className}`}
        role="img"
        aria-label={alt}
      >
        <UtensilsCrossed className="h-6 w-6 opacity-70" />
        {fallbackLabel && (
          <span className="mt-1.5 px-2 text-center text-xs font-medium text-[#5A4230] line-clamp-1">
            {fallbackLabel}
          </span>
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
      className={className}
      loading="lazy"
    />
  );
}

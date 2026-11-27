"use client";

import { useState } from "react";

export interface BrandMarkProps {
  title: string;
  logo?: string | null;
}

export function BrandMark({ title, logo }: BrandMarkProps) {
  const [failedLogo, setFailedLogo] = useState<string | null>(null);
  const trimmedLogo = logo?.trim() || null;
  const showImage = Boolean(trimmedLogo && failedLogo !== trimmedLogo);

  return (
    <span className="brand-stamp" aria-hidden="true">
      {showImage && trimmedLogo ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={trimmedLogo}
            alt=""
            className="brand-stamp-img"
            onError={() => setFailedLogo(trimmedLogo)}
          />
        </>
      ) : (
        title.trim().charAt(0).toUpperCase() || "P"
      )}
    </span>
  );
}

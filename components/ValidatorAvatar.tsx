"use client";

import { useState } from "react";

export function ValidatorAvatar({
    name,
    imageUrl,
}: {
    name: string;
    imageUrl?: string | null;
}) {
    const [failedUrl, setFailedUrl] = useState<string | null>(null);
    return (
        <span className="validator-avatar">
            {imageUrl && failedUrl !== imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={imageUrl}
                    alt=""
                    width={32}
                    height={32}
                    loading="lazy"
                    onError={() => setFailedUrl(imageUrl)}
                />
            ) : (
                name.slice(0, 1).toUpperCase()
            )}
        </span>
    );
}

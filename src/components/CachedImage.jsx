import React, { useEffect, useState } from 'react';
import { resolveImageSrc, getResolvedFromMemory } from '../utils/imageCache';

/**
 * Drop-in replacement for <img> for remote covers/artwork/icons.
 * Transparently caches the image to disk (native) or CacheStorage (web) the
 * first time it's viewed, so it keeps rendering when the app is later
 * opened offline. Falls back to a simple placeholder if nothing is cached
 * and there's no network to fetch from.
 */
export default function CachedImage({
  src,
  alt = '',
  className,
  style,
  placeholder = null,
  showPlaceholderIcon = true,
  onClick,
  ...rest
}) {
  // Seed synchronously from the in-memory cache so remounting with a src we
  // already resolved before (e.g. navigating back to a page) paints the real
  // image on the very first render instead of flashing the placeholder and
  // "reloading" it.
  const [resolvedSrc, setResolvedSrc] = useState(() => getResolvedFromMemory(src));
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setBroken(false);

    if (!src) {
      setResolvedSrc(null);
      return undefined;
    }

    // Already known — keep showing it immediately; only clear to the
    // placeholder if we truly have nothing for this src yet.
    setResolvedSrc(getResolvedFromMemory(src));

    resolveImageSrc(src).then((result) => {
      if (!cancelled) setResolvedSrc(result);
    });

    return () => {
      cancelled = true;
    };
  }, [src]);

  const showFallback = !src || !resolvedSrc || broken;

  if (showFallback) {
    if (placeholder) {
      return (
        <img
          src={placeholder}
          alt={alt}
          className={className}
          style={style}
          onClick={onClick}
          {...rest}
        />
      );
    }
    if (!showPlaceholderIcon) return null;
    return (
      <div
        className={className}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(255,255,255,0.06)',
          color: 'rgba(255,255,255,0.25)',
          ...style,
        }}
        onClick={onClick}
        aria-label={alt}
      >
        <i className="fa-solid fa-music" style={{ fontSize: '0.9em' }} />
      </div>
    );
  }

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      className={className}
      style={style}
      onClick={onClick}
      onError={() => setBroken(true)}
      {...rest}
    />
  );
}
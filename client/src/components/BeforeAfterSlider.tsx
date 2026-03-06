import { useState, useCallback } from "react";

interface BeforeAfterSliderProps {
  beforeSrc: string;
  afterSrc: string;
  beforeAlt: string;
  afterAlt: string;
  beforePosition?: string;
  afterPosition?: string;
}

export function BeforeAfterSlider({ beforeSrc, afterSrc, beforeAlt, afterAlt, beforePosition = "center center", afterPosition = "center center" }: BeforeAfterSliderProps) {
  const [showAfter, setShowAfter] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  const handleTouchStart = useCallback(() => {
    setIsTouchDevice(true);
    setShowAfter(prev => !prev);
  }, []);

  const handleMouseEnter = useCallback(() => {
    if (!isTouchDevice) setShowAfter(true);
  }, [isTouchDevice]);

  const handleMouseLeave = useCallback(() => {
    if (!isTouchDevice) setShowAfter(false);
  }, [isTouchDevice]);

  const handleClick = useCallback(() => {
    if (isTouchDevice) setShowAfter(prev => !prev);
  }, [isTouchDevice]);

  return (
    <div
      className="relative w-full rounded-xl overflow-hidden select-none cursor-pointer"
      style={{ aspectRatio: "3 / 4" }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onClick={handleClick}
    >
      {/* Before image (base layer) */}
      <img
        src={beforeSrc}
        alt={beforeAlt}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ objectPosition: beforePosition }}
        draggable={false}
      />

      {/* After image (overlay, crossfades in) */}
      <img
        src={afterSrc}
        alt={afterAlt}
        className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ease-in-out"
        style={{ objectPosition: afterPosition, opacity: showAfter ? 1 : 0 }}
        draggable={false}
      />

      {/* Label */}
      <span
        className={`absolute top-3 left-3 text-white text-xs font-semibold px-2.5 py-1 rounded-full z-10 transition-all duration-300 ${showAfter ? "bg-primary/90" : "bg-black/60"}`}
      >
        {showAfter ? "After" : "Before"}
      </span>
    </div>
  );
}

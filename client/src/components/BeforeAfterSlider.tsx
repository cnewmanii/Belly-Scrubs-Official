import { useState, useCallback, useRef } from "react";

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
  const [isTouch, setIsTouch] = useState(false);
  const isTouchRef = useRef(false);

  const handleTouchStart = useCallback(() => {
    // Only set the flag — do NOT toggle here. onClick will handle it.
    if (!isTouchRef.current) {
      isTouchRef.current = true;
      setIsTouch(true);
    }
  }, []);

  const handleMouseEnter = useCallback(() => {
    if (!isTouchRef.current) setShowAfter(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (!isTouchRef.current) setShowAfter(false);
  }, []);

  const handleClick = useCallback(() => {
    // On touch devices, toggle on tap. On desktop, mouse handlers cover it.
    if (isTouchRef.current) setShowAfter(prev => !prev);
  }, []);

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

      {/* Hint */}
      <span className="absolute bottom-3 left-1/2 -translate-x-1/2 text-white/70 text-xs z-10 pointer-events-none">
        {showAfter ? "Tap to go back" : (isTouch ? "Tap to reveal" : "Hover to reveal")}
      </span>
    </div>
  );
}

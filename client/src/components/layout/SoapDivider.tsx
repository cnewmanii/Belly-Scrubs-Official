interface SoapDividerProps {
  flip?: boolean;
  className?: string;
  fillClass?: string;
}

export function SoapDivider({ flip = false, className = "", fillClass = "text-background" }: SoapDividerProps) {
  return (
    <div className={`w-full leading-[0] ${flip ? "rotate-180" : ""} ${className}`} aria-hidden="true">
      <svg
        viewBox="0 0 1440 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`w-full h-auto ${fillClass}`}
        preserveAspectRatio="none"
      >
        <path
          d="M0,40 C120,80 240,10 360,50 C480,90 600,20 720,45 C840,70 960,15 1080,55 C1200,85 1320,30 1440,40 L1440,100 L0,100 Z"
          fill="currentColor"
        />
        <circle cx="180" cy="35" r="6" fill="currentColor" opacity="0.4" />
        <circle cx="520" cy="22" r="9" fill="currentColor" opacity="0.25" />
        <circle cx="900" cy="30" r="5" fill="currentColor" opacity="0.35" />
        <circle cx="1200" cy="25" r="7" fill="currentColor" opacity="0.3" />
        <circle cx="350" cy="45" r="4" fill="currentColor" opacity="0.2" />
        <circle cx="750" cy="18" r="3" fill="currentColor" opacity="0.3" />
        <circle cx="1100" cy="42" r="5" fill="currentColor" opacity="0.2" />
      </svg>
    </div>
  );
}

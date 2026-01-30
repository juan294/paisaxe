import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  /**
   * Primary color for the outer mountain stroke.
   * Defaults to currentColor to inherit from parent.
   */
  primaryColor?: string;
  /**
   * Secondary color for the inner mountain stroke.
   * Defaults to a lighter shade of primary.
   */
  secondaryColor?: string;
}

/**
 * Paisaxe logo - stylized mountain peaks.
 * Renders without background, adapts to container colors.
 */
export function Logo({
  className,
  primaryColor = "currentColor",
  secondaryColor,
}: LogoProps) {
  // Default secondary to primary with 60% opacity if not specified
  const secondary = secondaryColor || primaryColor;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      fill="none"
      className={cn("h-full w-full", className)}
      aria-label="Paisaxe logo"
    >
      {/* Outer mountain */}
      <path
        d="M128 384L256 128L384 384"
        stroke={primaryColor}
        strokeWidth="48"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Inner mountain (lighter) */}
      <path
        d="M176 320L256 176L336 320"
        stroke={secondary}
        strokeWidth="32"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity={secondaryColor ? 1 : 0.5}
      />
      {/* Peak dot */}
      <circle cx="256" cy="112" r="24" fill={primaryColor} />
    </svg>
  );
}

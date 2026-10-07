import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/** The focus ring every dark-surface variant shares: visible on bg-neutral-950 and over photos. */
const DARK_FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        glass: `rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white transition-all motion-reduce:transition-none ${DARK_FOCUS_RING}`,
        glassIcon: `p-3 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white transition-all motion-reduce:transition-none ${DARK_FOCUS_RING}`,
        // Dark-surface calls to action (docs/plans/2026-10-07-booking-ui-polish.md, D1/D6).
        brand: `bg-gradient-to-r from-paisaxe-green-500 to-paisaxe-green-400 text-black font-semibold hover:from-paisaxe-green-400 hover:to-paisaxe-green-300 ${DARK_FOCUS_RING}`,
        paypal: `bg-[#FFC439] text-[#111111] font-semibold hover:bg-[#F2BA36] ${DARK_FOCUS_RING}`,
        glassDestructive: `border border-red-400/40 bg-red-500/10 text-red-200 hover:bg-red-500/20 ${DARK_FOCUS_RING}`,
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };

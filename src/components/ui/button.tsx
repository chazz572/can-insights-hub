import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm text-sm font-semibold uppercase tracking-wider ring-offset-background transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:translate-y-px",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-[inset_0_-2px_0_hsl(0_0%_0%/0.4),0_2px_0_hsl(0_0%_0%/0.3)] hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground shadow-[inset_0_-2px_0_hsl(0_0%_0%/0.4),0_2px_0_hsl(0_0%_0%/0.3)] hover:bg-destructive/90",
        outline: "border-2 border-glass-border bg-secondary text-foreground hover:border-primary hover:text-primary",
        secondary: "bg-secondary text-secondary-foreground border border-glass-border hover:border-primary/50 hover:bg-muted",
        ghost: "hover:bg-secondary hover:text-secondary-foreground",
        link: "text-primary underline-offset-4 hover:underline normal-case tracking-normal",
        analyzer: "bg-primary text-primary-foreground shadow-[inset_0_-3px_0_hsl(0_0%_0%/0.5),0_2px_0_hsl(0_0%_0%/0.3)] hover:bg-primary/90 border-2 border-primary/80",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-sm px-3 text-xs",
        lg: "h-12 rounded-sm px-7",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };

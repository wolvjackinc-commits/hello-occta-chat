import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-display uppercase tracking-wider transition-all duration-150 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-5 [&_svg]:shrink-0 border-4 border-foreground",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-brutal hover:-translate-y-0.5 hover:-translate-x-0.5 hover:shadow-brutal-lg active:translate-y-1 active:translate-x-1 active:shadow-none",
        destructive:
          "bg-destructive text-destructive-foreground shadow-brutal hover:-translate-y-0.5 hover:-translate-x-0.5 hover:shadow-brutal-lg active:translate-y-1 active:translate-x-1 active:shadow-none",
        outline:
          "bg-background text-foreground shadow-brutal hover:bg-secondary hover:-translate-y-0.5 hover:-translate-x-0.5 hover:shadow-brutal-lg active:translate-y-1 active:translate-x-1 active:shadow-none",
        secondary:
          "bg-secondary text-secondary-foreground shadow-brutal hover:-translate-y-0.5 hover:-translate-x-0.5 hover:shadow-brutal-lg active:translate-y-1 active:translate-x-1 active:shadow-none",
        ghost: 
          "border-transparent hover:bg-secondary hover:border-foreground",
        link: 
          "text-foreground underline-offset-4 underline border-transparent hover:text-accent",
        hero:
          "bg-primary text-primary-foreground shadow-brutal-lg text-lg hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[14px_14px_0_0_hsl(var(--foreground))] active:translate-y-1 active:translate-x-1 active:shadow-none",
        accent:
          "bg-accent text-accent-foreground shadow-brutal hover:-translate-y-0.5 hover:-translate-x-0.5 hover:shadow-brutal-lg active:translate-y-1 active:translate-x-1 active:shadow-none",
        navy:
          "bg-navy text-navy-foreground border-navy shadow-brutal-primary hover:-translate-y-0.5 hover:-translate-x-0.5 hover:shadow-[10px_10px_0_0_hsl(var(--primary))] active:translate-y-1 active:translate-x-1 active:shadow-none",
      },
      size: {
        default: "h-12 px-6 py-3 text-sm",
        sm: "h-10 px-4 text-xs",
        lg: "h-14 px-8 text-base",
        xl: "h-16 px-10 text-lg",
        icon: "h-12 w-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }

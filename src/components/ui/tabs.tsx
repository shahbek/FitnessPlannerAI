import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { useId } from "react"
import "./tabs.css"

const cn = (...classes: (string | undefined | null | false)[]) =>
  classes.filter(Boolean).join(' ')

const Tabs = TabsPrimitive.Root

interface TabsListProps extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> {
  variant?: 'default' | 'glass'
}

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  TabsListProps
>(({ className, children, variant = 'default', ...props }, ref) => {
  // Glass variant state - only initialize if needed
  const listRef = React.useRef<HTMLElement | null>(null)
  const fieldsetRef = React.useRef<HTMLFieldSetElement | null>(null)
  const [activeOption, setActiveOption] = React.useState<number>(1)
  const [previousOption, setPreviousOption] = React.useState<number | null>(null)
  const [indicatorLeft, setIndicatorLeft] = React.useState<number>(0)
  const [indicatorTop, setIndicatorTop] = React.useState<number>(8)
  const [indicatorWidth, setIndicatorWidth] = React.useState<number>(84)
  const [indicatorHeight, setIndicatorHeight] = React.useState<number>(54)
  const uniqueId = useId().replace(/:/g, '-')
  const filterId = `switcher-${uniqueId}`

  // Calculate indicator position based on active tab (only for glass variant)
  const updateIndicatorPosition = React.useCallback(() => {
    if (variant !== 'glass' || !fieldsetRef.current) return

    // Find the active trigger and its parent label
    const activeTrigger = fieldsetRef.current.querySelector('[data-state="active"]')
    const activeLabel = activeTrigger?.closest('.switcher__option') as HTMLElement

    if (activeLabel && fieldsetRef.current) {
      const fieldsetRect = fieldsetRef.current.getBoundingClientRect()
      const labelRect = activeLabel.getBoundingClientRect()
      const left = labelRect.left - fieldsetRect.left
      const top = labelRect.top - fieldsetRect.top
      const width = labelRect.width
      const height = labelRect.height

      setIndicatorLeft(left)
      setIndicatorTop(top)
      setIndicatorWidth(width)
      setIndicatorHeight(height)
    }
  }, [variant])

  // Watch for active tab changes (only for glass variant)
  React.useEffect(() => {
    if (variant !== 'glass' || !fieldsetRef.current) return

    const updateActiveOption = () => {
      // Always update indicator position first
      updateIndicatorPosition()

      const activeTab = fieldsetRef.current?.querySelector('[data-state="active"]')
      if (activeTab) {
        // Find which option/label contains the active trigger
        const allOptions = fieldsetRef.current?.querySelectorAll('.switcher__option')
        allOptions?.forEach((option, index) => {
          const trigger = option.querySelector('[data-state="active"]')
          if (trigger) {
            const newOption = index + 1
            if (newOption !== activeOption) {
              setPreviousOption(activeOption)
              setActiveOption(newOption)
            }
          }
        })
      }
    }

    // Initial check
    setTimeout(updateActiveOption, 0)

    // Watch for changes
    const observer = new MutationObserver(updateActiveOption)

    if (fieldsetRef.current) {
      // Observe the fieldset container
      observer.observe(fieldsetRef.current, {
        attributes: true,
        attributeFilter: ['data-state'],
        childList: true,
        subtree: true
      })

      // Observe all triggers
      const triggers = fieldsetRef.current.querySelectorAll('[data-state]')
      triggers.forEach(trigger => {
        observer.observe(trigger, {
          attributes: true,
          attributeFilter: ['data-state']
        })
      })
    }

    return () => observer.disconnect()
  }, [variant, activeOption, updateIndicatorPosition])

  // Also update position on resize (only for glass variant)
  React.useEffect(() => {
    if (variant !== 'glass') return

    const handleResize = () => {
      updateIndicatorPosition()
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [variant, updateIndicatorPosition])

  // Simple default variant - return standard Radix UI tabs
  if (variant === 'default') {
    return (
      <TabsPrimitive.List
        ref={ref}
        className={cn(
          "inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground",
          className
        )}
        {...props}
      >
        {children}
      </TabsPrimitive.List>
    )
  }

  // Glass variant - return liquid glass design
  return (
    <>
      {/* SVG Filter with Displacement Map for Liquid Glass Effect */}
      <svg
        width="0"
        height="0"
        style={{
          position: 'fixed',
          top: '0px',
          left: '0px',
          pointerEvents: 'none',
          zIndex: -1
        }}
        aria-hidden="true"
      >
        <defs>
          {/* Displacement Map - Creates the refraction effect at borders */}
          {/* Using a data URI approach to embed the displacement map */}
          <filter
            id={filterId}
            filterUnits="objectBoundingBox"
            primitiveUnits="objectBoundingBox"
            colorInterpolationFilters="sRGB"
            x="0%"
            y="0%"
            width="100%"
            height="100%"
          >
            {/* Create border-focused displacement map - strong at edges, neutral in center */}
            <feImage
              href={`data:image/svg+xml,${encodeURIComponent(`
                <svg width="400" height="100" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <!-- Radial mask to keep center neutral - creates edge-only displacement -->
                    <radialGradient id="center-mask" cx="50%" cy="50%">
                      <stop offset="0%" stop-color="#808080" />
                      <stop offset="60%" stop-color="#808080" />
                      <stop offset="100%" stop-color="#000000" />
                    </radialGradient>
                    
                    <!-- Edge gradients - only affect borders -->
                    <linearGradient id="edge-top" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stop-color="#000000" />
                      <stop offset="8%" stop-color="#808080" />
                      <stop offset="100%" stop-color="#808080" />
                    </linearGradient>
                    <linearGradient id="edge-bottom" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stop-color="#808080" />
                      <stop offset="92%" stop-color="#808080" />
                      <stop offset="100%" stop-color="#000000" />
                    </linearGradient>
                    <linearGradient id="edge-left" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stop-color="#000000" />
                      <stop offset="8%" stop-color="#808080" />
                      <stop offset="100%" stop-color="#808080" />
                    </linearGradient>
                    <linearGradient id="edge-right" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stop-color="#808080" />
                      <stop offset="92%" stop-color="#808080" />
                      <stop offset="100%" stop-color="#000000" />
                    </linearGradient>
                  </defs>
                  <!-- Base: completely neutral center -->
                  <rect width="400" height="100" fill="#808080" rx="50" />
                  <!-- Radial mask ensures center stays neutral -->
                  <rect width="400" height="100" fill="url(#center-mask)" rx="50" />
                  <!-- Edge gradients for border refraction -->
                  <rect width="400" height="100" fill="url(#edge-top)" rx="50" />
                  <rect width="400" height="100" fill="url(#edge-bottom)" rx="50" />
                  <rect width="400" height="100" fill="url(#edge-left)" rx="50" style="mix-blend-mode: multiply" />
                  <rect width="400" height="100" fill="url(#edge-right)" rx="50" style="mix-blend-mode: multiply" />
                  <!-- Soften edges -->
                  <rect width="400" height="100" fill="#808080" rx="50" style="filter: blur(2px); opacity: 0.3" />
                </svg>
              `)}`}
              preserveAspectRatio="none"
              result="borderMap"
            />

            {/* Subtle turbulence only at edges - multiply with border map */}
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.015 0.03"
              numOctaves="2"
              seed="5"
              result="turbulence"
            />
            <feGaussianBlur in="turbulence" stdDeviation="1.5" result="noise" />

            {/* Combine: border map (edge-focused) with subtle noise */}
            <feComposite in="noise" in2="borderMap" operator="multiply" result="combinedMap" />
            <feGaussianBlur in="combinedMap" stdDeviation="0.8" result="displacementMap" />

            {/* Apply displacement - reduced scale, only at edges */}
            <feDisplacementMap
              in="SourceGraphic"
              in2="displacementMap"
              scale="8"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>

      <fieldset
        ref={(node) => {
          fieldsetRef.current = node
          if (node) {
            (listRef as React.MutableRefObject<HTMLElement | null>).current = node
            // Initial position calculation
            setTimeout(updateIndicatorPosition, 0)
          }
          if (typeof ref === 'function') {
            ref(node as any)
          } else if (ref) {
            (ref as React.MutableRefObject<any>).current = node
          }
        }}
        className={cn("switcher", className)}
        data-previous={previousOption || undefined}
        style={{
          backdropFilter: `url("#${filterId}") blur(1px) saturate(var(--saturation, 120%)) brightness(1)`,
          WebkitBackdropFilter: `url("#${filterId}") blur(1px) saturate(var(--saturation, 120%)) brightness(1)`,
          '--liquid-filter': `url("#${filterId}")`,
          '--indicator-left': `${indicatorLeft}px`,
          '--indicator-top': `${indicatorTop}px`,
          '--indicator-width': `${indicatorWidth}px`,
          '--indicator-height': `${indicatorHeight}px`,
        } as React.CSSProperties & {
          '--indicator-left': string;
          '--indicator-top': string;
          '--indicator-width': string;
          '--indicator-height': string;
          '--liquid-filter': string;
        }}
      >
        <TabsPrimitive.List
          ref={undefined}
          className="switcher__inner"
          style={{ display: 'contents' }}
          {...props}
        >
          {React.Children.map(children, (child, index) => {
            if (!React.isValidElement(child)) return child

            const option = index + 1
            const isChecked = activeOption === option

            // Clone the child and add our custom props
            return React.cloneElement(child as React.ReactElement<any>, {
              'data-c-option': option,
              'data-checked': isChecked ? 'true' : 'false',
              'data-glass-variant': 'true',
            } as any)
          })}
        </TabsPrimitive.List>
      </fieldset>
    </>
  )
})
TabsList.displayName = "TabsList"

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, children, ...props }, ref) => {
  const dataChecked = (props as any)['data-checked'] === 'true'
  const isGlassVariant = (props as any)['data-glass-variant'] === 'true'

  // Glass variant - use label wrapper
  if (isGlassVariant) {
    return (
      <label className="switcher__option">
        <input
          className="switcher__input"
          type="radio"
          readOnly
          checked={dataChecked}
        />
        <TabsPrimitive.Trigger
          ref={ref}
          className={cn("switcher__icon", className)}
          {...props}
        >
          {children}
        </TabsPrimitive.Trigger>
      </label>
    )
  }

  // Default variant - standard trigger
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
        className
      )}
      {...props}
    >
      {children}
    </TabsPrimitive.Trigger>
  )
})
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn("mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", className)}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }

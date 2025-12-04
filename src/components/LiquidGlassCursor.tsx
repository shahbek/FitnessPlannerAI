import React, { useEffect, useRef, useId } from 'react';

export function LiquidGlassCursor() {
  const cursorRef = useRef<HTMLDivElement>(null);
  const uniqueId = useId().replace(/:/g, '-');
  const filterId = `liquid-glass-${uniqueId}_filter`;
  const mapId = `liquid-glass-${uniqueId}_map`;

  useEffect(() => {
    // Check if device is touch-enabled or small screen
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const isSmallScreen = window.innerWidth < 768;

    if (isTouchDevice || isSmallScreen) {
      return;
    }

    // Hide default cursor
    document.body.style.cursor = 'none';

    const handleMouseMove = (e: MouseEvent) => {
      if (cursorRef.current) {
        cursorRef.current.style.left = `${e.clientX}px`;
        cursorRef.current.style.top = `${e.clientY}px`;
      }
    };

    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      document.body.style.cursor = '';
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  // Return null if touch device or small screen (checked in render to avoid hydration mismatch, 
  // but for simplicity we'll use CSS media query or just rely on the effect for cursor hiding, 
  // and hide the custom cursor element via CSS or state)
  // Better approach: use state to control visibility
  const [isVisible, setIsVisible] = React.useState(false);

  useEffect(() => {
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const isSmallScreen = window.innerWidth < 768;
    setIsVisible(!isTouchDevice && !isSmallScreen);
  }, []);

  if (!isVisible) return null;

  // Base64 encoded PNG displacement map (from the provided code)
  const displacementMapData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAeCAYAAABNChwpAAAFZElEQVR4AbSXzXIbRRDHW6ONhIwFKI6D4yS8Bu/AI/AAnLlx4UAVF26ceQDOnKjizIkbN74JhMQfsWzLyTpWJK+0/H5bXkX+iMqkhGpHs7PT3f+e3tnpf6eyjHJRe8j8D7RvaV8fRfnVgyi//DHKL76P8vPvovzsmyg/pf+E8cc8/4j5D5H7APn3ae/RYkFLseD3iLld2kE/4uiXiOOfI4a/R4z/ipgwWW4z+SSiQd9k3OJ5h/lV5N5Bfg29jYi4T3vV9UoHHqOxsxfR/yli8FtE/gDwfyJGOxEFzycHEeURQs8iGvRNxhnP28x3kOsi30NvHf07PL8XV/+udGBrELH9K+B/AP434HgzZKUjQArAJjngJ7QhRkcRDfoG4ybPM+bbyHWQ76LXQ38dO5vYu4vduPA77wCGdlHYRqH/EHBCe4z3w0NW/jTi9DhiAlAJaDnGUkGb0OgbjBs8bzJ/A7k28h30VtHvYWcde5vY3cB+gINWdb10AMGDP1k5gn0UBoxzDJwQ4tHziOJFxBSQKWCloFP0S5qXPeMGzxPzCbkM+TZ6K+h3sdPD3jp2N7G/Bk4wVjVV3rB5cjzb2orYI3QDQpizgiErGeNtwoompzgAQADErlb3cjtzJCHXRD5Dr4V+Bztd7PWwexv7d8HpghfgJv8mvKvHuxFP9iMOeYd5zoYjlGMMFBiaYrBcANy46AqONJDXkQz9FnY62Oti9yb23wXnHnhNcFMQlkeEY48Ncki4csJ2QvjGKBaEc4ohzomLEJfGOmGbn2jgSEI/w04LeyvY7WL/Jji3wbsPbtonLLt4dYB3OV4O8XaMQsGqrwt+DnR+wP3MCey1sNvBfhecNfA2wE07vJsDvHqGdydsnhFCM3AMvM5lJGy1rvdVJHCijf0VcN4Cbw3ctI83Txk85+EIgYKQTQkdV63/2r3AtbL3CaMZ9tvgvAne2+CmASE5xivBT5lcFvg88Py9TtwARydWwU2Cv8CjMd4Jzlwtv7Te1dfGPHh0ogXeG+CmE/7GoE54QFfL/a+9TjTBawGYRtwQiYXnyzK8mY+C9zqRYTi18SLDCcPiJxPczxoCy7qqs+TMtve+7oJxWuEVGApDolfLAlxkhzWHr9xXn9yJbgY3hVE45wQeLjJ03TlXXMsK7urd9G7+1OMz1Ak/Cz8PnfAd1QrV65gN/vvNPLjrEdzP3c/eLzDd4iDyQPBg0AkPimU5cRW4B53gHnwegOkOR7FHokejR6RHZca+8Oi8FAmXcI0gCGyrRVUzr3jEe9R75Hv0mwLSLZKRScHkYJIwWZg0Zk6oXVuyvzj22VybB/ax4xrcJGeyM+mZ/EyCVTo2LZoeTZOmS9Om6dM0WkXiIqhjmwhnTSDb2bDqHFfgHDSmd9O86d60b/qXBlSERGIgQZAoSBgkDhIIiYSEQmIhwbi0IXWCJlCFWP/5jO0ukZHQSGyG7DWJjoRH4iMBkgjNKJkUSaokZZI6SaGkUlIqqZUUS0cWHpkAOy+wFE4qJ6WT2knxpHpSPqlfPqNktdewE8mipFHyKImUTEoqJZeSTEomJZUyT4FmETkDlqxKWiWvkljJrKRWcivJluxuQ0olvy9Jae2APQRyA8+kz9Jo6bS0WnotzZZuS7ul39Lw4N0GX4y9NF26Lm2Xvo/4uqTz0voBtE+aL93fxX5FhMWjnTv4GFeXBYQFhgWGBYYHRgc229aLyaBRFiAWJBUkwaFU4njJO7ZgKZgfITdEPod0DgDsUw9YsFjwVABzf1c64LyllCXVOmVVjxKrS6llyWXpZQlmKdYALCCYJb2lmiWbpduQ0ixHfoBeH31LPAq73P4FAAA//+QgTVjAAAABklEQVQDAL55Hq+Cx4C+AAAAAElFTkSuQmCC';

  return (
    <>
      <svg
        width="0"
        height="0"
        style={{
          position: 'fixed',
          top: '0px',
          left: '0px',
          pointerEvents: 'none',
          zIndex: 9998
        }}
      >
        <defs>
          <filter
            id={filterId}
            filterUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
            x="0"
            y="0"
            width="32"
            height="30"
          >
            <feImage
              id={mapId}
              width="32"
              height="30"
              href={displacementMapData}
              result="map"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="map"
              xChannelSelector="R"
              yChannelSelector="G"
              scale="11.895843082007534"
            />
          </filter>
        </defs>
      </svg>

      <div
        ref={cursorRef}
        style={{
          display: 'flex',
          position: 'fixed',
          width: '32px',
          height: '30px',
          overflow: 'hidden',
          borderRadius: '15px',
          boxShadow: 'rgba(0, 0, 0, 0.25) 0px 4px 8px, rgba(0, 0, 0, 0.15) 0px -10px 25px inset, rgba(255, 255, 255, 0.74) 0px -1px 4px 1px inset',
          cursor: 'grab',
          backdropFilter: `url("#${filterId}") blur(0.8px) brightness(1.1) saturate(1.2)`,
          zIndex: 9999,
          pointerEvents: 'none',
          left: '0px',
          top: '0px',
          transform: 'translate(-50%, -50%)',
        }}
      />
    </>
  );
}


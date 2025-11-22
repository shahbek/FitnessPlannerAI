import React from 'react';

interface TimelineEvent {
  time: string;
  type: 'meal' | 'workout' | 'cardio' | 'rest';
  emoji: string;
  label: string;
  details?: string;
}

interface DailyTimelineProps {
  events: TimelineEvent[];
}

/**
 * DailyTimeline - Skeumorphic horizontal timeline
 * Events are positioned relative to the first and last event
 * First event is at 0%, last event is at 100%
 */
export function DailyTimeline({ events }: DailyTimelineProps) {
  // Convert time string (e.g., "7:30 AM") to minutes since midnight
  const parseTimeToMinutes = (timeStr: string): number => {
    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return 0;

    let hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const period = match[3].toUpperCase();

    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;

    return hours * 60 + minutes;
  };

  if (events.length === 0) return null;

  // Find start and end times for the range
  const eventMinutes = events.map(e => ({
    ...e,
    minutes: parseTimeToMinutes(e.time)
  }));

  const minMinutes = Math.min(...eventMinutes.map(e => e.minutes));
  const maxMinutes = Math.max(...eventMinutes.map(e => e.minutes));
  const range = maxMinutes - minMinutes;

  // Calculate position percentage for an event
  const calculatePosition = (minutes: number): number => {
    if (range === 0) return 50; // Single event centered
    return ((minutes - minMinutes) / range) * 100;
  };

  // Group events by exact time for z-index layering
  const eventsByTime = eventMinutes.reduce((acc, event) => {
    if (!acc[event.minutes]) acc[event.minutes] = [];
    acc[event.minutes].push(event);
    return acc;
  }, {} as Record<number, typeof eventMinutes>);

  return (
    <div className="w-full py-8 px-4">
      <div className="relative w-full h-16 flex items-center">
        {/* Main Timeline Groove - Deep Recessed Look */}
        <div
          className="absolute left-0 right-0 h-4 rounded-full bg-gray-200/50 shadow-[inset_0_2px_6px_rgba(0,0,0,0.15),inset_0_1px_2px_rgba(0,0,0,0.2),0_1px_0_rgba(255,255,255,0.8)] border-b border-white/80"
          style={{ zIndex: 1 }}
        >
          {/* Inner highlight for metallic/glass depth */}
          <div className="absolute inset-x-0 top-0 h-px bg-black/10"></div>
          <div className="absolute inset-x-0 bottom-0 h-px bg-white/80"></div>
        </div>

        {/* Events */}
        {Object.entries(eventsByTime).map(([timeInMinutes, eventsAtTime]) => {
          const position = calculatePosition(parseInt(timeInMinutes));

          return (
            <div
              key={timeInMinutes}
              className="absolute top-1/2 -translate-y-1/2"
              style={{
                left: `${position}%`,
                zIndex: 10
              }}
            >
              {/* Events at the same time stack */}
              {eventsAtTime.map((event, idx) => (
                <div
                  key={idx}
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group cursor-pointer"
                  style={{
                    zIndex: 10 + idx,
                    marginTop: idx * -4 // More overlap for stacked items
                  }}
                >
                  {/* Event Emoji Marker with Advanced Shadow/Float */}
                  <div className="relative transition-all duration-300 hover:scale-125 hover:-translate-y-2">
                    {/* The Emoji Itself - Floating */}
                    <div className="text-3xl filter drop-shadow-[0_4px_6px_rgba(0,0,0,0.3)] relative z-10">
                      {event.emoji}
                    </div>

                    {/* Reflection/Ground shadow - Dynamic */}
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-6 h-1.5 bg-black/20 blur-md rounded-full transition-all duration-300 group-hover:w-8 group-hover:bg-black/10 group-hover:blur-lg"></div>
                  </div>

                  {/* Tooltip on Hover - Glassmorphic */}
                  <div className="absolute bottom-full mb-4 hidden group-hover:block z-50">
                    <div className="bg-gray-900/80 backdrop-blur-md text-white text-xs rounded-xl px-4 py-2.5 shadow-[0_8px_16px_rgba(0,0,0,0.2)] whitespace-nowrap border border-white/10">
                      <div className="font-bold text-orange-300 mb-0.5 text-sm">{event.time}</div>
                      <div className="font-medium text-sm">{event.label}</div>
                      {event.details && <div className="text-gray-300 mt-0.5 text-xs">{event.details}</div>}
                      {/* Arrow */}
                      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900/80"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}


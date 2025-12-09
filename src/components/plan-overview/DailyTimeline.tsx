import React, { useState } from 'react';

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
 * Supports both hover (desktop) and click (mobile)
 */
export function DailyTimeline({ events }: DailyTimelineProps) {
  const [activeEvent, setActiveEvent] = useState<string | null>(null);
  const [hoveredEvent, setHoveredEvent] = useState<string | null>(null);

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

  // Get color based on event type
  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'meal': return 'text-emerald-600';
      case 'workout': return 'text-purple-600';
      case 'cardio': return 'text-orange-600';
      default: return 'text-slate-600';
    }
  };

  const handleEventClick = (eventId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveEvent(activeEvent === eventId ? null : eventId);
  };

  return (
    <div className="w-full py-2 px-2" onClick={() => setActiveEvent(null)}>
      <div className="relative w-full h-10 flex items-center">
        {/* Main Timeline Groove - Deep Recessed Look */}
        <div
          className="absolute left-0 right-0 h-2.5 rounded-full bg-gray-200/50 shadow-[inset_0_1px_4px_rgba(0,0,0,0.12),inset_0_1px_2px_rgba(0,0,0,0.15),0_1px_0_rgba(255,255,255,0.8)] border-b border-white/80"
          style={{ zIndex: 1 }}
        >
          {/* Inner highlight for metallic/glass depth */}
          <div className="absolute inset-x-0 top-0 h-px bg-black/10"></div>
          <div className="absolute inset-x-0 bottom-0 h-px bg-white/80"></div>
        </div>

        {/* Events */}
        {Object.entries(eventsByTime).map(([timeInMinutes, eventsAtTime]) => {
          const position = calculatePosition(parseInt(timeInMinutes));
          // Determine if popup should go left or right based on position
          const shouldGoLeft = position > 70;
          const shouldGoRight = position < 30;

          return (
            <div
              key={timeInMinutes}
              className="absolute top-1/2 -translate-y-1/2"
              style={{
                left: `${position}%`,
                zIndex: activeEvent?.startsWith(`${timeInMinutes}-`) || hoveredEvent?.startsWith(`${timeInMinutes}-`) ? 50 : 10
              }}
            >
              {/* Events at the same time stack */}
              {eventsAtTime.map((event, idx) => {
                const eventId = `${timeInMinutes}-${idx}`;
                const isActive = activeEvent === eventId;
                const isHovered = hoveredEvent === eventId;
                const showPopup = isActive || isHovered;

                return (
                  <div
                    key={idx}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
                    style={{
                      zIndex: showPopup ? 100 : 10 + idx,
                      marginTop: idx * -4
                    }}
                    onMouseEnter={() => setHoveredEvent(eventId)}
                    onMouseLeave={() => setHoveredEvent(null)}
                  >
                    {/* Event Emoji Marker */}
                    <div 
                      className={`relative transition-all duration-200 cursor-pointer select-none ${showPopup ? 'scale-125 -translate-y-1' : 'hover:scale-110'}`}
                      onClick={(e) => handleEventClick(eventId, e)}
                    >
                      <div className="text-xl filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.25)] relative z-10">
                        {event.emoji}
                      </div>
                      <div className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-1 bg-black/15 blur-sm rounded-full transition-all duration-200 ${showPopup ? 'w-5 bg-black/10 blur-md' : ''}`}></div>
                    </div>

                    {/* Popup - Hover OR Click activated, positioned to stay in view */}
                    {showPopup && (
                      <div 
                        className={`absolute bottom-full mb-3 z-[100] ${
                          shouldGoLeft ? 'right-0 translate-x-1/4' : 
                          shouldGoRight ? 'left-0 -translate-x-1/4' : 
                          'left-1/2 -translate-x-1/2'
                        }`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="bg-white rounded-xl px-3 py-2 shadow-lg border border-slate-200 min-w-[120px]">
                          <div className={`font-bold text-xs ${getEventTypeColor(event.type)}`}>
                            {event.time}
                          </div>
                          <div className="font-semibold text-slate-800 text-xs mt-0.5">
                            {event.label}
                          </div>
                          {event.details && (
                            <div className="text-slate-500 text-[10px] mt-0.5">
                              {event.details}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}


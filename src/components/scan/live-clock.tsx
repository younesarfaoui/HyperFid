"use client";

import { useEffect, useState } from "react";

const formatter = new Intl.DateTimeFormat("fr-TN", {
  timeZone: "Africa/Tunis",
  weekday: "short",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** Ticking clock on the win screen: a screenshot shows a frozen time. */
export function LiveClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, []);

  return (
    <time suppressHydrationWarning className="font-mono text-sm tabular-nums">
      {now ? formatter.format(now) : " "}
    </time>
  );
}

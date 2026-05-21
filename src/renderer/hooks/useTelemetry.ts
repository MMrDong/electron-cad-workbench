import { useEffect, useState } from "react";

import type { TelemetryPayload } from "../../types";

export function useTelemetry() {
  const [telemetry, setTelemetry] = useState<Partial<TelemetryPayload>>({});

  useEffect(() => {
    return window.desktopApi.onTelemetry(setTelemetry);
  }, []);

  return telemetry;
}

import { Resource, type ResourceBlueprint } from "@starbeam/resource";
import { Marker } from "@starbeam/universal";

import { RecordedEvents } from "./actions.js";

interface TestResourceState {
  readonly id: number;
  readonly events: RecordedEvents;
  readonly invalidate: () => void;
  readonly resource: ResourceBlueprint<{ id: number }>;
}

let NEXT_ID = 0;

export function TestResource(
  options?:
    | {
        events: RecordedEvents;
        prefix: string;
      }
    | undefined,
): TestResourceState {
  const allEvents = options?.events ?? new RecordedEvents();
  const localEvents = options
    ? options.events.prefixed(options.prefix)
    : allEvents;
  const invalidate = Marker();
  const id = NEXT_ID++;

  return {
    id,
    events: allEvents,
    invalidate: () => void invalidate.mark(),
    resource: Resource(({ on }) => {
      localEvents.record("setup");

      on.sync(() => {
        localEvents.record("sync");
        invalidate.read();

        return () => void localEvents.record("cleanup");
      });

      on.finalize(() => {
        localEvents.record("finalize");
      });

      return { id };
    }),
  };
}

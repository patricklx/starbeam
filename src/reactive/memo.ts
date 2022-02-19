import { TIMELINE } from "../core/timeline/timeline.js";
import { Group, LOGGER } from "../strippable/trace.js";
import { ExtendsReactive } from "./base.js";
import { ReactiveMetadata } from "../core/metadata.js";
import type { FinalizedFrame } from "../core/timeline/frames.js";
import { UNINITIALIZED } from "../fundamental/constants.js";
import type { Cell } from "../fundamental/types.js";

export class ReactiveMemo<T> extends ExtendsReactive<T> {
  static create<T>(callback: () => T, description: string): ReactiveMemo<T> {
    return new ReactiveMemo(callback, description);
  }

  readonly #callback: () => T;
  #frame: FinalizedFrame<T> | null = null;

  /**
   * Every time the callback is called, the metadata for this function has an
   * opportunity to switch from dynamic to constant.
   */
  #metadata: ReactiveMetadata = ReactiveMetadata.Dynamic;

  #description: string;

  private constructor(callback: () => T, description: string) {
    super();
    this.#callback = callback;
    this.#description = description;
  }

  get description(): string {
    return this.#description;
  }

  get metadata(): ReactiveMetadata {
    if (this.#frame) {
      return this.#frame.metadata;
    } else {
      return ReactiveMetadata.Dynamic;
    }
  }

  get cells(): UNINITIALIZED | readonly Cell[] {
    if (this.#frame) {
      return this.#frame.cells;
    } else {
      return UNINITIALIZED;
    }
  }

  get current(): T {
    let group: Group;

    if (this.#frame) {
      let validationGroup = LOGGER.trace
        .group(
          `validating ${this.#description} (parent = ${
            this.#frame.description
          })`
        )
        .expanded();

      let validation = this.#frame.validate();

      if (validation.status === "valid") {
        LOGGER.trace.log(`=> valid frame for ${this.#description}`);
        validationGroup.end();

        TIMELINE.didConsume(this.#frame);
        return validation.value;
      } else {
        validationGroup.end();
        group = LOGGER.trace
          .group(`recomputing memo: ${this.#description}`)
          .expanded();
      }
    } else {
      group = LOGGER.trace
        .group(`initializing memo: ${this.#description}`)
        .expanded();
    }

    let newFrame: FinalizedFrame;

    try {
      let { frame, initial } = TIMELINE.withFrame(
        this.#callback,
        `memo: ${this.#description}`
      );
      this.#metadata = frame.metadata;

      this.#frame = newFrame = frame;
      return initial;
    } finally {
      group.end();
      TIMELINE.didConsume(newFrame!);
    }
  }
}

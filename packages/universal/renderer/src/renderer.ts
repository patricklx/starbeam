import type { Reactive } from "@starbeam/interfaces";
import { intoReactive } from "@starbeam/reactive";
import { type Resource, use } from "@starbeam/resource";
import { CONTEXT } from "@starbeam/runtime";
import { service } from "@starbeam/service";

import type { IntoResourceBlueprint } from "./resource.js";

/**
 * `SetupBlueprint` describes the parameter that you can pass to
 * {@linkcode setup}. It is a function that takes a {@linkcode Lifecycle}
 * and returns a value.
 *
 * In the simplest case, you can simply call setup with a function with no
 * parameters. The function will run during the setup phase, and return a stable
 * result for the lifetime of the component.
 *
 * You can also make use of the {@linkcode Lifecycle} to use resources, get
 * services or register code to run during the _idle_ or _layout_ phase.
 */
export type SetupBlueprint<T> = (lifecycle: Lifecycle) => T;

/**
 * `ReactiveBlueprint` is a function that takes a {@linkcode Lifecycle} and
 * returns an optionally reactive value. You can pass it to
 * {@linkcode useReactive} or {@linkcode setupReactive}. These functions will
 * instantiate the blueprint during the setup phase and return a stable reactive
 * value.
 *
 * If you pass a `ReactiveBlueprint` to {@linkcode useReactive}, you must also pass
 * dependencies to {@linkcode useReactive}. If the dependencies change, the
 * blueprint will re-evaluate, returning a new value.
 */
export type ReactiveBlueprint<T> = (lifecycle: Lifecycle) => T | Reactive<T>;

/**
 * `UseReactive` describes the parameter that you can pass to {@linkcode setupReactive}
 * or {@linkcode useReactive}.
 */
export type UseReactive<T> = ReactiveBlueprint<T> | Reactive<T>;

export interface RendererManager<C extends object> {
  readonly toNative: <T>(reactive: Reactive<T>) => unknown;
  readonly getComponent: () => C;
  readonly getApp?: (instance: C) => object | undefined;
  readonly createInstance: <T>(instance: C, create: () => T) => T;

  readonly on: {
    readonly idle: (instance: C, handler: Handler) => void;
    readonly layout: (instance: C, handler: Handler) => void;
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SomeRendererManager = RendererManager<any>;

export interface Lifecycle {
  readonly on: {
    idle: (handler: Handler) => void;
    layout: (handler: Handler) => void;
  };

  readonly use: <T>(blueprint: IntoResourceBlueprint<T>) => Resource<T>;
  readonly service: <T>(blueprint: IntoResourceBlueprint<T>) => Resource<T>;
}

class LifecycleImpl implements Lifecycle {
  readonly #manager: SomeRendererManager;
  readonly #component: object;

  constructor(manager: SomeRendererManager, component: object) {
    this.#manager = manager;
    this.#component = component;
  }

  on = {
    idle: (handler: Handler): void =>
      void this.#manager.on.idle(this.#component, handler),
    layout: (handler: Handler): void =>
      void this.#manager.on.layout(this.#component, handler),
  };

  use = <T>(blueprint: IntoResourceBlueprint<T>): Resource<T> =>
    managerSetupResource(this.#manager, blueprint);

  service = <T>(blueprint: IntoResourceBlueprint<T>): Resource<T> =>
    managerSetupService(this.#manager, blueprint);
}

export function managerSetupReactive<T>(
  manager: SomeRendererManager,
  blueprint: ReactiveBlueprint<T>
): Reactive<T> {
  const component = manager.getComponent() as object;
  const lifecycle = new LifecycleImpl(manager, component);
  return manager.createInstance(component, () =>
    intoReactive(blueprint(lifecycle))
  );
}

export function managerSetupResource<T>(
  manager: SomeRendererManager,
  blueprint: IntoResourceBlueprint<T>
): Resource<T> {
  const component = manager.getComponent() as object;

  return manager.createInstance(component, () =>
    use(blueprint, { lifetime: component })
  );
}

export function managerSetupService<T>(
  manager: SomeRendererManager,
  blueprint: IntoResourceBlueprint<T>
): Resource<T> {
  const component = manager.getComponent() as object;
  const app = manager.getApp?.(component) ?? CONTEXT;
  return manager.createInstance(component, () => service(blueprint, { app }));
}

export type Handler = () => void;

export function runHandlers(handlers: Set<() => void>): void {
  handlers.forEach((handler) => void handler());
}

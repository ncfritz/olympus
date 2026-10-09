/**
 * The native module's request and answer, declared again.
 *
 * `modules/client-identity` is the source of these, and importing them from
 * there is the right thing everywhere except in the one module the unit tests
 * reach: that import pulls in `expo`, and a spec that touches React Native dies
 * on `Parse failure: Flow is not supported` rather than on anything to do with
 * the code (see `test/unit/boundary.spec.ts`).
 *
 * `src/identity.ts` is where the two meet, and it assigns one to the other --
 * so a change to the module that this does not follow is a type error there
 * rather than a surprise on a device.
 */
export type ServiceRequest = {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  /** Seconds. */
  timeout?: number;
};

export type ServiceAnswer = {
  status: number;
  headers: Record<string, string>;
  body: string;
};

// WhatsappService.sendText and ChannexApiClient both call the bare global
// `fetch` directly (no wrapper, no axios). Mocking undici's MockAgent /
// setGlobalDispatcher was tried first and didn't work under ts-jest — the
// dispatcher set from the test's `undici` import never reached the
// dispatcher the app code's `fetch()` actually consulted (suspected
// duplicate module instances between jest's transform and Node's built-in
// fetch). Spying on `global.fetch` directly sidesteps that: it replaces the
// exact function reference the app code calls, in the same module realm as
// the test, so there's no second instance to desync from.
let fetchSpy: jest.SpiedFunction<typeof fetch> | undefined;

export function mockMetaSendSuccess(): void {
  fetchSpy = jest
    .spyOn(global, 'fetch')
    .mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (
        /graph\.facebook\.com\/v21\.0\/.+\/messages/.test(url) &&
        init?.method === 'POST'
      ) {
        return new Response(
          JSON.stringify({ messages: [{ id: `wamid.mock-${Date.now()}` }] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      throw new Error(
        `Unmocked fetch call in test: ${init?.method ?? 'GET'} ${url}`,
      );
    });
}

export function cleanupMetaMocks(): void {
  fetchSpy?.mockRestore();
  fetchSpy = undefined;
}

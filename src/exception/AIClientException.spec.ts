import AIClientException from './AIClientException';

describe('AIClientException', () => {
  it('carries the message and status passed to the constructor', () => {
    // Regression test: the constructor previously discarded the `message`
    // argument entirely and always reported the hardcoded string
    // "AI Client failed to connect.", regardless of what callers passed in
    // (e.g. AiService passes "Failed to generate reply"). That made the
    // exception message useless for diagnosing which call site failed.
    const exception = new AIClientException('Failed to generate reply', 500);

    expect(exception.message).toBe('Failed to generate reply');
    expect(exception.getStatus()).toBe(500);
  });
});

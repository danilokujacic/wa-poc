import { AppService } from './app.service';

describe('AppService', () => {
  it('getHello returns the greeting string', () => {
    expect(new AppService().getHello()).toBe('Hello World!');
  });
});

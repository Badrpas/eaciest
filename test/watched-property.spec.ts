import { Engine } from '../src';

const key = 'test_prop';
const selector = (e: any) => [777, 888].includes(e[key]);

describe('Watched property', () => {

  it(`Watched property assignment should trigger update`, () => {
    const engine = new Engine();
    const updateFn = jest.fn();

    const e = engine.addEntity({ [key]: 123, });

    engine.addHandler(updateFn, {q:[selector]});

    engine.update(0);

    expect(updateFn).toHaveBeenCalledTimes(0);

    e[key] = 777;

    engine.update(0);
    expect(updateFn).toHaveBeenCalledTimes(0);

    engine.addWatchedProperty(key);

    e[key] = 888;
    engine.update(0);
    expect(updateFn).toHaveBeenCalledTimes(1);

  });

  it(`Non-watched property assignment should not trigger update`, () => {
    const engine = new Engine();
    const updateFn = jest.fn();

    engine.addHandler(updateFn, {q:[selector]});
    const e = engine.addEntity({ [key]: 123, });

    engine.update(0);
    expect(updateFn).toHaveBeenCalledTimes(0);

    e[key] = 777;

    engine.update(0);
    expect(updateFn).toHaveBeenCalledTimes(0);
  });

});

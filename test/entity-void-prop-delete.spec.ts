import { Engine } from '../src';


describe(`Entity prop deletion`, () => {

  describe(`Engine treatUndefinedAsDelete is true`, () => {
    it(`should delete the property from entity`, () => {
      const engine = new Engine({
        deleteVoidProps: true,
        lazyEntityAdd  : false,
        lazyEntityRefresh: false,
      });

      const handler = jest.fn();
      const sys = engine.addHandler(handler, {q:['foo']});
      const e = engine.addEntity({ foo: 'bar' });

      engine.update(123);

      expect(handler).toHaveBeenCalledTimes(1);
      expect('foo' in e).toBe(true);

      e.foo = void 123;

      engine.update(123);
      expect(handler).toHaveBeenCalledTimes(1);
      expect('foo' in e).toBe(false);
    });
  });

});

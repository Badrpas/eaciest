import { Engine, IEntity, System } from '../src';


describe(`Entity removal from System`, () => {
  const get_entities_list = (system: System): Set<IEntity> => {
    if (System.RequirementsIsList(system.requirements)) {
      return system.getEntities() as Set<IEntity>;
    }
    throw new Error('Not a list of entities');
  };
  const get_collection = (system: System, collectionName: string) => {
    return system.getEntities(collectionName) as Set<IEntity>;
  };

  it(`should remove entity from storage when prop is deleted`, () => {
    const engine = new Engine({
      lazyEntityAdd: false,
      lazyEntityRefresh: false
    });

    const system = engine.addHandler(() => {}, ['foo']);
    const e = engine.addEntity({ foo: 'foo' });

    expect(get_entities_list(system).has(e)).toBe(true);

    delete e.foo;
    expect(get_entities_list(system).has(e)).toBe(false);
  });

  it(`should remove entity from all collections when prop is deleted`, () => {
    const engine = new Engine({
      lazyEntityAdd: false,
      lazyEntityRefresh: false
    });

    const system = engine.addHandler(() => {}, {
      foo: ['foo'],
      top: ['top'],
    });
    const e = engine.addEntity({ foo: 'foo', top: 'xyek' });

    expect(get_collection(system, 'foo').has(e)).toBe(true);
    expect(get_collection(system, 'top').has(e)).toBe(true);

    delete e.foo;
    expect(get_collection(system, 'foo').has(e)).toBe(false);
    expect(get_collection(system, 'top').has(e)).toBe(true);

    delete e.top;
    expect(get_collection(system, 'foo').has(e)).toBe(false);
    expect(get_collection(system, 'top').has(e)).toBe(false);
  });

  it(`should remove entity from storage when its removed from engine`, () => {
    const engine = new Engine({
      lazyEntityAdd: false,
      lazyEntityRefresh: false
    });

    const system = engine.addHandler(() => {}, ['foo']);
    const e = engine.addEntity({ foo: 'foo' });

    expect(get_entities_list(system).has(e)).toBe(true);

    engine.removeEntity(e);
    expect(get_entities_list(system).has(e)).toBe(false);
  });

  it(`should remove entity from all collections when its removed from engine`, () => {
    const engine = new Engine({
      lazyEntityAdd: false,
      lazyEntityRefresh: false
    });

    const system = engine.addHandler(() => {}, {
      foo: ['foo'],
      top: ['top'],
    });
    const e = engine.addEntity({ foo: 'foo', top: 'xyek' });

    expect(get_collection(system, 'foo').has(e)).toBe(true);
    expect(get_collection(system, 'top').has(e)).toBe(true);

    engine.removeEntity(e);
    expect(get_collection(system, 'foo').has(e)).toBe(false);
    expect(get_collection(system, 'top').has(e)).toBe(false);
  });

  describe(`onEntityRemoved() callback`, () => {

    it(`should fire when removed from a collection`, () => {
      const engine = new Engine({
        lazyEntityAdd: false,
        lazyEntityRefresh: false
      });

      const system = engine.addHandler(() => {}, ['foo']);
      const fn = system.onEntityRemoved = jest.fn();
      const e = engine.addEntity({ foo: 123 });

      const entities = get_entities_list(system);
      expect(entities.size).toBe(1);
      expect(fn).not.toHaveBeenCalled();

      delete e.foo;
      expect(entities.size).toBe(0);
      expect(fn).toHaveBeenCalledWith(e, expect.any(Map));
    });

    it(`should fire for each collection which had it`, () => {
      const engine = new Engine({
        lazyEntityAdd: false,
        lazyEntityRefresh: false
      });

      const system = engine.addHandler(() => {}, {
        top: ['top'],
        silent: ['yep'],
        a: ['b'],
      });
      const fn = system.onEntityRemoved = jest.fn();

      const e = engine.addEntity({ top: true, b: 123 });


      expect(fn).not.toHaveBeenCalled();

      delete e.top;
      expect(fn).toHaveBeenCalledWith(e, expect.any(Map), 'top');

      engine.removeEntity(e);
      expect(fn).toHaveBeenCalledWith(e, expect.any(Map), 'top');
      expect(fn).not.toHaveBeenCalledWith(e, expect.any(Map), 'silent');
    });

    it(`should not fire when no collection had the entity`, () => {
      const engine = new Engine({
        lazyEntityAdd: false,
        lazyEntityRefresh: false
      });

      const system = engine.addHandler(() => {}, ['abc']);
      const fn = system.onEntityRemoved = jest.fn();

      const e = engine.addEntity({ zzzz: 'yyyy' });

      engine.removeEntity(e);
      expect(fn).not.toHaveBeenCalled();
    });

  });

});

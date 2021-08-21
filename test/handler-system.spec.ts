import { Engine, IEntity, isSystem } from '../src';

describe(`Engine.addHandler()`, () => {

  it(`Should create new system from a handler function`, () => {
    const engine = new Engine();

    const system = engine.addHandler(() => {}, []);

    expect(isSystem(system)).toBe(true);
  });


  it(`Should match requirements`, () => {
    const engine = new Engine({
      lazyEntityRefresh: false,
    });

    const e1 = engine.addEntity({});
    const e2 = engine.addEntity({});

    const system = engine.addHandler(() => {}, ['a', 'b']);
    const entities = system.entities as Set<IEntity>;

    expect(entities.size).toBe(0);

    e1.a = 1;
    expect(entities.size).toBe(0);

    e1.b = 2;
    expect(entities.size).toBe(1);

    e2.a = e2.b = 123;
    expect(entities.size).toBe(2);

    delete e1.b;
    expect(entities.size).toBe(1);
  });


});

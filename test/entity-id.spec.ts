import { Engine, ENTITY_ID } from '../src';

describe(`Entity ID`, () => {
  it(`should be start from 1`, () => {
    const engine = new Engine();

    const e = engine.addEntity({});

    expect(e[ENTITY_ID]).toBe(1);
  });

  it(`should be assigned by owning engine`, () => {
    const engine1 = new Engine();
    const engine2 = new Engine();

    engine1.addEntity({});
    const e1 = engine1.addEntity({});
    const id1 = e1[ENTITY_ID]; // 2

    expect(id1).toBe(2);

    const e2 = engine2.addEntity(e1); // reassigning engine

    expect(e2).toBe(e1);
    expect(e2[ENTITY_ID]).toBe(1); // engine2 assigned 1
  });

});

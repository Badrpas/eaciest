import {
  Engine,
  isEntity,
  IEntity,
  System,
  ENGINE,
  PROXY,
  IEntityProjection,
  isSystem,
  SimplifiedSystem, TEntitiesList,
} from '../src';

let engine: Engine;
beforeEach(() => {
  engine = new Engine();
});

const omitEntitySymbols = (entity: IEntity | IEntityProjection): IEntityProjection => {
  const {
  // @ts-ignore
    [ENGINE]: _,
    [PROXY] : __,
    ...entityData
  } = entity;

  return entityData;
};

describe(`add()`, () => {

  it(`should accept no arguments`, () => {
    const entity = engine.add();

    expect(isEntity(entity)).toBe(true);
    expect(omitEntitySymbols(entity)).toEqual({});
  });

  it(`should accept plain object`, () => {
    const initialProps = { componentName: 123 };
    const entity = engine.add(initialProps);

    expect(isEntity(entity)).toBe(true);
    expect(isEntity(initialProps)).toBe(false);

    expect(entity).toEqual(initialProps);
    expect(entity).not.toBe(initialProps);
  });

  it(`should accept class instance`, () => {
    class CustomSystem extends System {}
    const system = engine.add(new CustomSystem());

    expect(system).toBeInstanceOf(System);
    expect(system).toBeInstanceOf(CustomSystem);
  });

  it(`should not add external class as system`, () => {
    class CustomSystem {}
    const result = engine.add(new CustomSystem());

    expect(isSystem(result)).not.toBe(true);
    expect(result).toBeInstanceOf(CustomSystem);

    expect(isEntity(result)).toBe(true);
  });

  it(`should accept class`, () => {
    class CustomSystem extends System {}
    const system = engine.add(CustomSystem);

    expect(system).toBeInstanceOf(System);
    expect(system).toBeInstanceOf(CustomSystem);
  });

  it(`should accept class and arguments for its constructor`, () => {
    class CustomSystem extends System {
      constructor (public arg1: number, public arg2: string) {
        super();
      }
    }
    const system = engine.add(CustomSystem, 123, 456);

    expect(system).toBeInstanceOf(System);
    expect(system).toBeInstanceOf(CustomSystem);
    expect(system).toEqual(expect.objectContaining({ arg1: 123, arg2: 456 }));
  });

  it(`should accept handler function`, () => {
    const handler = jest.fn();
    const system = engine.add(handler);

    expect(isSystem(system)).toBe(true);
    expect(system).toBeInstanceOf(SimplifiedSystem);
  });

  it(`should call handler function with correct argumetns and context`, () => {
    const handler = jest.fn().mockReturnThis();
    const system = engine.add(handler);

    system.update(123);
    expect(handler).toHaveBeenCalledWith(123);
    expect(handler).toReturnWith(system);
  });

  it(`should accept handler function and requirements`, () => {
    const handler = jest.fn();
    const requirements = ['someComponent'];
    const system = engine.add(handler, requirements);

    expect(isSystem(system)).toBe(true);
    expect(system.requirements).toEqual(requirements);
  });

  it(`created system should have a pointer to engine`, () => {
    const system = engine.add(() => {});

    expect(isSystem(system)).toBe(true);
    expect((<any>system)._engine).toBe(engine);
  });
});

describe(`addEntity()`, () => {

  it(`should accept no arguments`, () => {
    const entity = engine.addEntity();

    expect(isEntity(entity)).toBe(true);
  });

  it(`should accept projection argument`, () => {
    const entity = engine.addEntity({ foo: 'bar' });

    expect(isEntity(entity)).toBe(true);
    expect(omitEntitySymbols(entity)).toEqual({ foo: 'bar' })
  });

  it(`should mutate passed object`, () => {
    const projection = { foo: 'bar' };
    const entity = engine.addEntity(projection);

    expect(omitEntitySymbols(projection)).not.toEqual(projection);

    expect(omitEntitySymbols(projection)).toEqual({ foo: 'bar' });
    expect(entity).not.toBe(projection);
    expect(entity).toEqual(projection);
  });

  it(`should set ENGINE symbol`, () => {
    const entity = engine.addEntity({});

    expect(entity[ENGINE]).toBe(engine);
  });

  it(`should populate entities list`, () => {
    const entity = engine.addEntity();

    expect(engine.entities.has(entity)).toBe(true);
  });

  it(`should set entity for systems refresh queue`, () => {
    const fn = (engine as any)._markEntityChanged = jest.fn();
    const entity = engine.addEntity();

    expect(fn).toHaveBeenCalledWith(entity);
  });

});

describe(`addSystem()`, () => {
  it(`should initialize system`, () => {
    const initFn = jest.fn();

    const system = new System();
    system.initialize = initFn;
    engine.addSystem(system);

    expect(initFn).toHaveBeenCalled();
  });

  it(`should populate systems array`, () => {
    const system = engine.addSystem(new System());

    expect((engine as any)._systems.includes(system)).toBe(true);
  });

  it(`should run refresh against existing entities`, () => {
    const entity = engine.addEntity();
    const system = new System();
    system.refreshEntityStatus = jest.fn();

    engine.addSystem(system);

    expect((system.refreshEntityStatus as any).mock.calls)
      .toEqual([expect.arrayContaining([entity])]);
  });

  // it(`should not run refresh if option provided`, () => {
  //   // which option?
  // });
});

describe(`markEntityChanged()`, () => {
  it(`should refresh immediately with 'lazyEntityRefresh' === true`, () => {
    engine = new Engine({ lazyEntityRefresh: true });
    const refreshMock = engine.refreshEntity = jest.fn();

    engine.addEntity();

    expect(refreshMock).not.toHaveBeenCalled();
  });

  it(`should send new entity to queue for refreshes when 'lazyEntityRefresh' === false`, () => {
    engine = new Engine({ lazyEntityRefresh: false });
    const refreshMock = engine.refreshEntity = jest.fn();

    engine.addEntity();

    expect(refreshMock).toHaveBeenCalled();
  });
});

describe(`refreshEntity()`, () => {
  it(`should run refreshEntity() over all systems`, () => {
    engine = new Engine({ lazyEntityRefresh: true });
    const system = engine.add(() => {}) as System;
    system.refreshEntityStatus = jest.fn();

    const entity = engine.addEntity(); // add new entity to refresh queue

    engine.refreshEntity(entity);

    expect(system.refreshEntityStatus).toHaveBeenCalled();
  });

  it(`should remove entity from update queue`, () => {
    engine = new Engine({ lazyEntityRefresh: true });

    const entity = engine.addEntity(); // add new entity to refresh queue
    const queueSize = (engine as any)._entitiesRefreshQueue.size;

    engine.refreshEntity(entity);

    expect((engine as any)._entitiesRefreshQueue.size).not.toBe(queueSize);
  });
});

describe(`removeEntity`, () => {
  it(`should remove element from store`, () => {
    const entity = engine.add({ component: true }) as IEntity;
    expect((engine as any)._entitiesStore.size).toBe(1);

    engine.removeEntity(entity);

    expect((engine as any)._entitiesStore.size).toBe(0);
  });

  it(`should remove entity from all systems`, () => {
    const system = engine.add(() => {}, [ 'component' ]) as System;
    const systemEntities = (system as any).entities as TEntitiesList;

    const entity = engine.addEntity({ component: true });
    expect(systemEntities.size).toBe(0);

    engine.refreshEntity(entity);
    expect(systemEntities.size).toBe(1);

    engine.removeEntity(entity);
    expect(systemEntities.size).toBe(0);
  });
});

describe(`update()`, () => {

  it(`should run update for all enabled systems`, () => {
    class MockSystem extends System {
      update = jest.fn();
    }

    const system1 = engine.add(MockSystem) as System;
    system1.enabled = false;
    const system2 = engine.add(MockSystem) as System;

    engine.update(123);

    expect(system1.update).not.toHaveBeenCalled();
    expect(system2.update).toHaveBeenCalled();
  });

  it(`should process refresh queue (lazyEntityRefresh === false)`, () => {
    engine = new Engine({ lazyEntityRefresh: false });
    engine.processChangedQueue = jest.fn();

    engine.update(123);

    expect(engine.processChangedQueue).toHaveBeenCalled();
  });


  it(`should process refresh queue (lazyEntityRefresh === true)`, () => {
    engine = new Engine({ lazyEntityRefresh: true });
    engine.processChangedQueue = jest.fn();

    engine.update(123);

    expect(engine.processChangedQueue).toHaveBeenCalled();
  });

  it(`should process add queue`, () => {
    engine = new Engine({ lazyEntityAdd: true });
    engine.processAddQueue = jest.fn();

    engine.update(123);

    expect(engine.processAddQueue).toHaveBeenCalled();
  });

});

describe(`handleChangedEntities()`, () => {
  it(`should process refresh queue`, () => {
    const entitiesRefreshQueue = (engine as any)._entitiesRefreshQueue as Set<IEntity>;

    expect(entitiesRefreshQueue.size).toBe(0);

    engine.add();
    expect(entitiesRefreshQueue.size).toBe(1);

    engine.processChangedQueue();
    expect(entitiesRefreshQueue.size).toBe(0);
  });
});

describe(`processAddQueue()`, () => {
  it(`should clear queue`, () => {
    engine = new Engine({ lazyEntityAdd: true });
    const entitiesAddQueue = (engine as any)._entitiesToAddQueue as Set<IEntity>;

    expect(entitiesAddQueue.size).toBe(0);

    engine.add({});
    expect(entitiesAddQueue.size).toBe(1);

    engine.processAddQueue();

    expect(entitiesAddQueue.size).toBe(0);
  });
});
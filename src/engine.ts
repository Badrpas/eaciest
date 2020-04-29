import { SimplifiedSystem, System, TEntityRequirements, TSystemUpdateMethod } from "./system";
import { ENGINE, IEntity, getEntity, IEntityProjection, PROXY } from "./entity";

interface IEngineOptions {
  lazyEntityRefresh?: boolean;
  lazyEntityAdd?: boolean;
}

type TSystemConstructor = new (...args: any[]) => System;
type EntityOrSystemCandidate = IEntityProjection | IEntity | System | TSystemConstructor | TSystemUpdateMethod;


export class Engine {
  options: Readonly<IEngineOptions>;
  private _systems: System[] = [];

  private _entitiesStore: Set<IEntity> = new Set<IEntity>();

  get entities (): Set<IEntity> {
    return this._entitiesStore;
  }

  private _dt: number = 0;
  get dt (): number {
    return this._dt;
  }

  private _entitiesRefreshQueue: Set<IEntity> = new Set<IEntity>();
  private _entitiesToAddQueue  : Set<IEntity> = new Set<IEntity>();

  constructor (options: IEngineOptions = {}) {
    this.options = {
      lazyEntityRefresh: true,
      lazyEntityAdd    : false,
      ...options
    } as const;

    this.add = this.add.bind(this);
  }

  update = (dt: number) => {
    this._dt = dt;

    this.processAddQueue();

    this.processChangedQueue();

    for (const system of this._systems) {
      if (system.enabled && system.isQualifiedForUpdate()) {
        try {
          system.update(this._dt);
        } catch (err) {
          console.error(err);
          system.enabled = false;
        }
      }
    }
  };

  add (obj: EntityOrSystemCandidate = {}, ...args: any[]): IEntity | System {
    if (obj instanceof System) {
      return this.addSystem(obj);
    } else if (typeof obj === 'function') {

      if (Engine.isSystemConstructor(obj)) {
        return this.addSystemClass(obj, ...args);
      } else { // handler function
        const [ requirements ] = args;
        return this.addHandler(obj as TSystemUpdateMethod, requirements);
      }

    } else {
      return this.addEntity(obj);
    }
  }

  addEntity (candidate?: IEntity | IEntityProjection | null): IEntity {
    if (!candidate) {
      candidate = {};
    }

    const entity: IEntity = getEntity(candidate);

    entity[ENGINE] = this;

    if (this.options.lazyEntityAdd) {
      this._entitiesToAddQueue.add(entity);
    } else {
      this._entitiesStore.add(entity);
      this._markEntityChanged(entity);
    }

    return entity;
  }

  addHandler (updateFn: TSystemUpdateMethod, requirements: TEntityRequirements) {
    const system: System = new SimplifiedSystem(updateFn, requirements);

    return this.addSystem(system);
  }

  addSystemClass (Class: TSystemConstructor, ...args: any[]) {
    return this.addSystem(new Class(...args));
  }

  addSystem<T extends System> (system: T): System {
    system.setEngine(this);
    system.initialize();

    this._systems.push(system);

    for (const entity of this._entitiesStore) {
      system.refreshEntityStatus(entity);
    }

    this._systems.sort((a, b) => {
      return a.priority - b.priority;
    });

    return system;
  }

  processAddQueue () {
    for (const entity of this._entitiesToAddQueue) {
      this.entities.add(entity);
      this._markEntityChanged(entity);
    }

    this._entitiesToAddQueue.clear();
  }

  _markEntityChanged (entity: IEntity) {
    entity = getEntity(entity);
    if (this.options.lazyEntityRefresh) {
      this._entitiesRefreshQueue.add(entity);
    } else {
      this.refreshEntity(entity);
    }
  }

  processChangedQueue () {
    for (const entity of this._entitiesRefreshQueue) {
      this.refreshEntity(entity);
    }
  }

  refreshEntity = (entity: IEntity) => {
    entity = entity[PROXY];
    this._entitiesRefreshQueue.delete(entity);

    for (const system of this._systems) {
      system.refreshEntityStatus(entity);
    }
  };

  removeEntity (entity: IEntity) {
    entity = getEntity(entity);

    this._entitiesStore.delete(entity);
    this._entitiesRefreshQueue.delete(entity);
    this._entitiesToAddQueue.delete(entity);

    for (const system of this._systems) {
      system.removeEntity(entity);
    }
  }

  removeSystem (system: System) {
    const index = this._systems.indexOf(system);
    this._systems.splice(index, 1);
  }

  private static isSystemConstructor (fn: Function | TSystemConstructor | TSystemUpdateMethod)
    : fn is TSystemConstructor {
    return fn.prototype instanceof System;
  }
}
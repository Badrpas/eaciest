import { SimplifiedSystem, System, TEntityRequirements, TSystemUpdateMethod } from "./system";
import { ENGINE, IEntity, getEntity, IEntityProjection } from "./entity";

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
  private _entitiesToAddQueue: Set<IEntity> = new Set<IEntity>();

  constructor (options: IEngineOptions = {}) {
    this.options = {
      lazyEntityRefresh: true,
      lazyEntityAdd    : false,
      ...options
    } as const;
  }

  update = (dt: number) => {
    this._dt = dt;

    this.processAddQueue();

    this.processChangedQueue();

    for (const system of this._systems) {
      if (system.enabled) {
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

  private addHandler (updateFn: TSystemUpdateMethod, requirements: TEntityRequirements) {
    const system: System = new SimplifiedSystem(updateFn, requirements);

    return this.addSystem(system);
  }

  private addSystemClass (Class: TSystemConstructor, ...args: any[]) {
    const system = this.instantiateSystem<System>(Class, ...args);

    return this.addSystem(system);
  }

  /**
   * Alias for new SystemClass(...args)
   */
  instantiateSystem<T extends System> (SystemClass: new (...args: any[]) => T, ...args: any[]): System {
    return this.addSystem(new SystemClass(...args));
  }

  addSystem<T extends System> (system: T): System {
    system.setEngine(this);
    system.initialize();

    this._systems.push(system);

    this._entitiesStore.forEach(system.refreshEntity);

    return system;
  }

  processAddQueue () {
    for (const entity of this._entitiesToAddQueue) {
      this.entities.add(entity);
    }

    this._entitiesToAddQueue.clear();
  }

  _markEntityChanged (entity: IEntity) {
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
    this._systems.forEach(system => system.refreshEntity(entity));
    this._entitiesRefreshQueue.delete(entity);
  };

  removeEntity (entity: IEntity) {
    this._entitiesStore.delete(entity);

    this._systems.forEach(system => {
      system.removeEntity(entity);
    });
  }


  private static isSystemConstructor (fn: Function | TSystemConstructor | TSystemUpdateMethod)
    : fn is TSystemConstructor {
    return fn.prototype instanceof System;
  }
}
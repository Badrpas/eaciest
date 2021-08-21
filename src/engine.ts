import { System, TEntityRequirements} from "./system";
import { ENGINE, IEntity, getEntity, IEntityProjection, PROXY, DELETED_PROPS, TPropKey } from "./entity";
import { SimplifiedSystem, TSystemUpdateMethod } from './simplified-system';

interface IEngineOptions {
  // Postpones entity's affiliation to systems check
  // to next Engine.update() call
  lazyEntityRefresh: boolean;

  // Postpones affiliation check for newly added entities
  lazyEntityAdd: boolean;
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

  private _watchedProperties: Set<TPropKey> = new Set<TPropKey>();

  constructor (options: Partial<IEngineOptions> = {}) {
    this.options = {
      lazyEntityRefresh: true,
      lazyEntityAdd    : false,
      ...options
    } as const;

    this.add = this.add.bind(this);
  }

  /**
   * Runs all registered systems with provided time delta value
   */
  update (dt: number) {
    this._dt = dt;

    this.processAddQueue();

    this.processChangedQueue();

    for (const system of this._systems) {
      this.updateSystem(system);
    }
  };

  updateSystem (system: System) {
    if (!system.enabled || !system.isQualifiedForUpdate()) return;

    try {
      system.update(this._dt);
    } catch (err) {
      console.error(err);
      system.enabled = false;
    }
  }

  add (obj: EntityOrSystemCandidate | Array<EntityOrSystemCandidate> = {}, ...args: any[]): IEntity | System | Array<IEntity | System> {
    if (obj instanceof Array) {
      return <Array<IEntity | System>>obj.map(x => this.add(x));
    }
    if (obj instanceof Promise) {
      // @ts-ignore
      return obj.then(x => this.add(x));
    }

    if (obj instanceof System) {
      return this.addSystem(obj);
    } else if (typeof obj === 'function') {

      if (Engine.isSystemConstructor(obj)) {
        return this.addSystemClass(obj, ...args);
      } else { // handler function
        const [ requirements ] = args;
        return this.addHandler(<TSystemUpdateMethod>obj, requirements);
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

  /**
   * Marks entity for affiliation state refresh.
   * Performs refresh immediately or postponed when options.lazyEntityRefresh === true
   */
  _markEntityChanged (entity: IEntity, lazy: boolean = this.options.lazyEntityRefresh) {
    entity = getEntity(entity);
    if (lazy) {
      this._entitiesRefreshQueue.add(entity);
    } else {
      this.refreshEntity(entity);
    }
  }

  private processChangedQueue () {
    for (const entity of this._entitiesRefreshQueue) {
      this.refreshEntity(entity);
    }
  }

  /**
   * Watched property will trigger _markEntityChanged() on it's value set.
   * Warn: setting the same value also triggers the behavior
   */
  public addWatchedProperty(prop: TPropKey) {
    this._watchedProperties.add(prop);
  }

  public removeWatchedProperty(prop: TPropKey) {
    this._watchedProperties.delete(prop);
  }

  public isWatchedProperty(prop: TPropKey) {
    return this._watchedProperties.has(prop);
  }

  /**
   * Recalculates entity affiliation to systems
   */
  refreshEntity = (entity: IEntity) => {
    entity = entity[PROXY];
    this._entitiesRefreshQueue.delete(entity);

    for (const system of this._systems) {
      system.refreshEntityStatus(entity);
    }

    if (entity[DELETED_PROPS]?.size) {
      entity[DELETED_PROPS]?.clear();
    }
  };

  removeEntity (entity: IEntity) {
    entity = getEntity(entity);

    this._entitiesStore.delete(entity);
    this._entitiesRefreshQueue.delete(entity);
    this._entitiesToAddQueue.delete(entity);

    delete entity[ENGINE];

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

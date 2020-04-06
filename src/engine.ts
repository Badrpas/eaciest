import { SimplifiedSystem, System, TSystemUpdateMethod } from "./system";
import { ENGINE, IEntity, getEntity, IEntityProjection, isEntity } from "./entity";
import { removeElementFromArray } from './auxiliary';

interface IEngineOptions {
  lazyEntityRefresh?: boolean
}

type TSystemConstructor = new (...args: any[]) => System;
type EntityOrSystem = IEntityProjection | IEntity | System | TSystemConstructor | TSystemUpdateMethod;


export class Engine {
  options: Readonly<IEngineOptions>;
  private _systems: System[] = [];

  private _entitiesStore: Set<IEntity> = new Set<IEntity>(); // TODO migrate to Set
  get entities (): Set<IEntity> { return this._entitiesStore; }

  private _dt: number = 0;
  get dt (): number { return this._dt; }

  private _entitiesRefreshQueue: Set<IEntity> = new Set<IEntity>();

  constructor (options: IEngineOptions = {}) {
    this.options = {
      lazyEntityRefresh: true,
      ...options
    } as const;
  }

  update = (dt: number) => {
    this._dt = dt;

    // Maybe it should always be called?
    if (!this.options.lazyEntityRefresh) {
      this.handleChangedEntities();
    }

    this._systems.forEach(system => {
      if (system.enabled) {
        system.update(this._dt);
      }
    });
  };

  add (obj: EntityOrSystem = {}, ...args: any[]): IEntity | System {
    if (obj instanceof System) {
      return this.addSystem(obj);
    } else if (typeof obj === 'function') {
      if (obj.prototype instanceof System) { // is child of System class
        // TODO move to method
        const system = this.instantiateSystem<System>(obj as TSystemConstructor, ...args);

        return this.addSystem(system);
      } else { // handler function
        // TODO move to method
        const system: System = new SimplifiedSystem(obj as TSystemUpdateMethod, ...args);

        return this.addSystem(system);
      }
    } else {
      return this.addEntity(obj);
    }
  }

  /**
   * Alias for new SystemClass(...args)
   */
  instantiateSystem <T extends System>(SystemClass: new (...args: any[]) => T, ...args: any[]): System {
    return this.addSystem(new SystemClass(...args));
  }

  addSystem<T extends System> (system: T): System {
    system.setEngine(this);
    system.initialize();

    this._systems.push(system);

    this._entitiesStore.forEach(system.refreshEntity);

    return system;
  }

  addEntity (candidate?: IEntity | IEntityProjection | null): IEntity {
    if (!candidate) {
      candidate = {};
    }

    const entity: IEntity = getEntity(candidate);

    entity[ENGINE] = this;

    // TODO add lazy check?
    this._entitiesStore.add(entity);

    this._markEntityChanged(entity);

    return entity;
  }

  _markEntityChanged (entity: IEntity) {
    if (this.options.lazyEntityRefresh) {
      this._entitiesRefreshQueue.add(entity);
    } else {
      this.refreshEntity(entity);
    }
  }

  handleChangedEntities () {
    this._entitiesRefreshQueue.forEach(this.refreshEntity);
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

}
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

  private _entitiesStore: Array<IEntity> = []; // TODO migrate to Set
  get entities (): Array<IEntity> { return this._entitiesStore; }

  private _dt: number = 0;
  get dt (): number { return this._dt; }

  private _entitiesToUpdate: Set<IEntity> = new Set<IEntity>();

  constructor (options: IEngineOptions = {}) {
    this.options = {
      lazyEntityRefresh: true,
      ...options
    } as const;
  }

  update = (dt: number) => {
    this._dt = dt;

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
        const system = this.instantiateSystem<System>(obj as TSystemConstructor, ...args);
        return this.addSystem(system);
      } else { // handler function
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
    this._entitiesStore.push(entity);

    this._markEntityChanged(entity);

    return entity;
  }

  _markEntityChanged (entity: IEntity) {
    if (this.options.lazyEntityRefresh) {
      this._entitiesToUpdate.add(entity);
    } else {
      this.refreshEntity(entity);
    }
  }

  handleChangedEntities () {
    this._entitiesToUpdate.forEach(this.refreshEntity);
  }

  refreshEntity = (entity: IEntity) => {
    this._systems.forEach(system => system.refreshEntity(entity));
    this._entitiesToUpdate.delete(entity);
  };

  removeEntity (entity: IEntity) {
    removeElementFromArray(this._entitiesStore, entity);

    this._systems.forEach(system => {
      system.removeEntity(entity);
    });
  }

}
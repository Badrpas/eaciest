import { System } from "./system";
import { ENGINE_SYMBOL, IEntity, getProxiedEntity } from "./entity";
import { removeElementFromArray } from './auxiliary';

interface IEngineOptions {
  immediateEntityRefresh?: boolean
}

export class Engine {
  options: Readonly<IEngineOptions>;
  private _systems: System[] = [];

  private _entities: Array<IEntity> = [];
  get entities (): Array<IEntity> { return this._entities; }

  private _dt: number = 0;
  get dt (): number { return this._dt; }

  private _entitiesToUpdate: Set<IEntity> = new Set<IEntity>();

  constructor (options: IEngineOptions = {}) {
    this.options = {
      immediateEntityRefresh: true,
      ...options
    } as const;
  }

  update = (dt: number) => {
    this._dt = dt;

    if (!this.options.immediateEntityRefresh) {
      this.handleChangedEntities();
    }

    this._systems.forEach(system => {
      if (system.enabled) {
        system.update(this._dt);
      }
    });
  };

  add (obj: IEntity | System = {}): IEntity | System {
    if (obj instanceof System) {
      return this.addSystem(obj);
    } else {
      return this.addEntity(obj);
    }
  }

  instantiateSystem <T extends System>(SystemClass: new (...args: any[]) => T, ...args: any[]): System {
    return this.addSystem(new SystemClass(...args));
  }

  addSystem<T extends System> (system: T): System {
    system.setEngine(this);
    system.initEntities();
    this._systems.push(system);

    this._entities.forEach(system.refreshEntity);

    return system;
  }

  addEntity (entity: IEntity = {}): IEntity {
    entity[ENGINE_SYMBOL] = this;
    entity = getProxiedEntity(entity);

    this._entities.push(entity);

    this.markEntityChanged(entity);

    return entity;
  }

  markEntityChanged (entity: IEntity) {
    if (this.options.immediateEntityRefresh) {
      this.refreshEntity(entity);
    } else {
      this._entitiesToUpdate.add(entity);
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
    removeElementFromArray(this._entities, entity);
    this._systems.forEach(system => {
      system.removeEntity(entity);
    });
  }

}
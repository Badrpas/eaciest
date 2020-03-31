import { System } from "./system";
import { ENGINE_SYMBOL, IEntity, getProxiedEntity } from "./entity";
import { removeElementFromArray } from './auxiliary';

interface IOptions {
  silentUpdates?: boolean
}

export class Engine {
  options: Readonly<IOptions>;
  private _systems: System[] = [];

  private _entities: Array<IEntity> = [];
  get entities (): Array<IEntity> { return this._entities; }

  private _dt: number = 0;
  get dt (): number { return this._dt; }

  private _entitiesToUpdate: Set<IEntity> = new Set<IEntity>();

  constructor (options: IOptions = {}) {
    this.options = {
      silentUpdates: true,
      ...options
    } as const;

  }

  update = (dt: number) => {
    this._dt = dt;

    if (!this.options.silentUpdates) {
      this.handleUpdatedEntities();
    }

    this._systems.forEach(system => {
      if (system.enabled) {
        system.update(this._dt);
      }
    });
  };

  setEntityForUpdate (entity: IEntity) {
    if (this.options.silentUpdates) {
      this.updateEntity(entity);
    } else {
      this._entitiesToUpdate.add(entity);
    }
  }

  handleUpdatedEntities () {
    this._entitiesToUpdate.forEach(this.updateEntity);
    this._entitiesToUpdate.clear();
  }

  add (obj: IEntity | System = {}): IEntity | System {
    if (obj instanceof System) {
      return this.addSystem(obj);
    } else {
      return this.addEntity(obj);
    }
  }

  addSystem<T extends System> (system: T): System {
    system.setEngine(this);
    system.initEntities();
    this._systems.push(system);

    this._entities.forEach(system.updateEntity);

    return system;
  }

  addEntity (entity: IEntity = {}): IEntity {
    entity[ENGINE_SYMBOL] = this;
    entity = getProxiedEntity(entity);

    this._entities.push(entity);

    this.setEntityForUpdate(entity);

    return entity;
  }

  updateEntity = (entity: IEntity) => {
    this._systems.forEach(system => system.updateEntity(entity));
  };

  removeEntity (entity: IEntity) {
    removeElementFromArray(this._entities, entity);
    this._systems.forEach(system => {
      system.removeEntity(entity);
    });
  }

}
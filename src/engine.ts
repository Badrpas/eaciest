import { System } from "./system";
import { ENGINE_SYMBOL, IEntity, getProxiedEntity } from "./entity";
import { removeElementFromArray } from './auxiliary';


export class Engine {
  private systems: System[] = [];
  /*private*/
  entities: Array<IEntity> = [];

  private dt: number = 0;

  update = (dt: number) => {
    this.dt = dt;
    this.systems.forEach(system => {
      if (system.enabled) {
        system.update(this.dt);
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

  addSystem<T extends System> (system: T): System {
    system.setEngine(this);
    system.initEntities();
    this.systems.push(system);

    this.entities.forEach(system.updateEntity);

    return system;
  }

  addEntity (entity: IEntity = {}): IEntity {
    entity[ENGINE_SYMBOL] = this;
    entity = getProxiedEntity(entity);

    this.entities.push(entity);

    this.systems.forEach(system => system.updateEntity(entity));

    return entity;
  }

  updateEntity (entity: IEntity) {
    this.systems.forEach(system => system.updateEntity(entity));
  }

  removeEntity (entity: IEntity) {
    removeElementFromArray(this.entities, entity);
    this.systems.forEach(system => {
      system.removeEntity(entity);
    });
  }

}
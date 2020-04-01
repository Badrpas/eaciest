import { IEntity } from "./entity";
import { Engine } from "./engine";
import { logger, removeElementFromArray } from './auxiliary';

type IEntityRequirementPredicateFn = (entity: IEntity) => boolean;
type IEntityRequirementPredicate = string | IEntityRequirementPredicateFn;
type IEntityRequirementList = Array<IEntityRequirementPredicate>;
type IEntityRequirements = IEntityRequirementList
                         | { [key: string]: IEntityRequirementList }
                         | null;

export class System {
  public enabled: boolean = true;
  private _engine!: Engine;
  protected entities: ({ [key: string]: IEntity[] } | IEntity[]) = [];

  /**
   * Defines list(s) of entities with required components.
   * For example:
   * [ 'componentName1', 'componentName2' ]
   * results in array of entities which
   * have componentName1 and componentName2 in them
   *
   * {
   *   entityList1: [ 'componentName1', 'componentName2' ],
   *   entityList2: [ 'componentName3' ]
   * }
   * Such requirement will produce an object with
   * two independent lists:
   * {
   *   entityList1: [entity1, entity2, ...]
   *   entityList2: [...]
   * }
   */
  requirements: IEntityRequirements = null;
  private _entitiesInitialized: boolean = false;

  /**
   * Called from `Engine.prototype.addSystem` method
   */
  initEntities () {
    if (this._entitiesInitialized) {
      return;
    }
    this._entitiesInitialized = true;

    if (this.requirements === null) {
      return;
    }
    if (!(this.requirements instanceof Array)) {
      this.entities = {};
      for (const key of Object.keys(this.requirements)) {
        this.entities[key] = [];
      }
    }
  }

  setEngine (engine: Engine) {
    this._engine = engine;
  }

  update (dt: number) {}

  private _testFunctionCache: Array<[Array<IEntityRequirementPredicate>, Function]> = [];

  getTestFunction (componentList: IEntityRequirementList = []) {
    const cacheEntry = this._testFunctionCache.find(([array]) => array === componentList);

    if (cacheEntry) {
      return cacheEntry[1];
    }

    const tests = componentList.map(predicate => {
      if (typeof predicate === 'string') {
        return (entity: IEntity) => predicate in entity;
      } else if (typeof predicate === 'function') {
        return predicate;
      }
    }).filter(x => !!x) as Array<IEntityRequirementPredicateFn>;

    const testFn = (entity: IEntity) => {
      return tests.every(test => test(entity));
    };

    this._testFunctionCache.push([componentList, testFn]);

    return testFn;
  }

  /**
   * Checks entity for eligibility for the system
   * @param entity
   */
  refreshEntity = (entity: IEntity): void => {
    const { requirements } = this;
    if (requirements === null) {
      return;
    }

    if (requirements instanceof Array) { // Single collection
      if (this.isEntityMeetsRequirements(entity, requirements)) {
        if (this.entities instanceof Array && !this.entities.includes(entity)) {
          this.addEntity(entity);
        }
      } else {
        this.removeEntity(entity);
      }
    } else if (typeof requirements === 'object') { // Set of collections
      for (const [collectionName, requirement] of Object.entries(requirements)) {
        if (!(requirement instanceof Array)) {
          logger.warn(`Wrong requirement "${collectionName}":`, requirement, 'in', this);
          continue;
        }

        if (this.isEntityMeetsRequirements(entity, requirement)) {
          this.addEntity(entity, collectionName);
        } else {
          this.removeEntity(entity, collectionName);
        }
      }
    } else {
      throw new Error(`Incorrect requirements type. Expected Array or Object got ${typeof requirements}`);
    }
  };

  isEntityMeetsRequirements (entity: IEntity, requirements: IEntityRequirementList) {
    const testFunction = this.getTestFunction(requirements);
    return !!testFunction?.(entity);
  }

  addEntity (entity: IEntity, collectionName: string | null = null) {
    if (!(this.requirements instanceof Array)) {
      if (collectionName) {
        // @ts-ignore
        this.entities[collectionName].push(entity);
      }
    } else {
      if (this.entities instanceof Array) {
        this.entities.push(entity);
      }
    }
  }

  getEntities<T extends IEntity> (collectionName?: string): Array<T> {
    if (!this.requirements && this._engine) {
      // @ts-ignore
      return this._engine.entities;
    }

    const isSingleCollection = this.requirements instanceof Array;
    if (collectionName) {
      if (!isSingleCollection) {
        return (this.entities as {[key: string]: Array<T>})[collectionName];
      }

      throw new Error(`System has a single collection.`);
    }

    return this.entities as Array<T>;
  }

  getEntity <T extends IEntity> (collectionName?: string): T | void {
    const entities = this.getEntities(collectionName);
    if (entities) {
      return entities[0] as T;
    }
  }

  getAllEntityCollections (): Array<Array<IEntity>> {
    if (this.entities instanceof Array) {
      return [this.entities];
    } else {
      return Object.values(this.entities);
    }
  }

  removeEntity (entity: IEntity, collectionName?: string): void {
    if (collectionName) {
      removeElementFromArray(this.getEntities(collectionName), entity);
      return;
    }
    this.getAllEntityCollections().forEach(collection => {
      removeElementFromArray(collection, entity);
    });
  }

}


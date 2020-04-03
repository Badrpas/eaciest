import { IEntity } from "./entity";
import { Engine } from "./engine";
import { logger, removeElementFromArray } from './auxiliary';

type TEntityPredicate = (entity: IEntity) => boolean;

type TEntityRequirementPredicate = TEntityPredicate;
type TEntityRequirementConstraint = string | TEntityRequirementPredicate;
type TEntityRequirementList = Array<TEntityRequirementConstraint>;

type TEntityRequirements = TEntityRequirementList
                         | { [key: string]: TEntityRequirementList }
                         | null;

const isEntityRequirementList = (requirements: TEntityRequirements)
  : requirements is TEntityRequirementList => {
  return requirements instanceof Array;
};

export type TSystemUpdateMethod = (dt?: number) => void;
const dummyUpdateMethod: TSystemUpdateMethod = (dt?: number) => {};

type TEntitiesList = IEntity[];
type TEntitiesListMap = { [key: string]: TEntitiesList };
type TEntities = TEntitiesListMap | TEntitiesList;

export class System {
  public enabled: boolean = true;
  private _engine!: Engine;

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
  requirements: TEntityRequirements = null;
  // TODO add requirements change handler

  protected entities: TEntities = [];

  private _entitiesInitialized: boolean = false;

  initialize () {
    this._initEntities();
  }

  /**
   * Called from `Engine.prototype.addSystem` method
   */
  private _initEntities () {
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

  update: TSystemUpdateMethod = dummyUpdateMethod;

  private _testFunctionCache: Array<[Array<TEntityRequirementConstraint>, TEntityPredicate]> = [];

  getTestFunction (componentList: TEntityRequirementList = []): TEntityPredicate {
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
    }).filter((x): x is TEntityRequirementPredicate => !!x);

    const testFn: TEntityPredicate = (entity: IEntity) => {
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

  isEntityMeetsRequirements (entity: IEntity, requirements: TEntityRequirementList) {
    const testFunction = this.getTestFunction(requirements);
    return testFunction?.(entity);
  }

  private static _entitiesIsListMap (requirements: TEntityRequirements, entities: TEntities)
    : entities is TEntitiesListMap {
    return !(requirements instanceof Array);
  }

  addEntity (entity: IEntity, collectionName: string | null = null) {
    if (System._entitiesIsListMap(this.requirements, this.entities)) {
      if (typeof collectionName === 'string') {
        this.entities[collectionName].push(entity);
      } else {
        throw new Error('Collection name is not specified.');
      }
    } else {
      this.entities.push(entity);
    }
  }

  // TODO Should it return whole map if no collectionName provided?
  getEntities<T extends IEntity = IEntity> (collectionName?: string): Array<T> {
    if (!this.requirements && this._engine) {
      return this._engine.entities as Array<T>;
    }

    if (typeof collectionName === 'string') {
      if (System._entitiesIsListMap(this.requirements, this.entities)) {
        return this.entities[collectionName] as Array<T>;
      }

      throw new Error(`System has a single collection.`);
    }

    return this.entities as Array<T>;
  }

  getEntity <T extends IEntity> (collectionName?: string): T | void {
    const entities = this.getEntities<T>(collectionName);
    if (entities) {
      return entities[0];
    }
  }

  /**
   * Used to iterate through all collections
   */
  getAllEntityCollections (): Array<Array<IEntity>> {
    if (this.entities instanceof Array) {
      return [this.entities]; // ?
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

export const isSystem = (system: any) : system is System => {
  return system instanceof System;
};

// TODO move out to file
/**
 * Used for simplified handler declaration via engine.add()
 */
export class SimplifiedSystem extends System {
  private _updateHandler: TSystemUpdateMethod = dummyUpdateMethod;

  constructor (update: TSystemUpdateMethod, requirements: TEntityRequirements = null) {
    super();
    this._updateHandler = update;
    this.requirements = requirements;
  }

  update = (dt?: number) => {
    this._updateHandler(dt);
  }
}
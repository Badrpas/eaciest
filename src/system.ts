import { IEntity } from "./entity";
import { Engine } from "./engine";
import { logger } from './auxiliary';

export type TEntityPredicate = (entity: IEntity) => boolean;

export type TEntityRequirementPredicate = TEntityPredicate;
export type TEntityRequirementConstraint = string | TEntityRequirementPredicate;
export type TEntityRequirementList = Array<TEntityRequirementConstraint>;

export type TEntityRequirements = TEntityRequirementList
  | { [key: string]: TEntityRequirementList }
  | null;


export type TEntitiesList = Set<IEntity>;
export type TEntitiesListMap = { [key: string]: TEntitiesList };
export type TEntityStore = TEntitiesListMap | TEntitiesList;

export type TEntities = Iterable<IEntity> | { [key: string]: Iterable<IEntity> };

export type TSystemUpdateMethod = (dt?: number) => void;

export const dummyUpdateMethod: TSystemUpdateMethod = (dt?: number) => {};

export class System {
  public enabled: boolean = true;
  private _engine!: Engine;

  public priority = 5;

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

  protected _entityStore!: TEntityStore;
  private _entityProxy?: TEntitiesListMap;

  private _initEntityProxy () {
    if (System._requirementsIsList(this.requirements)) {
      // @ts-ignore
      this._entityProxy = null;
      return;
    }
    if (!this._entityStore) {
      return;
    }
    return new Proxy(this._entityStore, {
      get: (target: TEntityStore, p: string, receiver: any): any => {
        return this.getEntities(p);
      }
    });
  }

  public get entities(): TEntities {
    if (System._requirementsIsList(this.requirements)) {
      return this.getEntities();
    }

    if (!this._entityProxy) {
      this._initEntityProxy();
    }

    if (this._entityProxy) {
      return this._entityProxy;
    }

    return [];
  }

  private _entitiesInitialized: boolean = false;

  constructor (requirements: TEntityRequirements = null) {
    if (requirements) {
      this.requirements = requirements;
    }
  }

  /**
   * Called from `Engine.prototype.addSystem` method
   */
  initialize () {
    this._initEntities();
  }

  private _initEntities () {
    if (this._entitiesInitialized) {
      return;
    }
    this._entitiesInitialized = true;

    if (this.requirements === null) {
      return;
    }

    if (!System._requirementsIsList(this.requirements)) {
      this._entityStore = {};
      for (const key of Object.keys(this.requirements)) {
        this._entityStore[key] = new Set<IEntity>();
      }
    } else {
      this._entityStore = new Set<IEntity>();
    }
  }

  setEngine (engine: Engine) {
    this._engine = engine;
  }

  getEngine (): Engine {
    return this._engine;
  }

  update (dt?: number) {
  };

  private _testFunctionCache: Map<Array<TEntityRequirementConstraint>, TEntityPredicate>
                        = new Map<Array<TEntityRequirementConstraint>, TEntityPredicate>();

  private _getTestFunction (requirementList: TEntityRequirementList = []): TEntityPredicate {
    const cacheEntry = this._testFunctionCache.get(requirementList);

    if (cacheEntry) {
      return cacheEntry;
    }

    const tests = requirementList.map(predicate => {
      if (typeof predicate === 'string') {
        return (entity: IEntity) => predicate in entity;
      } else if (typeof predicate === 'function') {
        return predicate;
      }
    }).filter((x): x is TEntityRequirementPredicate => !!x);

    const testFn: TEntityPredicate = (entity: IEntity) => {
      return tests.every(test => test(entity));
    };

    this._testFunctionCache.set(requirementList, testFn);

    return testFn;
  }

  /**
   * Checks entity for eligibility for the system
   * @param entity
   */
  refreshEntityStatus = (entity: IEntity): void => {
    const { requirements } = this;
    if (requirements === null) {
      return;
    }

    // Single collection
    if (System._requirementsIsList(requirements) && System._entitiesIsList(requirements, this._entityStore)) {

      if (this._isEntityMeetsRequirementList(entity, requirements)) {
        this.addEntity(entity);
      } else {
        this.removeEntity(entity);
      }

    } else if (typeof requirements === 'object') { // Collections map

      for (const [collectionName, requirement] of Object.entries(requirements)) {

        if (!System._requirementsIsList(requirement)) {
          logger.warn(`Wrong requirement "${collectionName}":`, requirement, 'in', this);

          continue;
        }

        if (this._isEntityMeetsRequirementList(entity, requirement)) {
          this.addEntity(entity, collectionName);
        } else {
          this.removeEntity(entity, collectionName);
        }

      }
    } else {
      throw new Error(`Incorrect requirements type. Expected Array or Object got ${typeof requirements}`);
    }
  };

  private _isEntityMeetsRequirementList (entity: IEntity, requirementList: TEntityRequirementList): boolean {
    const testFunction = this._getTestFunction(requirementList);
    return testFunction?.(entity);
  }

  private static _entitiesIsList (requirements: TEntityRequirements, entities: TEntityStore)
    : entities is TEntitiesList {
    return this._requirementsIsList(requirements);
  }

  private static _requirementsIsList (requirements: TEntityRequirements)
    : requirements is TEntityRequirementList {
    return requirements instanceof Array;
  }

  addEntity (entity: IEntity, collectionName: string | null = null) {
    if (!System._entitiesIsList(this.requirements, this._entityStore)) {
      if (typeof collectionName === 'string') {
        this._entityStore[collectionName].add(entity);
      } else {
        throw new Error('Collection name is not specified.');
      }
    } else {
      this._entityStore.add(entity);
    }
  }

  getEntities<T extends IEntity = IEntity> (collectionName?: string): Iterable<T> {
    if (!this.requirements && this._engine) {
      return this._engine.entities.values() as Iterable<T>;
    }

    if (typeof collectionName === 'string') {
      if (!System._entitiesIsList(this.requirements, this._entityStore)) {
        return this._entityStore[collectionName] as Iterable<T>;
      }

      throw new Error(`System has a single collection.`);
    }

    return this._entityStore as Iterable<T>;
  }

  getEntity<T extends IEntity> (collectionName?: string): T | void {
    const entities = this.getEntities<T>(collectionName);
    if (entities) {
      const iterator = entities[Symbol.iterator]?.();
      return iterator?.next()?.value;
    }
  }

  /**
   * Used to iterate through all collections
   */
  getAllEntityCollections (): Array<TEntitiesList> {
    if (!this._entityStore) {
      return [];
    }
    if (System._entitiesIsList(this.requirements, this._entityStore)) {
      return [this._entityStore];
    } else { // collection map
      return Object.values(this._entityStore);
    }
  }

  isQualifiedForUpdate(): boolean {
    if (!this._entityStore) {
      return true; // Systems without requirements are `global`
    }

    if (System._entitiesIsList(this.requirements, this._entityStore)) {
      return !!this._entityStore.size;
    } else { // collection map
      for (const list of Object.values(this._entityStore)) {
        if (list.size) {
          return true;
        }
      }
      return false;
    }
  }

  removeEntity (entity: IEntity, collectionName?: string): boolean {
    // Remove one specific
    if (typeof collectionName === 'string') {
      if (!System._entitiesIsList(this.requirements, this._entityStore)) {
        const store = this._entityStore[collectionName];
        if (store.has(entity)) {
          store.delete(entity);
          return true;
        }
        return false;
      }

      throw new Error('Tried to access entity list with a key but its a single collection');
    }

    let wasInSystem = false;
    // Remove from all collections
    for (const collection of this.getAllEntityCollections()) {
      wasInSystem = wasInSystem || collection.has(entity);
      collection.delete(entity);
    }
    return wasInSystem;
  }
}

export const isSystem = (system: any): system is System => {
  return system instanceof System;
};

// TODO move to file
/**
 * Used for simplified handler declaration via engine.add()
 */
export class SimplifiedSystem extends System {
  private _updateHandler: TSystemUpdateMethod = dummyUpdateMethod;

  constructor (update: TSystemUpdateMethod, requirements: TEntityRequirements = null) {
    super(requirements);
    this._updateHandler = update;
    this.requirements = requirements;
    this.update = this.update.bind(this);
  }

  update (dt?: number) {
    this._updateHandler(dt);
  }
}
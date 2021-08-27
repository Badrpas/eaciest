import { DELETED_PROPS, IEntity, TPropKey } from "./entity";
import { Engine } from "./engine";
import { logger } from './auxiliary';

export type TEntityPredicate = (entity: IEntity) => boolean;

export type TEntityRequirementPredicate = TEntityPredicate;
export type TEntityRequirementConstraint = string | symbol | TEntityRequirementPredicate;
export type TEntityRequirementList = Array<TEntityRequirementConstraint>;

export type TEntityRequirements = TEntityRequirementList
  | Record<string, TEntityRequirementList>
  | null;
export type TEntityRequirementListCandidate = TEntityRequirementList | TEntityRequirementConstraint
export type TEntityRequirementsCandidate = TEntityRequirementListCandidate
  | Record<string, TEntityRequirementListCandidate>
  | null;

export type TEntitiesList = Set<IEntity>;
export type TEntitiesListMap = Record<string, TEntitiesList>;
export type TEntityStore = TEntitiesListMap | TEntitiesList;

export type TEntities = Iterable<IEntity> | Record<string, Iterable<IEntity>>;

export class System {
  public enabled: boolean = true;
  private _engine!: Engine;

  public priority = 5;

  /**
   * Defines list(s) of entities with required components.
   * For example:
   * ```js
   * [ 'componentName1', 'componentName2' ]
   * ```
   *
   * results in array of entities which
   * have componentName1 and componentName2 components in them
   *
   * ```js
   * {
   *   entityList1: [ 'componentName1', 'componentName2' ],
   *   entityList2: [ 'componentName3' ]
   * }
   * ```
   *
   * Such requirement will produce an object with
   * two independent lists:
   * ```js
   * {
   *   entityList1: [entity1, entity2, ...]
   *   entityList2: [...]
   * }
   * ```
   *
   * You can also pass a `function` instead of `string`/`symbol`
   * to add custom selector logic.
   * Be aware: runtime checks are performed only if entity was marked as changed.
   *
   * Passing a single value will wrap it into an array.
   * For example:
   * ```js
   * 'componentName1'
   * ```
   * Transforms into
   * ```js
   * ['componentName`]
   * ```
   */
  get requirements (): TEntityRequirements {
    return this._requirements;
  }
  set requirements (value: TEntityRequirements) {
    this.setRequirements(value);
  }
  private _requirements: TEntityRequirements = null;

  setRequirements (value: TEntityRequirementsCandidate) {
    if (!value) {
      this._requirements = null;
      return;
    }
    if (typeof value === 'string' || typeof value === 'symbol' || typeof value === 'function') {
      this._requirements = [value];
      return;
    }
    if (value instanceof Array) {
      this._requirements = value;
      return;
    }

    value = <{ [key: string]: TEntityRequirementListCandidate }>value;

    for (const [key, constr] of Object.entries(value)) {
      if (typeof constr === 'string' || typeof constr === 'symbol' || typeof constr === 'function') {
        value[key] = [constr];
      }
    }

    this._requirements = <Record<string, TEntityRequirementList>>value;
  }

  protected _entityStore!: TEntityStore;
  private _entityProxy?: TEntitiesListMap;

  private _initEntityProxy () {
    if (System.EntitiesIsList(this._requirements, this._entityStore)) {
      // @ts-ignore
      this._entityProxy = null;
      return;
    } //else {
    if (!this._entityStore) {
      return;
    }


    this._entityProxy = new Proxy<TEntitiesListMap>(this._entityStore, {
      get: (target: TEntityStore, p: string, receiver: any): any => {
        return this.getEntities(p);
      }
    });

    return this._entityProxy;
  }

  public get entities(): TEntities {
    if (System.RequirementsIsList(this._requirements)) {
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

  constructor (requirements: TEntityRequirementsCandidate = null, ...tail: any[]) {
    if (tail.length) {
      logger.warn(`System doesn't expect multiple arguments. For multi-component query - group components in array.\nextra args:`, tail);
    }
    if (requirements) {
      this.setRequirements(requirements);
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

    if (this._requirements === null) {
      return;
    }

    if (!System.RequirementsIsList(this._requirements)) {
      this._entityStore = {};
      for (const key of Object.keys(this._requirements)) {
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

  private _testFunctionCache = new Map<Array<TEntityRequirementConstraint>, TEntityPredicate>();

  private _getTestFunction (requirementList: TEntityRequirementList = []): TEntityPredicate {
    const cacheEntry = this._testFunctionCache.get(requirementList);

    if (cacheEntry) {
      return cacheEntry;
    }

    const tests = requirementList.map(predicate => {
      if (typeof predicate === 'string' || typeof predicate === 'symbol') {
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
   * Adds or removes it from system's entity list.
   * @param entity
   */
  refreshEntityStatus (entity: IEntity): void {
    const { _requirements } = this;
    if (_requirements === null) {
      return;
    }

    // Single collection
    if (System.RequirementsIsList(_requirements) && System.EntitiesIsList(_requirements, this._entityStore)) {

      if (this.isEntityMeetsRequirementList(entity, _requirements)) {
        this.addEntity(entity);
      } else {
        this.removeEntity(entity);
      }

    } else if (typeof _requirements === 'object') { // Collections map

      for (const [collectionName, requirement] of Object.entries(_requirements)) {

        if (!System.RequirementsIsList(requirement)) {
          logger.warn(`Wrong requirement "${collectionName}":`, requirement, 'in', this);

          continue;
        }

        if (this.isEntityMeetsRequirementList(entity, requirement)) {
          this.addEntity(entity, collectionName);
        } else {
          this.removeEntity(entity, collectionName);
        }

      }
    } else {
      throw new Error(`Incorrect requirements type. Expected Array or Object got ${typeof _requirements}`);
    }
  };

  isEntityMeetsRequirementList (entity: IEntity, requirementList: TEntityRequirementList): boolean {
    const testFunction = this._getTestFunction(requirementList);
    return testFunction?.(entity);
  }

  public static EntitiesIsList (requirements: TEntityRequirements, entities: TEntityStore)
    : entities is TEntitiesList {
    return this.RequirementsIsList(requirements);
  }

  entitiesIsList (entities: TEntityStore) : entities is TEntitiesList {
    return System.EntitiesIsList(this.requirements, entities);
  }

  public static RequirementsIsList (requirements: TEntityRequirements)
    : requirements is TEntityRequirementList {
    return requirements instanceof Array;
  }


  addEntity (entity: IEntity, collectionName?: string) {
    if (!System.EntitiesIsList(this._requirements, this._entityStore)) {
      if (typeof collectionName === 'string') {
        const collection = this._entityStore[collectionName];
        if (!collection.has(entity)) {
          collection.add(entity);
          this.onEntityAdded(entity, collectionName);
        }
      } else {
        throw new Error('Collection name is not specified.');
      }
    } else {
      const collection = this._entityStore;
      if (!collection.has(entity)) {
        collection.add(entity);
        this.onEntityAdded(entity);
      }
    }
  }

  /**@virtual*/ onEntityAdded (entity: IEntity, collectionName?: string) {}

  getEntities<T> (collectionName?: string): Iterable<T & IEntity> {
    if (!this._requirements && this._engine) {
      return <Iterable<T & IEntity>>this._engine.entities.values();
    }

    if (typeof collectionName === 'string') {
      if (!System.EntitiesIsList(this._requirements, this._entityStore)) {
        return <Iterable<T & IEntity>>this._entityStore[collectionName];
      }

      throw new Error(`System has a single collection.`);
    }

    return <Iterable<T & IEntity>>this._entityStore;
  }

  /**
   * Convenience method for retrieving a single (first) entity
   */
  getEntity<T> (collectionName?: string): T & IEntity | void {
    const entities = this.getEntities<T>(collectionName);
    if (entities) {
      const iterator = entities[Symbol.iterator]?.();
      return iterator?.next()?.value;
    }
  }

  /**
   * Used for iteration through all collections
   */
  *getAllEntityCollections (): Iterable<TEntitiesList> {
    if (!this._entityStore) {
      return;
    }
    if (System.EntitiesIsList(this._requirements, this._entityStore)) {
      yield this._entityStore;
    } else { // collection map
      yield* Object.values(this._entityStore);
    }
  }

  /**
   * Used to determine if the system should be update by Engine
   */
  isQualifiedForUpdate(): boolean {
    if (!this._entityStore) {
      return true; // Systems without requirements are `global`
    }

    if (System.EntitiesIsList(this._requirements, this._entityStore)) {
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
    // Remove from a specific collection
    if (typeof collectionName === 'string') {
      if (!System.EntitiesIsList(this._requirements, this._entityStore)) {
        const store = this._entityStore[collectionName];
        if (store.has(entity)) {
          store.delete(entity);
          this.onEntityRemoved(entity, entity[DELETED_PROPS], collectionName);
          return true;
        }
        return false;
      }

      throw new Error('Tried to access entity list with a key but its a single collection');
    }

    // Remove from all collections otherwise

    if (System.EntitiesIsList(this.requirements, this._entityStore)) {
      if (!this._entityStore.has(entity)) return false;

      this._entityStore.delete(entity);
      this.onEntityRemoved(entity, entity[DELETED_PROPS]);

      return true;
    }

    let wasInSystem = false;

    for (const [collectionName, collection] of Object.entries(this._entityStore)) {
      if (!collection.has(entity)) continue;

      collection.delete(entity);
      wasInSystem = true;
      this.onEntityRemoved(entity, entity[DELETED_PROPS], collectionName);
    }

    return wasInSystem;
  }


  /**
   * In case complete entity removal (i.e.: entity removed from Engine) collectionName is not passed
   */
  /**@virtual*/ onEntityRemoved (entity: IEntity, deletedComponents: Map<TPropKey, any>, collectionName?: string) {

  }

  getComponentFrom (entity: IEntity, key: TPropKey): any {
    // @ts-ignore
    return entity[key] || entity[DELETED_PROPS].get(key);
  }
}

export const isSystem = (system: any): system is System => {
  return system instanceof System;
};


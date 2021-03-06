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

export type TSystemUpdateMethod = (dt?: number) => void;

export const dummyUpdateMethod: TSystemUpdateMethod = (dt?: number) => {};

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
    if (System._entitiesIsList(this._requirements, this._entityStore)) {
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
    if (System._requirementsIsList(this._requirements)) {
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

  constructor (requirements: TEntityRequirementsCandidate = null) {
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

    if (!System._requirementsIsList(this._requirements)) {
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
  refreshEntityStatus = (entity: IEntity): void => {
    const { _requirements } = this;
    if (_requirements === null) {
      return;
    }

    // Single collection
    if (System._requirementsIsList(_requirements) && System._entitiesIsList(_requirements, this._entityStore)) {

      if (this._isEntityMeetsRequirementList(entity, _requirements)) {
        this.addEntity(entity);
      } else {
        this.removeEntity(entity);
      }

    } else if (typeof _requirements === 'object') { // Collections map

      for (const [collectionName, requirement] of Object.entries(_requirements)) {

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
      throw new Error(`Incorrect requirements type. Expected Array or Object got ${typeof _requirements}`);
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
    if (!System._entitiesIsList(this._requirements, this._entityStore)) {
      if (typeof collectionName === 'string') {
        this._entityStore[collectionName].add(entity);
      } else {
        throw new Error('Collection name is not specified.');
      }
    } else {
      this._entityStore.add(entity);
    }
  }

  getEntities<T> (collectionName?: string): Iterable<T & IEntity> {
    if (!this._requirements && this._engine) {
      return <Iterable<T & IEntity>>this._engine.entities.values();
    }

    if (typeof collectionName === 'string') {
      if (!System._entitiesIsList(this._requirements, this._entityStore)) {
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
    if (System._entitiesIsList(this._requirements, this._entityStore)) {
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

    if (System._entitiesIsList(this._requirements, this._entityStore)) {
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
      if (!System._entitiesIsList(this._requirements, this._entityStore)) {
        const store = this._entityStore[collectionName];
        if (store.has(entity)) {
          store.delete(entity);
          this.onEntityRemoved(entity, entity[DELETED_PROPS]);
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
    if (wasInSystem) {
      this.onEntityRemoved(entity, entity[DELETED_PROPS]);
    }
    return wasInSystem;
  }

  /* override */ onEntityRemoved (entity: IEntity, deletedComponents: Map<TPropKey, any>) {

  }

  getComponentFrom(entity: IEntity, key: TPropKey): any {
    // @ts-ignore
    return entity[key] || entity[DELETED_PROPS].get(key);
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
  }

  update = (dt?: number) => {
    this._updateHandler(dt);
  }
}

import { DELETED_PROPS, IEntity, TPropKey } from "./entity";
import { Engine } from "./engine";
import { logger } from './auxiliary';

export type TEntityPredicate = (entity: IEntity) => boolean;

export type TEntityRequirementPredicate = TEntityPredicate;
export type TEntityRequirementConstraint = string | symbol | TEntityRequirementPredicate;
export type TEntityRequirementList = Array<TEntityRequirementConstraint>;

export type TEntityRequirements = Record<string, TEntityRequirementList> | null;

export type TEntitiesList = Set<IEntity>;
export type TEntityStore = Record<string, TEntitiesList>;

export type TEntities = Record<string, Iterable<IEntity>>;

export class System<T extends {[key: string]: any}> {
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

  setRequirements (value: TEntityRequirements) {
    if (!value) {
      this._requirements = null;
      return;
    }

    for (const [key, constr] of Object.entries(value)) {
      if (typeof constr === 'string' || typeof constr === 'symbol' || typeof constr === 'function') {
        value[key] = [constr];
      }
    }

    this._requirements = value;
  }

  protected _entityStore!: TEntityStore;
  private _entityProxy?: TEntityStore;

  private _initEntityProxy () {
    if (!this._entityStore) {
      return;
    }

    this._entityProxy = new Proxy<TEntityStore>(this._entityStore, {
      get: (_target: TEntityStore, p: string, _receiver: any): any => {
        return this.getEntities(p);
      }
    });

    return this._entityProxy;
  }

  public get entities(): TEntities {
    if (!this._entityProxy) {
      this._initEntityProxy();
    }

    return this._entityProxy!;
  }

  private _entitiesInitialized: boolean = false;

  constructor (requirements: TEntityRequirements = null, ...tail: any[]) {
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

    this._entityStore = {};
    for (const key of Object.keys(this._requirements)) {
      this._entityStore[key] = new Set<IEntity>();
    }
  }

  setEngine (engine: Engine) {
    this._engine = engine;
  }

  getEngine (): Engine {
    return this._engine;
  }

  update (dt: number) {};

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

    for (const [collectionName, requirement] of Object.entries(_requirements)) {
      if (this.isEntityMeetsRequirementList(entity, requirement)) {
        this.addEntity(entity, collectionName);
      } else {
        this.removeEntity(entity, collectionName);
      }
    }
  };

  isEntityMeetsRequirementList (entity: IEntity, requirementList: TEntityRequirementList): boolean {
    const testFunction = this._getTestFunction(requirementList);
    return testFunction?.(entity);
  }

  addEntity (entity: IEntity, collectionName?: string) {
    if (typeof collectionName === 'string') {
      const collection = this._entityStore[collectionName];
      if (!collection.has(entity)) {
        collection.add(entity);
        this.onEntityAdded(entity, collectionName);
      }
    } else {
      throw new Error('Collection name is not specified.');
    }
  }

  onEntityAdded (entity: IEntity, collectionName: string) {}

  getEntities<T> (collectionName = 'default'): Iterable<T & IEntity> {
    if (!this._requirements && this._engine) {
      return <Iterable<T & IEntity>>this._engine.entities.values();
    }

    if (typeof this._entityStore[collectionName] != undefined) {
      return <Iterable<T & IEntity>>this._entityStore[collectionName];
    }

    throw new Error(`Couldn't get entity collection "${collectionName}"`);
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
    yield* Object.values(this._entityStore);
  }

  /**
   * Used to determine if the system should be update by Engine next tick
   */
  isQualifiedForUpdate(): boolean {
    if (!this._entityStore) {
      return true; // Systems without requirements are `global`
    }

    for (const list of Object.values(this._entityStore)) {
      if (list.size) {
        return true;
      }
    }
    return false;
  }

  removeEntity (entity: IEntity, collectionName?: string): boolean {
    if (!this._entityStore) {
      return false;
    }

    // Remove from a specific collection
    if (typeof collectionName === 'string') {
      const store = this._entityStore[collectionName];
      if (store.has(entity)) {
        store.delete(entity);
        this.onEntityRemoved(entity, entity[DELETED_PROPS], collectionName);
        return true;
      }
      return false;
    }

    // Remove from all collections otherwise

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
  onEntityRemoved (entity: IEntity, deletedComponents: Map<TPropKey, any>, collectionName?: string) {

  }

  getComponentFrom (entity: IEntity, key: TPropKey): any {
    // @ts-ignore
    return entity[key] || entity[DELETED_PROPS].get(key);
  }

}

export const isSystem = (system: any): system is System => {
  return system instanceof System;
};


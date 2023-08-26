import { Engine } from './engine';


export const ENTITY_ID = Symbol.for('Entity ID');
// Use to bypass proxy for easier debugging in dev tools
export const SRC_OBJECT = Symbol.for('SOURCE OBJECT');
export const ENGINE = Symbol.for('Engine');
export const PROXY = Symbol.for('Entity Proxy');
export const ADDED_PROPS = Symbol.for('Array of newly added components (properties)');
export const CHANGED_PROPS = Symbol.for('Map of changed components previous value');
export const DELETED_PROPS = Symbol.for('Map of removed components (properties)');

export interface IEntityProjection {
  [key: string]: any;
  [PROXY]?: IEntity;
  [ENTITY_ID]?: number;
}

export interface IEntity extends IEntityProjection {
  [ENGINE]: Engine;
  [PROXY]: IEntity;
  [SRC_OBJECT]?: IEntityProjection;
  [ADDED_PROPS]?: TPropKey[];
  [CHANGED_PROPS]?: Map<TPropKey, any>;
  [DELETED_PROPS]: Map<TPropKey, any>;
}

export type TPropKey = string | number | symbol;

const IGNORED_SYMBOLS = [ENGINE, PROXY, SRC_OBJECT] as const;

export const EntityProxyHandler: ProxyHandler<IEntity> = {
  set (entity: IEntity, prop: TPropKey, value: any): boolean {
    const engine = entity[ENGINE];
    const voidToDelete = engine?.options.deleteVoidProps;
    const needDelete = voidToDelete && typeof value === 'undefined';
    if (needDelete) {
      // @ts-ignore
      return this.deleteProperty(entity, prop);
    }

    // We should trigger update when new property added
    const isIgnoredSymbol = typeof prop === 'symbol' && IGNORED_SYMBOLS.some(x => x === prop);
    const isNewProp = !(prop in entity);
    const needUpdate = !isIgnoredSymbol && (isNewProp || engine?.isWatchedProperty(prop));
    if (!isIgnoredSymbol && isNewProp) {
      const addedPropsList = entity[ADDED_PROPS] ||= [];
      addedPropsList.push(prop);
    }
    if (needUpdate) {
      const changedPropsMap = entity[CHANGED_PROPS] ||= new Map;
      changedPropsMap.set(prop, Reflect.get(entity, prop));
    }

    Reflect.set(entity, prop, value);

    if (needUpdate) {
      engine?._markEntityChanged(entity);
    }

    return true;
  },

  deleteProperty (entity: IEntity, prop: TPropKey): boolean {
    // @ts-ignore
    entity[DELETED_PROPS].set(prop, entity[prop]);
    // @ts-ignore
    delete entity[prop];
    entity[ENGINE]?._markEntityChanged(entity);

    return true;
  }
};

/**
 * Ensures that entity is proxified
 */
export const getEntity = (candidate: IEntity | IEntityProjection): IEntity => {
  if (isEntity(candidate)) {
    return candidate;
  } else if (isEntityProjection(candidate)) {
    return candidate[PROXY];
  }

  // const entity: IEntity = { ...candidate } as IEntity;
  const entity: IEntity = candidate as IEntity;

  const proxy = new Proxy(entity, EntityProxyHandler);

  entity[PROXY] = proxy;
  entity[DELETED_PROPS] = new Map();
  entity[ADDED_PROPS] = Object.keys(candidate);

  return proxy;
};

export const isEntityProjection = (entity?: IEntityProjection): entity is IEntity => {
  if (!entity) return false;

  return PROXY in entity && (entity[PROXY] !== entity);
};

export const isEntity = (entity?: IEntity | IEntityProjection ): entity is IEntity => {
  if (!entity) {
    return false;
  }

  return PROXY in entity && (entity[PROXY] === entity);
};

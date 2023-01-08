import { Engine } from './engine';


export const ENTITY_ID = Symbol.for('Entity ID');
export const ENGINE = Symbol.for('Engine');
export const PROXY = Symbol.for('Entity Proxy');
export const DELETED_PROPS = Symbol.for('Contains removed components (properties)');
export const CHANGED_PROPS = Symbol.for('Contains changed components');

export interface IEntityProjection {
  [key: string]: any;
  [PROXY]?: IEntity;
  [ENTITY_ID]?: number;
}

export interface IEntity extends IEntityProjection {
  [ENGINE]: Engine;
  [PROXY]: IEntity;
  [DELETED_PROPS]: Map<TPropKey, any>;
  [CHANGED_PROPS]: Map<TPropKey, any>;
}

export type TPropKey = string | number | symbol;

const IGNORED_SYMBOLS = [ENGINE, PROXY] as const;

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
    const needUpdate = !isIgnoredSymbol && (engine?.isWatchedProperty(prop) || !(prop in entity));
    if (needUpdate) {
      Reflect.set(entity, CHANGED_PROPS, value);
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

import { Engine } from './engine';

export const ENGINE = Symbol('Engine (World)');
export const PROXY = Symbol('Is Entity proxied by handlers');

export interface IEntityProjection {
  [key: string]: any
  [PROXY]?: IEntity
}

export interface IEntity extends IEntityProjection {
  [ENGINE]: Engine
  [PROXY]: IEntity
}

type PropKey = string | number | symbol;

const IGNORED_SYMBOLS = [ENGINE, PROXY] as const;

export const EntityProxyHandler: ProxyHandler<IEntity> = {
  set (entity: IEntity, prop: PropKey, value: any): boolean {
    // We should trigger update when new property added
    const isIgnoredSymbol = typeof prop === 'symbol' && IGNORED_SYMBOLS.some(x => x === prop);
    const needUpdate = !isIgnoredSymbol && !(prop in entity);

    Reflect.set(entity, prop, value);

    if (needUpdate) {
      const engine = entity[ENGINE];
      engine?._markEntityChanged(entity);
    }

    return true;
  },

  deleteProperty (entity: IEntity, prop: PropKey): boolean {
    // @ts-ignore
    delete entity[prop];
    entity[ENGINE]?.refreshEntity(entity);
    return true;
  }
};

/**
 *
 * @param candidate
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
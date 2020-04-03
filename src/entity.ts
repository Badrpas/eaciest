import { Engine } from './engine';

export const ENGINE = Symbol('Engine (World)');
export const IS_PROXIED = Symbol('Is Entity proxied by handlers');

export interface IEntityProjection {
  [key: string]: any
}

export interface IEntity extends IEntityProjection {
  [ENGINE]?: Engine
  [IS_PROXIED]: boolean
}

type PropKey = string | number | symbol;

const IGNORED_SYMBOLS = [ENGINE, IS_PROXIED] as const;

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

export const getEntity = (candidate: IEntity | IEntityProjection): IEntity => {
  if (isEntity(candidate)) {
    return candidate;
  }

  const entity = { ...candidate, [IS_PROXIED]: true };

  return new Proxy(entity, EntityProxyHandler);
};

export const isEntity = (entity?: IEntity | IEntityProjection ): entity is IEntity => {
  if (!entity) {
    return false;
  }

  return IS_PROXIED in entity;
};
import { Engine } from './engine';

export const ENGINE_SYMBOL = Symbol('Engine (World)');
export const IS_PROXIED_SYMBOL = Symbol('Is Entity proxied by handlers');

export interface IEntity {
  [key: string]: any,

  [ENGINE_SYMBOL]?: Engine
  [IS_PROXIED_SYMBOL]?: boolean
}

type PropKey = string | number | symbol;

const IGNORED_SYMBOLS = [ENGINE_SYMBOL, IS_PROXIED_SYMBOL] as const;

export const EntityProxyHandler: ProxyHandler<IEntity> = {
  set (entity: IEntity, prop: PropKey, value: any): boolean {
    // We should trigger update when new property added
    const isIgnoredSymbol = typeof prop === 'symbol' && IGNORED_SYMBOLS.some(x => x === prop);
    const needUpdate = !isIgnoredSymbol && !(prop in entity);

    Reflect.set(entity, prop, value);

    if (needUpdate) {
      const engine = entity[ENGINE_SYMBOL];
      engine?.markEntityChanged(entity);
    }

    return true;
  },

  deleteProperty (entity: IEntity, prop: PropKey): boolean {
    // @ts-ignore
    delete entity[prop];
    entity[ENGINE_SYMBOL]?.refreshEntity(entity);
    return true;
  }
};

export const getProxiedEntity = (entity: IEntity): IEntity => {
  if (entity[IS_PROXIED_SYMBOL]) {
    return entity;
  }

  return Object.assign(new Proxy(entity, EntityProxyHandler), {
    [IS_PROXIED_SYMBOL]: true
  });
};


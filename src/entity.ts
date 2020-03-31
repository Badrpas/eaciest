import { Engine } from './engine';

export const ENGINE_SYMBOL = Symbol('Engine (World)');
export const IS_PROXIED_SYMBOL = Symbol('Is Entity proxied by handlers');

export interface IEntity {
  [key: string]: any,
  [ENGINE_SYMBOL]?: Engine
  [IS_PROXIED_SYMBOL]?: boolean
}

type PropKey = string | number | symbol;

export const EntityProxyHandler: ProxyHandler<IEntity> = {
  set (entity: IEntity, prop: PropKey, value: any, receiver: IEntity): boolean {
    const needUpdate = !(prop in entity) && !(typeof prop === 'symbol');

    Reflect.set(entity, prop, value);

    if (needUpdate) {
      entity[ENGINE_SYMBOL]?.updateEntity(entity);
    }

    return true;
  },

  deleteProperty (entity: IEntity, prop: PropKey): boolean {
    // @ts-ignore
    delete entity[prop];
    entity[ENGINE_SYMBOL]?.updateEntity(entity);
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


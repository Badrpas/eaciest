import { IEntity, ENGINE, ENTITY_ID } from './entity';


export const get_engine = (e: IEntity) => {
  return e?.[ENGINE];
};

export const destroy_entity = (e: IEntity) => {
  get_engine(e)?.removeEntity?.(e);
};

export const refresh_entity = (e: IEntity) => {
  get_engine(e)?.refreshEntity(e);
};


export const get_id = <T=number>(e: IEntity): T => {
  return e?.[ENTITY_ID] as unknown as T;
};



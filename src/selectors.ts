import { Engine } from './engine';
import { IEntity, CHANGED_PROPS, ADDED_PROPS, DELETED_PROPS, TPropKey, ENGINE } from './entity';
import { TEntityPredicate, PREDICATE_META, System } from './system';

type PredicateCandidate = string | TEntityPredicate;
const component_to_predicate = (c: PredicateCandidate): TEntityPredicate => {
  if (typeof c === 'function') {
    return c;
  }
  return Object.assign((e: IEntity) => c in e, {
    component: c,
  });
};

const components_to_predicates = (components: PredicateCandidate[]) => {
  return components.map(component_to_predicate);
};

export const not = (component: PredicateCandidate) => {
  const [predicate] = components_to_predicates([component]);
  return (entity: IEntity) => {
    return !predicate(entity);
  };
};

export const or = (...components: PredicateCandidate[]) => {
  const predicates = components_to_predicates(components);
  return (entity: IEntity) => predicates.some(p => p(entity));
};

export const xor = (...components: PredicateCandidate[]) => {
  const predicates = components_to_predicates(components);
  return (entity: IEntity) => {
    let count = 0;
    for (const predicate of predicates) {
      count += +!!(predicate(entity));
    }
    return count === 1;
  };
};

export const and = (...components: PredicateCandidate[]) => {
  const predicates = components_to_predicates(components);
  return (entity: IEntity) => predicates.every(p => p(entity));
};

/** Matches when one of the props is added to entity **/
export const once_added = (...props: string[]) => {
  return Object.assign((e: IEntity) => {
    return props.some(prop => e[ADDED_PROPS]?.includes(prop));
  }, {
    [PREDICATE_META]: (system: System) => {
      const engine = system.getEngine();
      for (const prop of props) {
        engine.addWatchedProperty(prop);
      }
      add_cleanup(engine, ReactiveCleanupSystem);
    },
  });
};

/** Matches when one of the props is changed on entity **/
export const once_changed = (...props: string[]) => {
  return Object.assign((e: IEntity) => {
    return props.some(prop => e[CHANGED_PROPS]?.has(prop) && e[prop] !== e[CHANGED_PROPS].get(prop));
  }, {
    [PREDICATE_META]: (system: System) => {
      const engine = system.getEngine();
      for (const prop of props) {
        engine.addWatchedProperty(prop);
      }
      add_cleanup(engine, ReactiveCleanupSystem);
    },
  });
};

/** Matches when one of the props is assigned on entity **/
export const once_assigned = (...props: string[]) => {
  return Object.assign((e: IEntity) => {
    return props.some(prop => e[CHANGED_PROPS]?.has(prop))
  }, {
    [PREDICATE_META]: (system: System) => {
      const engine = system.getEngine();
      for (const prop of props) {
        engine.addWatchedProperty(prop);
      }
      add_cleanup(engine, ReactiveCleanupSystem);
    },
  });
};

/** Matches when one of the props is `delete`d from entity **/
export const once_deleted = (...props: string[]) => {
  return Object.assign((e: IEntity) => {
    return props.some(prop => e[DELETED_PROPS]?.has(prop));
  }, {
    [PREDICATE_META]: (system: System) => {
      const engine = system.getEngine();
      for (const prop of props) {
        engine.addWatchedProperty(prop);
      }
      engine.addSystem(new DeletionCleanupSystem(props));
    },
  });
};

class DeletionCleanupSystem extends System {
  public priority: number = Infinity;

  constructor (private props: string[]) {
    const predicate = (deleted_props: Map<TPropKey, any>) => {
      for (const prop of props) {
        if (deleted_props.has(prop)) return true;
      }
      return false;
    };
    super({
      deleted: [e => predicate(e[DELETED_PROPS])],
    });
  }

  update (): void {
    for (const e of this.getEntities('deleted')) {
      for (const prop of this.props) {
        e[DELETED_PROPS].delete(prop);
      }
    }
  }
}

function add_cleanup (engine: Engine, Class: typeof System) {
  try {
    engine.addSystem(get_singleton(Class));
  } catch (error) {
    if (!(error as Error)?.message?.includes('instance already registered')) {
      throw error;
    }
  }
}

const cache = new Map;
function get_singleton(Class: typeof System): System {
  if (!cache.has(Class)) {
    cache.set(Class, new Class);
  }
  return cache.get(Class);
}

class ReactiveCleanupSystem extends System {

  public priority: number = Infinity;

  constructor() {
    super({
      added: [e => !!e[ADDED_PROPS]?.length],
      changed: [e => !!e[CHANGED_PROPS]?.size],
    });
  }

  update(_dt: number): void {
    const engine = this.getEngine();
    for (const e of this.getEntities('added')) {
      e[ADDED_PROPS]?.splice(0, e[ADDED_PROPS]?.length);
      // this.refreshEntityStatus(e);
      engine.refreshEntity(e);
    }
    for (const e of this.getEntities('changed')) {
      e[CHANGED_PROPS]?.clear();
      // this.refreshEntityStatus(e);
      engine.refreshEntity(e);
    }
  }

}


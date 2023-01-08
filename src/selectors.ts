import { IEntity, CHANGED_PROPS } from './entity';
import { TEntityPredicate, PREDICATE_META, System } from './system';

type PredicateCandidate = string|TEntityPredicate;
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

export const on_changed = (...props: string[]) => {
  return Object.assign((e: IEntity) => {
    return props.some(prop => e[CHANGED_PROPS].has(prop));
  }, {
    [PREDICATE_META]: (system: System) => {
      const engine = system.getEngine();
      for (const prop of props) {
        engine.addWatchedProperty(prop);
      }
    },
  });
};


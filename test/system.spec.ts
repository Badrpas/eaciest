import {
  getEntity,
  isSystem,
  System, TEntityRequirements
} from '../src';

describe(`System`, () => {

  describe(`constructor`, () => {
    it(`should assign requirements from argument`, () => {
      const requirements = {q:[ 'qwe' ]};

      const system = new System(requirements);

      expect(system.requirements).toBe(requirements);
    });
  });

  describe(`Initialization`, () => {

    describe(`Entities`, () => {
      const CollectionType = Set;

      it(`should be initialized to collection`, () => {
        const system = new System({q:[ 'qwe' ]});
        system.initialize();

        expect((system as any)._entityStore.q).toBeInstanceOf(CollectionType);
      });

      it(`should be initialized to collections map`, () => {
        const system = new System({ collection: [ 'qwe' ]});
        system.initialize();

        expect((system as any)._entityStore).toEqual({
          collection: expect.any(CollectionType)
        });
        // expect((system as any).entities?.collection).toBeInstanceOf(CollectionType);
      });

      it(`should be empty`, () => {
        let system = new System(null);
        system.initialize();
        expect((system as any).entities).toBeUndefined();

        system = new System();
        system.initialize();
        expect((system as any).entities).toBeUndefined();
      });
    });

  });

  describe(`isSystem()`, () => {
    it(`Base class`, () => {
      const system = new System();

      expect(isSystem(system)).toBe(true);
    });
    it(`Child class`, () => {
      class Child extends System {
        constructor () {
          super();
        }
      }
      const system = new Child();

      expect(isSystem(system)).toBe(true);
    });
    it(`Grandchild class`, () => {
      class Child extends System {
        constructor () {
          super();
        }
      }
      class GrandChild extends Child {}

      const system = new GrandChild();

      expect(isSystem(system)).toBe(true);
    });
    it(`External class`, () => {
      class System {
        requirements: TEntityRequirements;
        constructor (requirements = null) {
          this.requirements = requirements;
        }
      }
      const system = new System();

      expect(isSystem(system)).toBe(false);
    });
  });

  describe(`refreshEntity()`, () => {

    describe(`collection requirement`, () => {

    });

    describe(`collection map requirement`, () => {

    });

    describe(`edge cases`, () => {
      it(`null requirements`, () => {
        const system = new System();
        const entity = getEntity({});

        const pre = (System as any)._requirementsIsList;
        const fn = (System as any)._requirementsIsList = jest.fn();

        system.refreshEntityStatus(entity);

        expect(fn).not.toHaveBeenCalled();
        (System as any)._requirementsIsList = pre;
      });

    });
  });
  
});

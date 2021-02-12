import { System, Engine, IEntity } from '../src';


describe(`Features`, () => {

  it(`minimal example`, () => {
    const engine = new Engine();

    const entity = <IEntity>engine.add({
      location: { x: 100, y: 200 },
      velocity: { x: 2, y: 3 },
    });

    engine.add(function (this: System, dt: number) {
      for (const entity of this.getEntities()) {
        entity.location.x += entity.velocity.x * dt;
        entity.location.y += entity.velocity.y * dt;
      }
    }, ['location', 'velocity']);

    engine.update(2);

    expect(entity.location).toEqual({ x: 104, y: 206 });
  });

});

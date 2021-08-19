# Eaciest `ECSt` ![](https://github.com/Badrpas/eaciest/workflows/Tests/badge.svg) [![codecov](https://codecov.io/gh/Badrpas/eaciest/branch/master/graph/badge.svg)](https://codecov.io/gh/Badrpas/eaciest)
---
TypesScript [ECS](https://en.wikipedia.org/wiki/Entity_component_system) implementation.

Basic usage example:
```js
const { Engine } = require('eaciest');

const engine = new Engine();

// Creates new entity
const entity = engine.addEntity({ 
  location: { x: 100, y: 200 },
  velocity: { x: 2, y: 3 },
});

// Declare a system for location updates
class VelocitySystem extends System {
  constructor () {
    super(['location', 'velocity']);
  }
  
  update (dt) {
    for (const { location, velocity } of this.getEntities()) {
      location.x += velocity.x * dt;
      location.y += velocity.y * dt;
    }
  }
}

// This will instantiate the class and register it for updates
engine.addSystemClass(VelocitySystem);

// Run all systems with dt === 2
engine.update(2);

console.log(entity.location); // { x: 104, y: 206 }

```

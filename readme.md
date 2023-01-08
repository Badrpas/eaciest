# Eaciest `ECSt` ![](https://github.com/Badrpas/eaciest/workflows/Tests/badge.svg) [![codecov](https://codecov.io/gh/Badrpas/eaciest/branch/master/graph/badge.svg)](https://codecov.io/gh/Badrpas/eaciest)
TypesScript [ECS](https://en.wikipedia.org/wiki/Entity_component_system) implementation.

#### Install with

`npm install eaciest` or `yarn add eaciest`

#### Basic usage example
```js
import { Engine, System } from 'eaciest';

const engine = new Engine();

// Declare a system for location updates
class VelocitySystem extends System {
  constructor () {
    // Specify required components (properties) to match againts entities
    super(['location', 'velocity']);
  }
  
  update (dt) {
    for (const { location, velocity } of this.getEntities()) {
      location.x += velocity.x * dt;
      location.y += velocity.y * dt;
    }
  }
}

// Instantiate the class and register it for updates
engine.addSystemClass(VelocitySystem);

// Create new entity with two components
const entity = engine.addEntity({ 
  location: { x: 100, y: 200 },
  velocity: { x: 2, y: 3 },
});

// Run all systems with dt === 2
engine.update(2);

console.log(entity.location); // { x: 104, y: 206 }

```

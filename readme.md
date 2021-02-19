# Eaciest `ECSt` ![](https://github.com/Badrpas/eaciest/workflows/Tests/badge.svg) [![codecov](https://codecov.io/gh/Badrpas/eaciest/branch/master/graph/badge.svg)](https://codecov.io/gh/Badrpas/eaciest)
---
TypesScript [ECS](https://en.wikipedia.org/wiki/Entity_component_system) implementation.

Minimal usage example:
```js
const { Engine } = require('eaciest');

const engine = new Engine();

// Creates new entity
const entity = engine.addEntity({ 
  location: { x: 100, y: 200 },
  velocity: { x: 2, y: 3 },
});

// Adds new function handler system
engine.addHandler(function (dt) {
  for (const entity of this.getEntities()) {
    entity.location.x += entity.velocity.x * dt;
    entity.location.y += entity.velocity.y * dt;
  }
}, ['location', 'velocity']);

// Run all systems with dt === 2
engine.update(2);

console.log(entity.location); // { x: 104, y: 206 }

```


// jsdom has no WebGL. Any test that reaches three.js is testing the wrong
// module — the map3d pure layers (sceneBuilder/geometry3d/theme3d/picking/
// routeScene) are three-free by design. Failing loudly here keeps it that way.
throw new Error(
  'three.js was imported inside a Jest test. The map3d pure modules must not ' +
    'import three — move the logic under test into a pure module instead.',
);

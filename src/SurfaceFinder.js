import * as THREE from "three";

export class SurfaceFinder {
  constructor() {
    this.surfaceId = 0;
  }

  getSurfaceIdAttribute(mesh) {
    const vertexCount = mesh.geometry.attributes.position.count;
    const vertexIdToSurfaceId = this.#generateSurfaceIds(mesh);

    const colors = [];
    for (let i = 0; i < vertexCount; i++) {
      const vertexId = i;
      let surfaceId = vertexIdToSurfaceId[vertexId];

      colors.push(surfaceId, 0, 0, 1);
    }

    const colorsTypedArray = new Float32Array(colors);
    return colorsTypedArray;
  }

  #generateSurfaceIds(mesh) {
    const indexCount = mesh.geometry.index.count;
    const indexBuffer = mesh.geometry.index.array;

    const indexGraph = this.#getIndexGraph(indexCount, indexBuffer);
    return this.#findCycles(indexGraph);
  }

  #getIndexGraph(indexCount, indexBuffer) {
    const indexGraph = {};

    for (let i = 0; i < indexCount; i += 3) {
      const i1 = indexBuffer[i + 0];
      const i2 = indexBuffer[i + 1];
      const i3 = indexBuffer[i + 2];

      addEdge(indexGraph, i1, i2);
      addEdge(indexGraph, i2, i3);
      addEdge(indexGraph, i3, i1);
    }

    return indexGraph;
  }

  #findCycles(indexGraph) {
    const frontierNodes = Object.keys(indexGraph).map((v) => Number(v));
    const exploredNodes = new Set();
    const vertexIdToSurfaceId = {};
    const getNeighborsNonRecursive = (node) => {
      const frontier = [node];
      const explored = new Set();
      const result = [];

      while (frontier.length > 0) {
        const currentNode = frontier.pop();
        if (explored.has(currentNode)) continue;
        const neighbors = indexGraph[currentNode];
        result.push(currentNode);

        explored.add(currentNode);

        for (let n of neighbors) {
          if (!explored.has(n)) {
            frontier.push(n);
          }
        }
      }
      return result;
    };

    while (frontierNodes.length > 0) {
      const node = frontierNodes.pop();
      if (exploredNodes.has(node)) continue;

      // Get all neighbors recursively
      const surfaceVertices = getNeighborsNonRecursive(node);
      // Mark them as explored
      for (let v of surfaceVertices) {
        exploredNodes.add(v);
        vertexIdToSurfaceId[v] = this.surfaceId;
      }

      this.surfaceId += 1;
    }
    return vertexIdToSurfaceId;
  }
}

const addEdge = (graph, a, b) => {
  if (graph[a] == undefined) graph[a] = [];
  if (graph[b] == undefined) graph[b] = [];

  if (graph[a].indexOf(b) == -1) graph[a].push(b);
  if (graph[b].indexOf(a) == -1) graph[b].push(a);
};

export const getSurfaceIdMaterial = () => {
  return new THREE.ShaderMaterial({
    uniforms: {
      maxSurfaceId: { value: 1 },
    },
    vertexShader: getVertexShader(),
    fragmentShader: getFragmentShader(),
    vertexColors: true,
  });
};

const getVertexShader = () => {
  return `
  varying vec2 v_uv;
  varying vec4 vColor;

  void main() {
     v_uv = uv;
     vColor = color;

     gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
  `;
};

const getFragmentShader = () => {
  return `
  varying vec2 v_uv;
  varying vec4 vColor;
  uniform float maxSurfaceId;

  void main() {
    // Normalize the surfaceId when writing to texture
    // Surface ID needs rounding as precision can be lost in perspective correct interpolation 
    // - see https://github.com/OmarShehata/webgl-outlines/issues/9 for other solutions eg. flat interpolation.
    float surfaceId = round(vColor.r) / maxSurfaceId;
    gl_FragColor = vec4(surfaceId, 0.0, 0.0, 1.0);
  }
  `;
};

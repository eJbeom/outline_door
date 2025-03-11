import * as THREE from "three";

export default class SurfaceFinder {
  constructor() {
    this._id = 0;
    this._material = this.#getMaterial();
  }

  get material() {
    return this._material;
  }

  computeColors(mesh) {
    const vertexCount = mesh.geometry.attributes.position.count;
    const vertexIdToSurfaceId = this.#generateSurfaceIds(mesh);

    const colors = new Float32Array(vertexCount * 4);

    for (let i = 0; i < vertexCount; i++) {
      const vertexId = i;
      let surfaceId = vertexIdToSurfaceId[vertexId];

      colors[i * 4] = surfaceId;
      colors[i * 4 + 1] = 0;
      colors[i * 4 + 2] = 0;
      colors[i * 4 + 3] = 1;
    }

    return colors;
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
    const getNeighbors = (node) => {
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
      exploredNodes.add(node);

      // Get all neighbors recursively
      const surfaceVertices = getNeighbors(node);

      // Mark them as explored
      for (let v of surfaceVertices) {
        exploredNodes.add(v);
        vertexIdToSurfaceId[v] = this._id;
      }

      this._id += 1;
    }

    this.material.uniforms.maxSurfaceId.value = this._id;
    return vertexIdToSurfaceId;
  }

  #getMaterial() {
    return new THREE.ShaderMaterial({
      uniforms: {
        maxSurfaceId: { value: this._id },
      },
      vertexShader: getVertexShader(),
      fragmentShader: getFragmentShader(),
      vertexColors: true,
    });
  }
}

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

const addEdge = (graph, a, b) => {
  if (graph[a] == undefined) graph[a] = [];
  if (graph[b] == undefined) graph[b] = [];

  if (graph[a].indexOf(b) == -1) graph[a].push(b);
  if (graph[b].indexOf(a) == -1) graph[b].push(a);
};

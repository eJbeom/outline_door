import * as THREE from "three";
import { Pass } from "three/examples/jsm/postprocessing/Pass.js";
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass.js";
import { getSurfaceIdMaterial } from "./SurfaceFinder.js";
import { max } from "three/tsl";

export class CustomOutlinePass extends Pass {
  constructor(resolution, scene, camera) {
    super();

    this.scene = scene;
    this.camera = camera;
    this.resolution = new THREE.Vector2(resolution.x, resolution.y);

    this.fsQuad = new FullScreenQuad(null);
    this.fsQuad.material = this.getMaterial();

    this.surfaceBuffer = new THREE.WebGLRenderTarget(
      this.resolution.x,
      this.resolution.y
    );

    this.surfaceIdOverrideMaterial = getSurfaceIdMaterial();
  }

  setSize(width, height) {
    this.surfaceBuffer.setSize(width, height);
    this.resolution.set(width, height);

    this.fsQuad.material.uniforms.screenSize.value.set(
      this.resolution.x,
      this.resolution.y,
      1 / this.resolution.x,
      1 / this.resolution.y
    );
  }

  render(renderer, writeBuffer, readBuffer) {
    // 1. Re-render the scene to capture all normals (or suface IDs) in a texture.
    renderer.setRenderTarget(this.surfaceBuffer);

    // Render the "surface ID buffer"
    this.scene.overrideMaterial = this.surfaceIdOverrideMaterial;

    renderer.render(this.scene, this.camera);

    this.fsQuad.material.uniforms["surfaceBuffer"].value =
      this.surfaceBuffer.texture;
    this.fsQuad.material.uniforms["sceneColorBuffer"].value =
      readBuffer.texture;

    if (this.renderToScreen) {
      renderer.setRenderTarget(null);
      this.fsQuad.render(renderer);
    } else {
      renderer.setRenderTarget(writeBuffer);
      this.fsQuad.render(renderer);
    }
  }

  dispose() {
    this.surfaceBuffer.dispose();
    this.fsQuad.dispose();
  }

  updateMaxSurfaceId(maxSurfaceId) {
    this.surfaceIdOverrideMaterial.uniforms.maxSurfaceId.value = maxSurfaceId;
  }

  getMaterial() {
    return new THREE.ShaderMaterial({
      uniforms: {
        sceneColorBuffer: {},
        depthBuffer: {},
        surfaceBuffer: {},
        outlineColor: { value: new THREE.Color(0xffffff) },
        //4 scalar values packed in one uniform: depth multiplier, depth bias, and same for normals.
        multiplierParameters: {
          value: new THREE.Vector4(0.9, 20, 1, 1),
        },
        cameraNear: { value: this.camera.near },
        cameraFar: { value: this.camera.far },
        screenSize: {
          value: new THREE.Vector4(
            this.resolution.x,
            this.resolution.y,
            1 / this.resolution.x,
            1 / this.resolution.y
          ),
        },
        time: { value: 0.0 },
      },
      vertexShader: this.vertexShader,
      fragmentShader: this.fragmentShader,
    });
  }

  get vertexShader() {
    return `
			varying vec2 vUv;
      
			void main() {
				vUv = uv;
				gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
			}
			`;
  }

  get fragmentShader() {
    return `
      uniform sampler2D sceneColorBuffer;
			uniform sampler2D surfaceBuffer;
			uniform vec4 screenSize;
			uniform vec3 outlineColor;

			varying vec2 vUv;

			vec3 getSurfaceValue(int x, int y) {
				vec3 val = texture2D(surfaceBuffer, vUv + screenSize.zw * vec2(x, y)).rgb;
				return val;
			}

			float saturateValue(float num) {
				return clamp(num, 0.0, 1.0);
			}

			float getSufaceIdDiff(vec3 surfaceValue) {
				float surfaceIdDiff = 0.0;
				surfaceIdDiff += distance(surfaceValue, getSurfaceValue(1, 0));
				surfaceIdDiff += distance(surfaceValue, getSurfaceValue(0, 1));
				surfaceIdDiff += distance(surfaceValue, getSurfaceValue(0, 1));
				surfaceIdDiff += distance(surfaceValue, getSurfaceValue(0, -1));

				surfaceIdDiff += distance(surfaceValue, getSurfaceValue(1, 1));
				surfaceIdDiff += distance(surfaceValue, getSurfaceValue(1, -1));
				surfaceIdDiff += distance(surfaceValue, getSurfaceValue(-1, 1));
				surfaceIdDiff += distance(surfaceValue, getSurfaceValue(-1, -1));
				return surfaceIdDiff;
			}

			void main() {
        vec4 sceneColor = texture2D(sceneColorBuffer, vUv);
				vec3 surfaceValue = getSurfaceValue(0, 0);

				float surfaceValueDiff = getSufaceIdDiff(surfaceValue);				

				if (surfaceValueDiff != 0.0) surfaceValueDiff = 1.0;
        
				float outline = saturateValue(surfaceValueDiff);

        vec4 alpha = vec4(0.0,0.0,0.0,0.0);
			
        if(sceneColor != alpha) {
          vec4 outlineColor = vec4(outlineColor, 1.0);
          // gl_FragColor = vec4(mix(sceneColor, outlineColor, outline));
          gl_FragColor = vec4(vec3(outline * outlineColor), 0.96);
        }else {
        gl_FragColor = alpha;
        }
			}
			`;
  }
}

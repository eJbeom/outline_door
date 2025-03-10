import * as THREE from "three";
import {
  EffectComposer,
  GLTFLoader,
  OrbitControls,
  RenderPass,
  SMAAPass,
} from "three/examples/jsm/Addons.js";
import { CustomOutlinePass } from "./CustomOutlinePass.js";
import { SurfaceFinder } from "./SurfaceFinder.js";

class App {
  constructor() {
    /* Init Scene */
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 0, 10);
    this.scene = new THREE.Scene();
    this.renderer = new THREE.WebGLRenderer({ alpha: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.surfaceFinder = new SurfaceFinder();

    /* Init Composer */
    this.composer = new EffectComposer(this.renderer);
    this.basicsPass = new RenderPass(this.scene, this.camera);
    this.customOutlinePass = new CustomOutlinePass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      this.scene,
      this.camera
    );
    this.SMAAPass = new SMAAPass(window.innerWidth, window.innerHeight);

    this.composer.addPass(this.basicsPass);
    this.composer.addPass(this.customOutlinePass);
    this.composer.addPass(this.SMAAPass);

    /* init Model */
    this.loader = new GLTFLoader();
    this.modelPath = "door.glb";
    this.loader.load(this.modelPath, (gltf) => {
      gltf.scene.children[0].children[0].rotation.y = -0.2;

      this.scene.add(gltf.scene);

      this.surfaceFinder.surfaceId = 0;

      gltf.scene.traverse((node) => {
        if (node.isMesh) {
          const colorsTypedArray =
            this.surfaceFinder.getSurfaceIdAttribute(node);
          node.geometry.setAttribute(
            "color",
            new THREE.BufferAttribute(colorsTypedArray, 4)
          );
        }
      });

      this.customOutlinePass.updateMaxSurfaceId(
        this.surfaceFinder.surfaceId + 1
      );
    });

    this.resize();
    window.addEventListener("resize", this.resize.bind(this));

    this.controls.update();
    this.update();
  }

  resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.composer.setSize(window.innerWidth, window.innerHeight);
    this.basicsPass.setSize(window.innerWidth, window.innerHeight);
    this.customOutlinePass.setSize(window.innerWidth, window.innerHeight);
    this.SMAAPass.setSize(window.innerWidth, window.innerHeight);
  }

  update() {
    window.requestAnimationFrame(this.update.bind(this));
    this.composer.render();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new App();
});

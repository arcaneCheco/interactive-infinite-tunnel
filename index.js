import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import vertexShader from "./shaders/vertex.glsl";
import fragmentShader from "./shaders/fragment.glsl";
import { Pane } from "tweakpane";
import Stats from "stats.js";

class Sketch {
  constructor() {
    this.container = document.getElementById("sketch");
    this.width = this.container.offsetWidth;
    this.height = this.container.offsetHeight;
    this.scene = new THREE.Scene();
    this.settings = {
      // tunnel properties
      nLoops: 3.5,
      outerAmplitude: 0.045,
      tunnelDepth: 1.25,
      initialRotation: 0.0,
      num: 35,
      // colors
      color: new THREE.Color(0xaaefd0),
      uMinBrightness: 0.2,
      // dynamic properties
      speed: 0.003,
      rotation: 0.005,
      rotationGradient: 0.001,
      minLerp: 0.02,
      lerpOffset: 0.25,
      // segment
      uDebug: false,
      uRadius: 0.16,
      uGradient: 0.014,
      uNoiseAmplitude: 0.07,
      uWaveFrequency: 45,
      uWaveAmplitude: 0.008,
      uWaveSpeed: 1,
      // other
      isDebugCamera: false,
      isLamp: true,
      uLampStrength: 0.045,
      isInteractive: true,
      isDebugHidden: false,
    };
    this.init();
    window.addEventListener("resize", this.resize.bind(this));
  }

  lerp(start, end, amt) {
    return (1 - amt) * start + amt * end;
  }

  init() {
    this.setCamera();
    this.setRenderer();
    this.setClock();
    this.setGeometry();
    this.setMaterial();
    this.setInteractive();
    this.setTunnel();
    this.addLamp();
    this.setDebug();
    this.render();
  }

  resize() {
    this.width = this.container.offsetWidth;
    this.height = this.container.offsetHeight;
    this.renderer.setSize(this.width, this.height);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.debugCamera.aspect = this.width / this.height;
    this.debugCamera.updateProjectionMatrix();
  }

  setCamera() {
    this.camera = new THREE.PerspectiveCamera(
      65,
      this.width / this.height,
      0.1,
      50
    );
  }

  setRenderer() {
    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.container.appendChild(this.renderer.domElement);
  }

  setClock() {
    this.clock = new THREE.Clock();
    this.elapsedTime = 0;
  }

  setGeometry() {
    this.geometry = new THREE.PlaneGeometry(1, 1, 30, 30);
  }

  setMaterial() {
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      uniforms: {
        uTime: { value: 0 },
        uRadius: { value: this.settings.uRadius },
        uGradient: { value: this.settings.uGradient },
        uPosZ: { value: 1 },
        uColor: { value: this.settings.color },
        uNoiseAmplitude: { value: this.settings.uNoiseAmplitude },
        uDebug: { value: 0 },
        uWaveFrequency: { value: this.settings.uWaveFrequency },
        uWaveAmplitude: { value: this.settings.uWaveAmplitude },
        uWaveSpeed: { value: this.settings.uWaveSpeed },
        uMinBrightness: { value: this.settings.uMinBrightness },
      },
    });
  }

  setTunnel() {
    this.tunnel = [];
    for (let i = 0; i < this.settings.num; i++) {
      const mat = this.material.clone();
      const mesh = new THREE.Mesh(this.geometry, mat);
      this.scene.add(mesh);
      const segment = {
        mesh,
      };
      this.tunnel.push(segment);
    }
    this.setSegmentInitialState();
    this.tunnel.forEach((segment) => {
      segment.mesh.position.set(...segment.initalPosition);
      segment.mesh.rotation.z = segment.initialRotation;
    });
  }

  setSegmentInitialState() {
    this.agnleSlice =
      (1 / this.settings.num) * this.settings.nLoops * Math.PI * 2;

    this.tunnel.forEach((segment, i) => {
      const initalPosition = new THREE.Vector3();
      const angle = this.agnleSlice * i;
      initalPosition.x = this.settings.outerAmplitude * Math.cos(angle);
      initalPosition.y = this.settings.outerAmplitude * Math.sin(angle);
      initalPosition.z = -i * (this.settings.tunnelDepth / this.settings.num);
      const initialRotation = angle * this.settings.initialRotation;
      segment.initalPosition = initalPosition;
      segment.initialRotation = initialRotation;
    });
  }

  setInteractive() {
    this.target = new THREE.Vector3(0, 0, -this.settings.tunnelDepth);

    this.touchPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 30, 1, 1),
      new THREE.MeshBasicMaterial({
        wireframe: true,
        opacity: 0,
        transparent: true,
      })
    );

    this.touchPlane.position.z = -this.settings.tunnelDepth;
    this.scene.add(this.touchPlane);
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2(0, 0);
    window.addEventListener("mousemove", (e) => {
      if (this.settings.isInteractive) {
        this.mouse.x = (e.clientX / this.width) * 2 - 1;
        this.mouse.y = -(e.clientY / this.height) * 2 + 1;
        this.settings.isDebugCamera
          ? this.raycaster.setFromCamera(this.mouse, this.debugCamera)
          : this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersect = this.raycaster.intersectObject(this.touchPlane);
        intersect.length && (this.target = intersect[0].point);
      }
    });
  }

  update() {
    if (this.lamp) {
      this.lamp.position.lerp(this.target, this.settings.minLerp);
    }
    if (this.tunnel) {
      this.tunnel.forEach((segment, i) => {
        let initPos;
        let z = segment.mesh.position.z + this.settings.speed;

        if (z > 0) {
          const prevIndex = i === 0 ? this.settings.num - 1 : i - 1;
          initPos = this.tunnel[prevIndex].mesh.position;
          z -= this.settings.tunnelDepth;
        } else {
          initPos = segment.mesh.position;
        }

        let x =
          segment.initalPosition.x -
          (this.target.x * z) / this.settings.tunnelDepth;

        let y =
          segment.initalPosition.y -
          (this.target.y * z) / this.settings.tunnelDepth;

        const lerpSpeed =
          (1 - -z / this.settings.tunnelDepth) * this.settings.lerpOffset +
          this.settings.minLerp;
        x = this.lerp(initPos.x, x, lerpSpeed);
        y = this.lerp(initPos.y, y, lerpSpeed);

        segment.mesh.position.set(x, y, z);

        segment.mesh.rotation.z +=
          this.settings.rotation -
          (z / this.settings.tunnelDepth) * this.settings.rotationGradient;

        segment.mesh.material.uniforms.uPosZ.value =
          -z / this.settings.tunnelDepth;

        segment.mesh.material.uniforms.uTime.value = this.elapsedTime;
      });
    }
  }

  addLamp() {
    this.lamp = new THREE.Mesh(
      this.geometry,
      new THREE.ShaderMaterial({
        vertexShader: `
        varying vec2 vUv;
        void main() {
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
          vUv = uv;
        }
      `,
        fragmentShader: `
        uniform vec3 uColor;
        uniform float uLampStrength;
        varying vec2 vUv;
      void main() {
        float dist = distance(vUv, vec2(0.5));
        float strength = uLampStrength / dist;
        gl_FragColor = vec4(uColor * strength, strength);
      }
      `,
        transparent: true,
        uniforms: {
          uColor: { value: this.settings.color },
          uLampStrength: { value: this.settings.uLampStrength },
        },
      })
    );
    this.lamp.position.z = -this.settings.tunnelDepth - 0.001;
    this.scene.add(this.lamp);
  }

  render() {
    this.stats.begin();
    this.elapsedTime = this.clock.getElapsedTime();
    this.update();
    this.settings.isDebugCamera
      ? this.renderer.render(this.scene, this.debugCamera)
      : this.renderer.render(this.scene, this.camera);
    window.requestAnimationFrame(this.render.bind(this));
    this.stats.end();
  }

  setDebug() {
    // camera
    this.debugCamera = this.camera.clone();
    this.debugCamera.position.set(0, 3, 7);

    // stats
    this.stats = new Stats();
    this.stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
    document.body.appendChild(this.stats.dom);

    // controls
    this.debugControls = new OrbitControls(
      this.debugCamera,
      this.renderer.domElement
    );
    this.debugControls.enabled = this.settings.isDebugCamera;

    // tweak pane
    this.debug = new Pane();
    this.debug.containerElem_.style.width = "12vw";
    this.debug.containerElem_.style.minWidth = "256px";

    // toggle visibility
    this.debug
      .addInput(this.settings, "isDebugHidden", { label: "hide tweaks" })
      .on("change", () => {
        if (this.settings.isDebugHidden) {
          this.debug.children.forEach((folder, i) =>
            i > 0 ? (folder.hidden = true) : (folder.label = "")
          );
          this.debug.containerElem_.style.minWidth = "66px";
          this.debug.containerElem_.style.width = "66px";
        } else {
          this.debug.children.forEach((folder, i) =>
            i > 0 ? (folder.hidden = false) : (folder.label = "hide tweaks")
          );
          this.debug.containerElem_.style.minWidth = "256px";
          this.debug.containerElem_.style.width = "12vw";
        }
      });

    // colors
    this.colorsFolder = this.debug.addFolder({
      title: "colors",
      hidden: this.settings.isDebugHidden,
    });

    this.colorsFolder
      .addInput(this.settings, "color", {
        view: "color",
        expanded: true,
        picker: "inline",
      })
      .on("change", () => {
        const rgbChannels = this.settings.color
          .toArray()
          .map((channel) => channel / 255);
        this.tunnel.forEach((segment) =>
          segment.mesh.material.uniforms.uColor.value.setRGB(...rgbChannels)
        );
        this.lamp.material.uniforms.uColor.value.setRGB(...rgbChannels);
      });

    this.colorsFolder
      .addInput(this.settings, "uMinBrightness", {
        label: "min brightness",
        min: 0,
        max: 1,
        step: 0.001,
      })
      .on("change", () => {
        this.tunnel.forEach(
          (segment) =>
            (segment.mesh.material.uniforms.uMinBrightness.value =
              this.settings.uMinBrightness)
        );
      });

    // segments properties
    this.segmentsFolder = this.debug.addFolder({
      title: "segment properties",
      expanded: false,
      hidden: this.settings.isDebugHidden,
    });

    this.segmentsFolder
      .addInput(this.settings, "uDebug", { label: "debug" })
      .on("change", () => {
        if (this.settings.uDebug) {
          this.camera.position.z = 0.8;
          this.settings.oldSpeed = this.settings.speed;
          this.settings.speed = 0;
          this.settings.oldRotationGradient = this.settings.rotationGradient;
          this.settings.rotationGradient = 0;
          this.settings.oldRotation = this.settings.rotation;
          this.settings.rotation = 0;
          this.tunnel.forEach(
            (segment) => (segment.mesh.material.uniforms.uDebug.value = 1)
          );
        } else {
          this.camera.position.z = 0;
          this.settings.speed = this.settings.oldSpeed;
          this.settings.rotationGradient = this.settings.oldRotationGradient;
          this.settings.rotation = this.settings.oldRotation;
          this.tunnel.forEach(
            (segment) => (segment.mesh.material.uniforms.uDebug.value = 0)
          );
        }
      });

    this.segmentsFolder
      .addInput(this.settings, "uRadius", {
        label: "Radius",
        min: 0,
        max: 0.6,
        step: 0.001,
      })
      .on("change", () => {
        this.tunnel.forEach(
          (segment) =>
            (segment.mesh.material.uniforms.uRadius.value =
              this.settings.uRadius)
        );
      });

    this.segmentsFolder
      .addInput(this.settings, "uGradient", {
        label: "smoothness",
        min: 0,
        max: 0.2,
        step: 0.001,
      })
      .on("change", () => {
        this.tunnel.forEach(
          (segment) =>
            (segment.mesh.material.uniforms.uGradient.value =
              this.settings.uGradient)
        );
      });

    this.segmentsFolder
      .addInput(this.settings, "uNoiseAmplitude", {
        label: "noise",
        min: 0,
        max: 0.75,
        step: 0.001,
      })
      .on("change", () => {
        this.tunnel.forEach(
          (segment) =>
            (segment.mesh.material.uniforms.uNoiseAmplitude.value =
              this.settings.uNoiseAmplitude)
        );
      });

    this.segmentsFolder
      .addInput(this.settings, "uWaveFrequency", {
        label: "waveFrequency",
        min: 0,
        max: 300,
        step: 1,
      })
      .on("change", () => {
        this.tunnel.forEach(
          (segment) =>
            (segment.mesh.material.uniforms.uWaveFrequency.value =
              this.settings.uWaveFrequency)
        );
      });

    this.segmentsFolder
      .addInput(this.settings, "uWaveAmplitude", {
        label: "waveAmplitude",
        min: 0,
        max: 0.1,
        step: 0.001,
      })
      .on("change", () => {
        this.tunnel.forEach(
          (segment) =>
            (segment.mesh.material.uniforms.uWaveAmplitude.value =
              this.settings.uWaveAmplitude)
        );
      });

    this.segmentsFolder
      .addInput(this.settings, "uWaveSpeed", {
        label: "uWaveSpeed",
        min: 0,
        max: 3,
        step: 0.01,
      })
      .on("change", () => {
        this.tunnel.forEach(
          (segment) =>
            (segment.mesh.material.uniforms.uWaveSpeed.value =
              this.settings.uWaveSpeed)
        );
      });

    // dynamic properties
    this.dynamicFolder = this.debug.addFolder({
      title: "dynamic properties",
      expanded: false,
      hidden: this.settings.isDebugHidden,
    });

    this.dynamicFolder.addInput(this.settings, "rotationGradient", {
      label: "rotation gradient",
      min: 0,
      max: 0.015,
      step: 0.001,
    });

    this.dynamicFolder.addInput(this.settings, "minLerp", {
      label: "min lerp",
      min: 0.001,
      max: 0.1,
      step: 0.001,
    });

    this.dynamicFolder.addInput(this.settings, "lerpOffset", {
      label: "lerp offset",
      min: 0,
      max: 1,
      step: 0.001,
    });

    this.dynamicFolder.addInput(this.settings, "speed", {
      label: "speed",
      min: 0,
      max: 0.01,
      step: 0.001,
    });

    this.dynamicFolder.addInput(this.settings, "rotation", {
      label: "rotationSpeed",
      min: 0,
      max: 0.01,
      step: 0.001,
    });

    //initialState
    this.initialStateFolder = this.debug.addFolder({
      title: "tunnel shape",
      expanded: false,
      hidden: this.settings.isDebugHidden,
    });

    this.initialStateFolder
      .addInput(this.settings, "nLoops", {
        label: "bumpiness",
        min: 0,
        max: 10,
      })
      .on("change", () => {
        this.setSegmentInitialState();
      });

    this.initialStateFolder
      .addInput(this.settings, "tunnelDepth", {
        label: "tunnel depth",
        min: 1,
        max: 4,
      })
      .on("change", () => {
        this.touchPlane.position.z = -this.settings.tunnelDepth;
        this.lamp.position.z = -this.settings.tunnelDepth;
        this.setSegmentInitialState();
      });

    this.initialStateFolder
      .addInput(this.settings, "outerAmplitude", {
        label: "segment offset",
        min: 0,
        max: 0.2,
      })
      .on("change", () => {
        this.setSegmentInitialState();
      });

    this.initialStateFolder
      .addInput(this.settings, "num", {
        label: "number of segments",
        min: 0,
        max: 80,
        step: 1,
      })
      .on("change", () => {
        this.tunnel.forEach((segment) => {
          segment.mesh.geometry.dispose();
          segment.mesh.material.dispose();
          this.scene.remove(segment.mesh);
        });
        this.tunnel = [];
        this.setSegmentInitialState();
      });

    // other
    this.othersFolder = this.debug.addFolder({
      title: "other",
      expanded: false,
      hidden: this.settings.isDebugHidden,
    });
    this.othersFolder
      .addInput(this.settings, "isDebugCamera", { label: "debug view" })
      .on("change", () => {
        this.debugControls.enabled = this.settings.isDebugCamera;
        this.settings.isDebugCamera
          ? (this.touchPlane.material.opacity = 1)
          : (this.touchPlane.material.opacity = 0);
      });

    this.othersFolder
      .addInput(this.settings, "isLamp", { label: "add lamp" })
      .on("change", () => {
        this.settings.isLamp
          ? this.scene.add(this.lamp)
          : this.scene.remove(this.lamp);
      });

    this.othersFolder
      .addInput(this.settings, "uLampStrength", {
        label: "lamp strength",
        min: 0,
        max: 0.1,
        step: 0.001,
      })
      .on(
        "change",
        () =>
          (this.lamp.material.uniforms.uLampStrength.value =
            this.settings.uLampStrength)
      );

    this.othersFolder
      .addInput(this.settings, "isInteractive", {
        label: "interactive",
      })
      .on("change", () => this.target.set(0, 0, -this.settings.tunnelDepth));
  }
}

new Sketch();

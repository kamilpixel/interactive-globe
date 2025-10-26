import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import earthImage from "./images/earth.jpg";
import "./style.css";

const main = () => {
  let globe;
  const canvas = document.querySelector("#c");
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, canvas });
  const fov = 60;
  const aspect = 2;
  const near = 0.1;
  const far = 10;
  const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
  camera.position.z = 2.5;
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 1.2;
  controls.maxDistance = 4;
  controls.update();

  const scene = new THREE.Scene();
  const loader = new THREE.TextureLoader();
  const texture = loader.load(earthImage);
  const geometry = new THREE.SphereGeometry(1, 64, 32);
  const material = new THREE.MeshBasicMaterial({ map: texture });
  globe = new THREE.Mesh(geometry, material);
  scene.add(globe);

  async function loadJSON(url) {
    const req = await fetch(url);
    return req.json();
  }

  let countryInfos;
  const loadCountryData = async () => {
    countryInfos = await loadJSON("/data/locations.json");
    const lonFudge = Math.PI * 1.5;
    const latFudge = Math.PI;

    const lonHelper = new THREE.Object3D();
    const latHelper = new THREE.Object3D();
    lonHelper.add(latHelper);

    const positionHelper = new THREE.Object3D();
    positionHelper.position.z = 1;
    latHelper.add(positionHelper);

    const labelParentElem = document.querySelector("#labels");
    for (const loc of countryInfos) {
      const { latitude, longitude, location_name, branch_url } = loc;
      lonHelper.rotation.y = THREE.MathUtils.degToRad(longitude) + lonFudge;
      latHelper.rotation.x = THREE.MathUtils.degToRad(latitude) + latFudge;
      positionHelper.updateWorldMatrix(true, false);
      const position = new THREE.Vector3();
      positionHelper.getWorldPosition(position);
      loc.position = position;

      // Clone label-container template
      const elem = document.createElement("div");
      const labelContainer = document.querySelector(".label-container");
      const elemChild = labelContainer.cloneNode(true);
      elemChild.style.display = "";
      elemChild.querySelector(".country-name").textContent = location_name;

      // Make the cloned label clickable by attaching a listener to the inner container
      elem.appendChild(elemChild);
      elemChild.addEventListener("click", (e) => {
        e.stopPropagation();
        window.open(branch_url, "_blank");
      });

      labelParentElem.appendChild(elem);
      loc.elem = elem;
    }

    requestRenderIfNotRequested();
  }

  loadCountryData();

  const tempV = new THREE.Vector3();
  const cameraToPoint = new THREE.Vector3();
  const cameraPosition = new THREE.Vector3();
  const normalMatrix = new THREE.Matrix3();

  const settings = {
    minArea: 20,
    maxVisibleDot: -0.2,
  };

  const updateLabels = () => {
    if (!countryInfos) {
      return;
    }
    const large = settings.minArea * settings.minArea;
    normalMatrix.getNormalMatrix(camera.matrixWorldInverse);
    camera.getWorldPosition(cameraPosition);
    for (const countryInfo of countryInfos) {
      const { position, elem, area } = countryInfo;
      if (area < large) {
        elem.style.display = "none";
        continue;
      }
      tempV.copy(position);
      tempV.applyMatrix3(normalMatrix);
      cameraToPoint.copy(position);
      cameraToPoint.applyMatrix4(camera.matrixWorldInverse).normalize();
      const dot = tempV.dot(cameraToPoint);
      if (dot > settings.maxVisibleDot) {
        elem.style.display = "none";
        continue;
      }
      elem.style.display = "";
      tempV.copy(position);
      tempV.project(camera);
      const x = (tempV.x * 0.5 + 0.5) * canvas.clientWidth;
      const y = (tempV.y * -0.5 + 0.5) * canvas.clientHeight;
      elem.style.transform = `translate(-50%, -50%) translate(${x}px,${y}px)`;
      elem.style.zIndex = ((-tempV.z * 0.5 + 0.5) * 100000) | 0;
    }
  };

  const resizeRendererToDisplaySize = (renderer) => {
    const canvas = renderer.domElement;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const needResize = canvas.width !== width || canvas.height !== height;
    if (needResize) {
      renderer.setSize(width, height, false);
    }

    return needResize;
  };

  let renderRequested = false;
  const render = () => {
    renderRequested = undefined;
    if (resizeRendererToDisplaySize(renderer)) {
      const canvas = renderer.domElement;
      camera.aspect = canvas.clientWidth / canvas.clientHeight;
      camera.updateProjectionMatrix();
    }
    controls.update();
    updateLabels();
    renderer.render(scene, camera);
  };

  render();

  const requestRenderIfNotRequested = () => {
    if (!renderRequested) {
      renderRequested = true;
      requestAnimationFrame(render);
    }
  };

  controls.addEventListener("change", requestRenderIfNotRequested);
  window.addEventListener("resize", requestRenderIfNotRequested);
};

main();

// Import necessary Three.js modules
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Setting up PointerLockControls for first-person movement
const controls = new THREE.PointerLockControls(camera, document.body);
const blocker = document.getElementById('blocker');
const instructions = document.getElementById('instructions');

// Show instructions initially
instructions.style.display = '';
blocker.style.display = '';

// Event to lock pointer and activate first-person control
instructions.addEventListener('click', () => {
  controls.lock();
}, false);

// Toggle display of instructions based on pointer lock status
controls.addEventListener('lock', () => {
  instructions.style.display = 'none';
  blocker.style.display = 'none';
});
controls.addEventListener('unlock', () => {
  instructions.style.display = '';
  blocker.style.display = '';
});

// Ground and basic lighting
const groundGeometry = new THREE.PlaneGeometry(100, 100);
const groundMaterial = new THREE.MeshBasicMaterial({ color: 0x888888, side: THREE.DoubleSide });
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5, 10, 7.5);
scene.add(light);

// Movement controls
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let velocity = new THREE.Vector3();
const speed = 5.0;

// Listen for keydown and keyup events to control movement
document.addEventListener('keydown', (event) => {
  switch (event.code) {
    case 'ArrowUp':
    case 'KeyW':
      moveForward = true;
      break;
    case 'ArrowLeft':
    case 'KeyA':
      moveLeft = true;
      break;
    case 'ArrowDown':
    case 'KeyS':
      moveBackward = true;
      break;
    case 'ArrowRight':
    case 'KeyD':
      moveRight = true;
      break;
  }
}, false);

document.addEventListener('keyup', (event) => {
  switch (event.code) {
    case 'ArrowUp':
    case 'KeyW':
      moveForward = false;
      break;
    case 'ArrowLeft':
    case 'KeyA':
      moveLeft = false;
      break;
    case 'ArrowDown':
    case 'KeyS':
      moveBackward = false;
      break;
    case 'ArrowRight':
    case 'KeyD':
      moveRight = false;
      break;
  }
}, false);

// Animation loop to render the scene and update controls
function animate() {
  requestAnimationFrame(animate);

  if (controls.isLocked) {
    // Calculate velocity for movement
    velocity.x -= velocity.x * 0.1;
    velocity.z -= velocity.z * 0.1;

    if (moveForward) velocity.z -= speed;
    if (moveBackward) velocity.z += speed;
    if (moveLeft) velocity.x -= speed;
    if (moveRight) velocity.x += speed;

    // Update controls and position
    controls.moveRight(-velocity.x * 0.1);
    controls.moveForward(-velocity.z * 0.1);
  }

  renderer.render(scene, camera);
}

// Handle window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();

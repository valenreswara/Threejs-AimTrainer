let camera, scene, renderer, targets = [], currentMode = 'click';
let score = 0, shots = 0, hits = 0, isRunning = false;
let lastTime = 0, timer = 0;
let lastTargetTime = 0;
let reactionTimes = [];
let targetAppearTime = 0;
let baseInterval = 5; // The time between spawns
let nextAutoSpawnTime = 0;
let spawnInterval = null;
let flickerTimeout = null;

// Movement variables
const moveSpeed = 0.1;
const keys = { w: false, a: false, s: false, d: false };
const velocity = new THREE.Vector3();
const roomBounds = { x: 24, y: 24, z: 24 }; // Adjust based on room size

// Target spawn bounds - focused area in front of player
const spawnBounds = {
    x: { min: -5, max: 5 },    // Narrower horizontal range
    y: { min: 0.5, max: 5 }, // Controlled vertical range
    z: { min: -6, max: -3 }      // Only spawn in front of player
};

// Camera rotation variables
const euler = new THREE.Euler(0, 0, 0, 'YXZ');
let rotationVelocity = new THREE.Vector2();

function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(0, 1, 1);
    scene.add(directionalLight);

    // Position camera
    camera.position.set(0, 1, 5);

    // Setup controls
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('click', onMouseClick);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.getElementById('startButton').addEventListener('click', startGame);
    document.getElementById('resetButton').addEventListener('click', resetGame);
    document.getElementById('modeSelect').addEventListener('change', (e) => {
        currentMode = e.target.value;
        resetGame();
    });

    // Lock pointer on click
    renderer.domElement.addEventListener('click', () => {
        renderer.domElement.requestPointerLock();
    });

    // Create room boundaries
    createRoom();
}

function createRoom() {
    // const geometry = new THREE.BoxGeometry(50, 50, 50);
    // const material = new THREE.MeshPhongMaterial({ 
    //     color: 0x808080,
    //     side: THREE.BackSide,
    // });
    // const room = new THREE.Mesh(geometry, material);
    // scene.add(room);

    const textureLoader = new THREE.TextureLoader();

    // Load the texture for the walls
    const wallTexture = textureLoader.load('/wall.jpg');
    const geometry = new THREE.BoxGeometry(50, 50, 50);
    const material = new THREE.MeshPhongMaterial({ 
        map: wallTexture,
        side: THREE.BackSide,
    });
    const room = new THREE.Mesh(geometry, material);
    scene.add(room);

    const floorTexture = textureLoader.load('/floor.jpg');
    floorTexture.wrapS = THREE.RepeatWrapping;
    floorTexture.wrapT = THREE.RepeatWrapping;
    floorTexture.repeat.set(16, 16); // Adjust this to control the number of repeats

    const lantai_geo = new THREE.PlaneGeometry(51, 51);
    const lantai_mat = new THREE.MeshPhongMaterial({
        map: floorTexture,
    });
    const lantai = new THREE.Mesh(lantai_geo, lantai_mat);
    lantai.position.set(0, -2, 0);
    lantai.rotation.x = Math.PI * -0.5;
    lantai.receiveShadow = true;
    scene.add(lantai);
}

function getRandomSpawnPosition() {
    return new THREE.Vector3(
        spawnBounds.x.min + Math.random() * (spawnBounds.x.max - spawnBounds.x.min),
        spawnBounds.y.min + Math.random() * (spawnBounds.y.max - spawnBounds.y.min),
        spawnBounds.z.min + Math.random() * (spawnBounds.z.max - spawnBounds.z.min)
    );
}

function createTarget(position) {
    const geometry = new THREE.SphereGeometry(0.2, 32, 32);
    const material = new THREE.MeshPhongMaterial({ color: 0xff0000 });
    const target = new THREE.Mesh(geometry, material);
    target.position.copy(position);
    scene.add(target);
    
    const targetObj = {
        mesh: target,
        velocity: new THREE.Vector3(
            (Math.random() - 0.5) * 0.05,
            (Math.random() - 0.5) * 0.05,
            (Math.random() - 0.5) * 0.05
        ),
        appearTime: performance.now()
    };
    
    targets.push(targetObj);
    return targetObj;
}

function onKeyDown(event) {
    switch (event.key.toLowerCase()) {
        case 'w': keys.w = true; break;
        case 'a': keys.a = true; break;
        case 's': keys.s = true; break;
        case 'd': keys.d = true; break;
    }
}

function onKeyUp(event) {
    switch (event.key.toLowerCase()) {
        case 'w': keys.w = false; break;
        case 'a': keys.a = false; break;
        case 's': keys.s = false; break;
        case 'd': keys.d = false; break;
    }
}

function onMouseMove(event) {
    if (document.pointerLockElement === renderer.domElement) {
        rotationVelocity.x -= event.movementX * 0.002;
        rotationVelocity.y -= event.movementY * 0.002;
        
        rotationVelocity.y = Math.max(-Math.PI/2, Math.min(Math.PI/2, rotationVelocity.y));
        
        euler.y = rotationVelocity.x;
        euler.x = rotationVelocity.y;
        
        camera.quaternion.setFromEuler(euler);
    }
}

function updateMovement() {
    if (!isRunning) return;

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    
    velocity.set(0, 0, 0);
    
    if (keys.w) velocity.add(forward.multiplyScalar(moveSpeed));
    if (keys.s) velocity.sub(forward.multiplyScalar(moveSpeed));
    if (keys.a) velocity.sub(right.multiplyScalar(moveSpeed));
    if (keys.d) velocity.add(right.multiplyScalar(moveSpeed));
    
    velocity.y = 0;
    
    const nextPos = camera.position.clone().add(velocity);
    if (Math.abs(nextPos.x) < roomBounds.x && 
        Math.abs(nextPos.z) < roomBounds.z) {
        camera.position.copy(nextPos);
    }
}

function spawnTarget() {
    const position = getRandomSpawnPosition();
    const target = createTarget(position);
    
    if (currentMode === 'flick') {
        targetAppearTime = performance.now();
    }

    return target;
}


function updateTargets(deltaTime) {
    for (let i = targets.length - 1; i >= 0; i--) {
        const target = targets[i];
        if (currentMode === 'track') {
            target.mesh.position.add(target.velocity);
            
            // Bounce off spawn area boundaries instead of room boundaries
            if (target.mesh.position.x <= spawnBounds.x.min || 
                target.mesh.position.x >= spawnBounds.x.max) {
                target.velocity.x *= -1;
            }
            if (target.mesh.position.y <= spawnBounds.y.min || 
                target.mesh.position.y >= spawnBounds.y.max) {
                target.velocity.y *= -1;
            }
            if (target.mesh.position.z <= spawnBounds.z.min || 
                target.mesh.position.z >= spawnBounds.z.max) {
                target.velocity.z *= -1;
            }
        }
    }
}

function teleportTargets() {
    if (!isRunning) return;
    
    targets.forEach(target => {
        target.mesh.position.copy(getRandomSpawnPosition());
        target.appearTime = performance.now();
    });
}

function onMouseClick(event) {
    if (!isRunning) return;
    
    shots++;
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);

    const intersects = raycaster.intersectObjects(targets.map(t => t.mesh));
    
    if (intersects.length > 0) {
        hits++;
        score += 100;
        const hitTarget = targets.find(t => t.mesh === intersects[0].object);
        
        const reactionTime = performance.now() - hitTarget.appearTime;
        reactionTimes.push(reactionTime);
        
        scene.remove(hitTarget.mesh);
        targets.splice(targets.indexOf(hitTarget), 1);

        // In flick mode, immediately spawn a new target and set next auto-spawn time
        if (currentMode === 'flick') {
            spawnTarget();
            // Start a new interval sequence from the current time
            nextAutoSpawnTime = Math.ceil(timer) + baseInterval;
        } else {
            spawnTarget(); // For other modes
        }
        
        document.getElementById('reactionTime').textContent = Math.round(reactionTime);
        const avgReaction = reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length;
        document.getElementById('avgReaction').textContent = Math.round(avgReaction);
    }

    updateHUD();
}

function updateHUD() {
    document.getElementById('score').textContent = score;
    document.getElementById('accuracy').textContent = 
        shots > 0 ? Math.round((hits / shots) * 100) : 0;
    document.getElementById('timer').textContent = 
        Math.round(timer * 10) / 10;
}

function startGame() {
    isRunning = true;
    score = 0;
    shots = 0;
    hits = 0;
    timer = 0;
    lastTime = performance.now();
    reactionTimes = [];
    
    // Clear any existing targets and intervals
    targets.forEach(target => scene.remove(target.mesh));
    targets = [];
    clearInterval(spawnInterval);
    if (flickerTimeout) {
        clearTimeout(flickerTimeout);
    }

    if (currentMode === 'flick') {
        spawnTarget();
        nextAutoSpawnTime = baseInterval; // First automatic spawn at 5 seconds
    } else {
        const targetCount = 5;
        for (let i = 0; i < targetCount; i++) {
            spawnTarget();
        }
    }
}

function resetGame() {
    isRunning = false;
    // Clear all timers
    if (flickerTimeout) {
        clearTimeout(flickerTimeout);
    }
    clearInterval(spawnInterval);
    targets.forEach(target => scene.remove(target.mesh));
    targets = [];
    reactionTimes = [];
    document.getElementById('reactionTime').textContent = '0';
    document.getElementById('avgReaction').textContent = '0';
    updateHUD();
}

function animate(currentTime) {
    requestAnimationFrame(animate);

    if (isRunning) {
        const deltaTime = (currentTime - lastTime) / 1000;
        timer += deltaTime;
        
        // Check for automatic spawn in flick mode
        if (currentMode === 'flick' && timer >= nextAutoSpawnTime) {
            teleportTargets();
            // Next spawn should be baseInterval seconds from this spawn
            nextAutoSpawnTime += baseInterval;
        }
        
        updateMovement();
        updateTargets(deltaTime);
        updateHUD();
        lastTime = currentTime;
    }

    renderer.render(scene, camera);
}

// Initialize and start animation
init();
animate(0);

// Handle window resizing
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

let camera, scene, renderer, targets = [], currentMode = 'click';
        let score = 0, shots = 0, hits = 0, isRunning = false;
        let lastTime = 0, timer = 0;
        let lastTargetTime = 0;
        let reactionTimes = [];
        let targetAppearTime = 0;
        let flickerTimeout = null;
        
        // Movement variables
        const moveSpeed = 0.1;
        const keys = { w: false, a: false, s: false, d: false };
        const velocity = new THREE.Vector3();
        const roomBounds = { x: 9, y: 9, z: 9 }; // Adjust based on room size

        // Initialize the scene
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
            camera.position.set(0, 1, 5); // Start slightly above the floor

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
            const geometry = new THREE.BoxGeometry(20, 20, 20);
            const material = new THREE.MeshPhongMaterial({ 
                color: 0x808080,
                side: THREE.BackSide,
            });
            const room = new THREE.Mesh(geometry, material);
            scene.add(room);

            const lantai_geo = new THREE.PlaneGeometry(21,21);
            const lantai_mat = new THREE.MeshPhongMaterial({
                color: 0xfff
            });
            const lantai = new THREE.Mesh(lantai_geo, lantai_mat);
            lantai.position.set(0,-2,0);
            lantai.rotation.x = Math.PI * - .5;
            lantai.receiveShadow = true;
            scene.add(lantai);
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

         // Movement key handlers
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

        function updateMovement() {
            // Calculate movement direction relative to camera
            const forward = new THREE.Vector3();
            const right = new THREE.Vector3();
            
            // Get forward and right vectors from camera
            camera.getWorldDirection(forward);
            right.crossVectors(camera.up, forward).normalize();
            
            // Reset velocity
            velocity.set(0, 0, 0);
            
            // Add movement based on keys
            if (keys.w) velocity.add(forward.multiplyScalar(moveSpeed));
            if (keys.s) velocity.sub(forward.multiplyScalar(moveSpeed));
            if (keys.a) velocity.add(right.multiplyScalar(moveSpeed));
            if (keys.d) velocity.sub(right.multiplyScalar(moveSpeed));
            
            // Remove vertical component for horizontal-only movement
            velocity.y = 0;
            
            // Apply movement with collision detection
            const nextPos = camera.position.clone().add(velocity);
            if (Math.abs(nextPos.x) < roomBounds.x && 
                Math.abs(nextPos.z) < roomBounds.z) {
                camera.position.copy(nextPos);
            }
        }

        function getRandomPosition() {
            return new THREE.Vector3(
                (Math.random() - 0.5) * roomBounds.x * 1.5,
                Math.random() * roomBounds.y * 0.8 + 1, // Ensure it's above floor
                (Math.random() - 0.5) * roomBounds.z * 1.5
            );
        }

        function updateTargets(deltaTime) {
            for (let i = targets.length - 1; i >= 0; i--) {
                const target = targets[i];
                if (currentMode === 'track') {
                    target.mesh.position.add(target.velocity);
                    
                    // Check if target is below floor or hit boundaries
                    if (target.mesh.position.y < 0 || 
                        Math.abs(target.mesh.position.x) > roomBounds.x ||
                        Math.abs(target.mesh.position.z) > roomBounds.z) {
                        
                        // Remove target
                        scene.remove(target.mesh);
                        targets.splice(i, 1);
                        
                        // Spawn new target
                        spawnTarget();
                        continue;
                    }
                    
                    // Bounce off walls (except floor)
                    if (Math.abs(target.mesh.position.x) > roomBounds.x * 0.9) target.velocity.x *= -1;
                    if (target.mesh.position.y > roomBounds.y * 0.9) target.velocity.y *= -1;
                    if (Math.abs(target.mesh.position.z) > roomBounds.z * 0.9) target.velocity.z *= -1;
                }
            }
        }

        function spawnTarget() {
            const position = getRandomPosition();
            const target = createTarget(position);
            
            if (currentMode === 'flick') {
                targetAppearTime = performance.now();
                
                // Schedule next target teleport
                flickerTimeout = setTimeout(() => {
                    if (isRunning && targets.length > 0) {
                        teleportTargets();
                    }
                }, Math.random() * 1000 + 1000); // Random delay between 1-2 seconds
            }
            
            return target;
        }

        function teleportTargets() {
            targets.forEach(target => {
                target.mesh.position.copy(getRandomPosition());
                target.appearTime = performance.now();
            });
            
            // Schedule next teleport
            if (isRunning) {
                flickerTimeout = setTimeout(() => {
                    if (isRunning) {
                        teleportTargets();
                    }
                }, Math.random() * 1000 + 1000);
            }
        }

        function onMouseMove(event) {
            if (document.pointerLockElement === renderer.domElement) {
                camera.rotation.y -= event.movementX * 0.002;
                camera.rotation.x -= event.movementY * 0.002;
                camera.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, camera.rotation.x));
            }
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
                
                // Calculate reaction time
                const reactionTime = performance.now() - hitTarget.appearTime;
                reactionTimes.push(reactionTime);
                
                scene.remove(hitTarget.mesh);
                targets.splice(targets.indexOf(hitTarget), 1);
                spawnTarget();
                
                // Update reaction time display
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
            
            // Clear existing targets
            targets.forEach(target => scene.remove(target.mesh));
            targets = [];

            // Clear any existing timeouts
            if (flickerTimeout) {
                clearTimeout(flickerTimeout);
            }

            // Spawn initial targets
            const targetCount = currentMode === 'flick' ? 1 : 5;
            for (let i = 0; i < targetCount; i++) {
                spawnTarget();
            }

            // Start teleporting targets if in flick mode
            if (currentMode === 'flick') {
                teleportTargets();
            }
        }

        function resetGame() {
            isRunning = false;
            if (flickerTimeout) {
                clearTimeout(flickerTimeout);
            }
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
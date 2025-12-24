/**
 * PNGTuber - Audio Reactive Avatar
 * Web Audio API + SVG State Management
 * Supports OBS WebSocket for browser source mic access
 */

class PNGTuber {
    constructor() {
        // DOM Elements
        this.avatarContainer = document.getElementById('avatar-container');
        this.micPrompt = document.getElementById('mic-prompt');
        this.enableMicBtn = document.getElementById('enable-mic');
        this.settingsPanel = document.getElementById('settings-panel');
        this.settingsToggle = document.getElementById('toggle-settings');
        this.thresholdSlider = document.getElementById('threshold-slider');
        this.thresholdValue = document.getElementById('threshold-value');
        this.skinColorInput = document.getElementById('skin-color');
        this.beardColorInput = document.getElementById('beard-color');
        this.volumeBar = document.getElementById('volume-bar');
        
        // Audio state
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.dataArray = null;
        
        // OBS WebSocket state
        this.obsWebSocket = null;
        this.obsConnected = false;
        this.obsAudioSource = 'Mic/Aux'; // Default OBS audio source name
        
        // Settings (defaults)
        this.threshold = 20;
        this.isTalking = false;
        this.smoothedVolume = 0;
        
        // Initialize
        this.parseURLParams();
        this.bindEvents();
        this.checkOBSMode();
    }
    
    /**
     * Parse URL parameters for configuration
     * Example: ?threshold=40&skin=f5d0c5&beard=2d2d2d&obs=true&settings=true
     * OBS WebSocket: ?obs=true&port=4455&password=yourpassword&source=Mic/Aux
     */
    parseURLParams() {
        const params = new URLSearchParams(window.location.search);
        
        // Threshold
        if (params.has('threshold')) {
            this.threshold = parseInt(params.get('threshold'), 10);
            this.thresholdSlider.value = this.threshold;
            this.thresholdValue.textContent = this.threshold;
        }
        
        // Skin color
        if (params.has('skin')) {
            const skinColor = '#' + params.get('skin');
            this.setSkinColor(skinColor);
            this.skinColorInput.value = skinColor;
        }
        
        // Beard color
        if (params.has('beard')) {
            const beardColor = '#' + params.get('beard');
            this.setBeardColor(beardColor);
            this.beardColorInput.value = beardColor;
        }
        
        // Show settings panel by default
        if (params.has('settings') && params.get('settings') === 'true') {
            this.settingsPanel.classList.remove('hidden');
        }
        
        // OBS WebSocket port (default 4455)
        this.obsPort = params.get('port') || '4455';
        
        // OBS WebSocket password
        this.obsPassword = params.get('password') || '';
        
        // OBS audio source name
        if (params.has('source')) {
            this.obsAudioSource = params.get('source');
        }
    }
    
    /**
     * Check if running in OBS mode (hide UI)
     */
    checkOBSMode() {
        const params = new URLSearchParams(window.location.search);
        if (params.has('obs') && params.get('obs') === 'true') {
            document.body.classList.add('obs-mode');
            // Try OBS WebSocket first, fallback to mic
            this.initOBSWebSocket();
        }
    }
    
    /**
     * Initialize OBS WebSocket connection
     */
    async initOBSWebSocket() {
        try {
            const wsUrl = `ws://127.0.0.1:${this.obsPort}`;
            console.log(`🔌 Connecting to OBS WebSocket at ${wsUrl}...`);
            
            this.obsWebSocket = new WebSocket(wsUrl);
            
            this.obsWebSocket.onopen = () => {
                console.log('🔌 OBS WebSocket connected!');
                this.obsConnected = true;
                this.micPrompt.classList.add('hidden');
                
                // Authenticate if password is set
                if (this.obsPassword) {
                    this.obsAuthenticate();
                } else {
                    // Start polling for audio levels
                    this.startOBSAudioLoop();
                }
            };
            
            this.obsWebSocket.onmessage = (event) => {
                this.handleOBSMessage(JSON.parse(event.data));
            };
            
            this.obsWebSocket.onerror = (error) => {
                console.log('OBS WebSocket error, falling back to mic...', error);
                this.initAudio();
            };
            
            this.obsWebSocket.onclose = () => {
                console.log('OBS WebSocket closed');
                this.obsConnected = false;
            };
            
            // Timeout fallback - if OBS doesn't connect in 3 seconds, try mic
            setTimeout(() => {
                if (!this.obsConnected) {
                    console.log('OBS WebSocket timeout, falling back to mic...');
                    if (this.obsWebSocket) {
                        this.obsWebSocket.close();
                    }
                    this.initAudio();
                }
            }, 3000);
            
        } catch (error) {
            console.log('OBS WebSocket not available, falling back to mic...', error);
            this.initAudio();
        }
    }
    
    /**
     * Authenticate with OBS WebSocket (if password required)
     */
    obsAuthenticate() {
        // For OBS WebSocket 5.x, send identify request
        // Simple auth - for basic use cases
        this.obsSend({
            op: 1,
            d: {
                rpcVersion: 1,
                authentication: this.obsPassword
            }
        });
    }
    
    /**
     * Send message to OBS WebSocket
     */
    obsSend(data) {
        if (this.obsWebSocket && this.obsWebSocket.readyState === WebSocket.OPEN) {
            this.obsWebSocket.send(JSON.stringify(data));
        }
    }
    
    /**
     * Handle incoming OBS WebSocket messages
     */
    handleOBSMessage(message) {
        // OBS WebSocket 5.x protocol
        if (message.op === 0) {
            // Hello message - need to identify
            this.obsSend({
                op: 1,
                d: {
                    rpcVersion: 1
                }
            });
        } else if (message.op === 2) {
            // Identified - start audio loop
            console.log('✅ OBS WebSocket authenticated');
            this.startOBSAudioLoop();
        } else if (message.op === 7) {
            // Request response
            if (message.d && message.d.requestType === 'GetInputVolume') {
                this.handleOBSVolumeResponse(message.d.responseData);
            }
        }
    }
    
    /**
     * Handle OBS volume response
     */
    handleOBSVolumeResponse(data) {
        if (data && typeof data.inputVolumeMul !== 'undefined') {
            // Convert multiplier to 0-100 scale
            // inputVolumeMul is linear (0.0 to 1.0+)
            const volume = Math.min(100, Math.max(0, data.inputVolumeMul * 100));
            this.processVolume(volume);
        }
    }
    
    /**
     * Start OBS audio level polling loop
     */
    startOBSAudioLoop() {
        const pollAudio = () => {
            if (!this.obsConnected) return;
            
            // Request volume level from OBS
            this.obsSend({
                op: 6,
                d: {
                    requestType: 'GetInputVolume',
                    requestId: 'vol_' + Date.now(),
                    requestData: {
                        inputName: this.obsAudioSource
                    }
                }
            });
            
            // Poll at ~60fps
            setTimeout(pollAudio, 16);
        };
        
        pollAudio();
    }
    
    /**
     * Process volume level (shared between mic and OBS modes)
     */
    processVolume(volume) {
        // Smooth the volume for less jittery response
        this.smoothedVolume = this.smoothedVolume * 0.7 + volume * 0.3;
        
        // Update volume meter
        if (this.volumeBar) {
            this.volumeBar.style.width = `${this.smoothedVolume}%`;
        }
        
        // Check against threshold
        const shouldTalk = this.smoothedVolume > this.threshold;
        
        if (shouldTalk !== this.isTalking) {
            this.isTalking = shouldTalk;
            this.updateMouthState();
        }
    }
    
    /**
     * Bind UI event listeners
     */
    bindEvents() {
        // Enable mic button
        this.enableMicBtn.addEventListener('click', () => this.initAudio());
        
        // Settings toggle
        this.settingsToggle.addEventListener('click', () => {
            this.settingsPanel.classList.toggle('hidden');
        });
        
        // Threshold slider
        this.thresholdSlider.addEventListener('input', (e) => {
            this.threshold = parseInt(e.target.value, 10);
            this.thresholdValue.textContent = this.threshold;
        });
        
        // Skin color
        this.skinColorInput.addEventListener('input', (e) => {
            this.setSkinColor(e.target.value);
        });
        
        // Beard color
        this.beardColorInput.addEventListener('input', (e) => {
            this.setBeardColor(e.target.value);
        });
    }
    
    /**
     * Set skin color on SVG
     */
    setSkinColor(color) {
        const skinLight = document.getElementById('skin-light');
        const skinBase = document.getElementById('skin-base');
        
        if (skinLight && skinBase) {
            // Make light version slightly brighter
            skinLight.setAttribute('stop-color', this.lightenColor(color, 20));
            skinBase.setAttribute('stop-color', color);
        }
    }
    
    /**
     * Set beard color on SVG
     */
    setBeardColor(color) {
        const beardLight = document.getElementById('beard-light');
        const beardDark = document.getElementById('beard-dark');
        
        if (beardLight && beardDark) {
            beardLight.setAttribute('stop-color', this.lightenColor(color, 15));
            beardDark.setAttribute('stop-color', this.darkenColor(color, 20));
        }
    }
    
    /**
     * Lighten a hex color
     */
    lightenColor(hex, percent) {
        const num = parseInt(hex.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = Math.min(255, (num >> 16) + amt);
        const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
        const B = Math.min(255, (num & 0x0000FF) + amt);
        return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
    }
    
    /**
     * Darken a hex color
     */
    darkenColor(hex, percent) {
        const num = parseInt(hex.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = Math.max(0, (num >> 16) - amt);
        const G = Math.max(0, ((num >> 8) & 0x00FF) - amt);
        const B = Math.max(0, (num & 0x0000FF) - amt);
        return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
    }
    
    /**
     * Initialize Web Audio API
     */
    async initAudio() {
        try {
            // Request microphone access
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            });
            
            // Create audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Create analyser node
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
            this.analyser.smoothingTimeConstant = 0.3;
            
            // Connect microphone to analyser
            this.microphone = this.audioContext.createMediaStreamSource(stream);
            this.microphone.connect(this.analyser);
            
            // Create data array for frequency data
            this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
            
            // Hide prompt, start loop
            this.micPrompt.classList.add('hidden');
            this.startAudioLoop();
            
            console.log('🎤 Microphone connected!');
            
        } catch (error) {
            console.error('Microphone access denied:', error);
            // Show error in UI instead of alert
            const promptText = this.micPrompt.querySelector('p');
            if (promptText) {
                promptText.textContent = 'Mic access denied. Use Window Capture in OBS instead of Browser Source.';
            }
            console.log('Tip: Open this page in Chrome, grant mic access, then use Window Capture in OBS');
        }
    }
    
    /**
     * Main audio processing loop
     */
    startAudioLoop() {
        const processAudio = () => {
            // Get frequency data
            this.analyser.getByteFrequencyData(this.dataArray);
            
            // Calculate average volume (0-255)
            let sum = 0;
            for (let i = 0; i < this.dataArray.length; i++) {
                sum += this.dataArray[i];
            }
            const average = sum / this.dataArray.length;
            
            // Normalize to 0-100
            const volume = Math.round((average / 255) * 100);
            
            // Use shared volume processing
            this.processVolume(volume);
            
            // Continue loop
            requestAnimationFrame(processAudio);
        };
        
        processAudio();
    }
    
    /**
     * Update avatar mouth state
     */
    updateMouthState() {
        if (this.isTalking) {
            this.avatarContainer.classList.add('talking');
        } else {
            this.avatarContainer.classList.remove('talking');
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.pngtuber = new PNGTuber();
});

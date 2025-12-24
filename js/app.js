/**
 * PNGTuber - Audio Reactive Avatar
 * Web Audio API + SVG State Management
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
    }
    
    /**
     * Check if running in OBS mode (hide UI)
     */
    checkOBSMode() {
        const params = new URLSearchParams(window.location.search);
        if (params.has('obs') && params.get('obs') === 'true') {
            document.body.classList.add('obs-mode');
            // Auto-start mic in OBS mode
            this.initAudio();
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
            // Only show alert if not in OBS mode
            const params = new URLSearchParams(window.location.search);
            if (!params.has('obs') || params.get('obs') !== 'true') {
                alert('Microphone access is required for the avatar to react to your voice.');
            } else {
                console.log('OBS mode: Enable "Control audio via Streamlabs Desktop" or use browser source audio capture');
            }
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

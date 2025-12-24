# PNGTuber - Audio Reactive Avatar

A simple, customizable audio-reactive avatar for streaming. Works as an OBS browser source!

![Avatar Preview](preview.png)

## Features

- 🎤 **Audio-reactive** - Mouth opens when you speak
- 🎨 **Customizable** - Change skin tone, beard color via URL or settings panel
- ✨ **Idle animations** - Breathing, floating, and blinking
- 🖥️ **OBS-ready** - Transparent background, works as browser source
- ⚡ **No server needed** - 100% client-side, deployable to Vercel

## Quick Start

### Local Development

```bash
cd pngtuber
npm run dev
```

Then open `http://localhost:3000` in your browser.

### Deploy to Vercel

1. Push to GitHub
2. Connect repo to [Vercel](https://vercel.com)
3. Deploy (zero config needed!)

## OBS Setup

### Option 1: OBS WebSocket (Recommended)

This lets OBS send your mic audio levels directly to the avatar - no browser mic permission needed!

1. **Enable OBS WebSocket:**
   - In OBS, go to **Tools → WebSocket Server Settings**
   - ✅ Enable WebSocket server
   - Note the port (default: `4455`)
   - Set a password if you want (optional)

2. **Add Browser Source in OBS:**
   - URL: `https://pelado-hablador.vercel.app/?obs=true`
   - Width: `400`, Height: `440`
   
3. **Configure audio source (if needed):**
   - Add `&source=YOUR_MIC_NAME` to match your OBS audio input name
   - Example: `?obs=true&source=Mic/Aux` or `?obs=true&source=Microphone`

### Option 2: Window Capture

If WebSocket doesn't work:

1. Open `https://pelado-hablador.vercel.app/` in **Chrome**
2. Grant microphone permission
3. In OBS, add **Window Capture** instead of Browser Source
4. Select the Chrome window

## URL Parameters

Customize your avatar via URL parameters:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `threshold` | `30` | Mic sensitivity (5-100). Lower = more sensitive |
| `skin` | `f5d0c5` | Skin color (hex without #) |
| `beard` | `2d2d2d` | Beard color (hex without #) |
| `obs` | `false` | OBS mode - hides UI, connects to OBS WebSocket |
| `settings` | `false` | Show settings panel on load |
| `port` | `4455` | OBS WebSocket port |
| `password` | `` | OBS WebSocket password (if set) |
| `source` | `Mic/Aux` | OBS audio input source name |

### Example URLs

**OBS Mode (clean, no UI):**
```
https://your-app.vercel.app/?obs=true&threshold=25
```

**With custom colors:**
```
https://your-app.vercel.app/?skin=e8c4b8&beard=1a1a1a&threshold=35
```

**Debug mode (settings visible):**
```
https://your-app.vercel.app/?settings=true
```

## Customization

### Changing the Avatar

The avatar is pure SVG in `index.html`. You can:

1. Edit the SVG paths directly
2. Replace with your own SVG
3. Add `?idle=URL&talk=URL` support for PNG images (coming soon)

### Adding Expressions

Add more mouth states in the SVG:
- `#mouth-closed` - Default/idle state
- `#mouth-open` - Talking state
- `#mouth-yell` - High volume (add JS logic for volume > 70)

## Files

```
pngtuber/
├── index.html      # Main HTML + SVG avatar
├── css/
│   └── styles.css  # Styling + animations
├── js/
│   └── app.js      # Audio API + state management
├── package.json
└── README.md
```

## Tech Stack

- Vanilla JS (no frameworks)
- Web Audio API for mic input
- SVG for scalable avatar
- CSS animations for idle states

## License

MIT - Feel free to customize and use for your streams!

---

Made with ❤️ for streamers

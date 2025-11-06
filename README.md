# Finance Trend Radar

A responsive, interactive radar chart visualization for financial trends. Built with pure HTML, CSS, and JavaScript—no build tools required. All graphics are rendered using SVG for crisp rendering at any resolution.

## What It Is

Finance Trend Radar displays financial trends as interactive data points on a static radar chart with a rotating sweep line. Each trend is positioned based on its angle and radius, colored by type (Technology vs. Social & Business), and includes detailed information accessible via modal dialogs.

## Key Features

- **Static Background**: Rings, grid, bands, and all text labels remain perfectly fixed
- **Rotating Sweep**: Only a thin sweep line with a faint wedge rotates continuously (~40s per revolution)
- **Always-Visible Labels**: Trend names are always visible with leader lines, never upside-down
- **Collision Detection**: Labels automatically adjust to avoid overlaps
- **Accessible**: Full keyboard navigation, focus management, and ARIA support
- **Responsive**: Works on desktop and mobile, down to 360px width

## How It's Drawn

Everything is drawn using SVG—no bitmap images. The visualization includes:

- **Concentric rings**: Four rings at radii 120, 220, 320, and 420 with radial gradients
- **Sector dividers**: Lines every 15° with bolder lines at cardinal directions (0°, 90°, 180°, 270°)
- **Annular bands**: Top semicircle (green) for Social & Business, bottom semicircle (blue) for Technology
- **Stable text labels**: "HIGH IMPACT", "LOW IMPACT", "TECHNOLOGY TRENDS", "SOCIAL & BUSINESS TRENDS" using textPath
- **Rotating sweep**: Thin line + 18° translucent wedge that rotates continuously
- **Data points**: Interactive circles colored by trend type
- **Always-visible labels**: Trend names with leader lines, positioned left/right based on angle

## How to Run

### Option 1: Direct File Access
Simply open `index.html` in a modern web browser:
- Chrome (recommended)
- Safari
- Firefox
- Edge

### Option 2: Local HTTP Server
For better compatibility (especially for fetching JSON data), run a simple HTTP server:

**Python 3:**
```bash
python -m http.server 8000
```

**Python 2:**
```bash
python -m SimpleHTTPServer 8000
```

**Node.js (http-server):**
```bash
npx http-server
```

Then navigate to `http://localhost:8000` in your browser.

## Adding and Editing Trends

Trends are defined in `data/trends.json` as an array of objects. Each trend has the following structure:

```json
{
  "id": "unique-identifier",
  "title": "Trend Title",
  "type": "Technology Trend" | "Social & Business Trend",
  "impact": "High" | "Medium" | "Low",
  "adoption": "<5 Years" | "5–10 Years" | "10+ Years",
  "angle": 0,
  "radius": 0.5,
  "blurb": "Description of the trend",
  "link": "#"
}
```

### Understanding Angle and Radius

**Angle (`angle`)**: 
- Measured in degrees
- 0° is at the top (12 o'clock position)
- Positive values rotate clockwise
- Range: 0–360°
- Examples:
  - `0` = top
  - `90` = right
  - `180` = bottom
  - `270` = left

**Radius (`radius`)**:
- Normalized value between 0 and 1
- 0 = center of the radar
- 1 = outer edge (at the working radius)
- Values are multiplied by `workingRadius` (420px) to get actual pixel coordinates
- Example: `0.62` places the point at 62% of the way from center to outer edge

### Coordinate Calculation

The actual pixel coordinates are calculated as:
```javascript
theta = (angle - 90) * Math.PI / 180  // Convert to radians, adjust for 0° at top
x = 500 + (workingRadius * radius) * Math.cos(theta)
y = 500 + (workingRadius * radius) * Math.sin(theta)
```

Where `500` is the center of the 1000×1000 viewBox.

## Tweaking Ring Radius and Label Offsets

### Ring Radii
The ring radii are defined in `js/app.js` in the `drawBackground()` method:

```javascript
const ringRadii = [120, 220, 320, 420];
```

Adjust these values to change the ring positions. The outermost ring should be less than the working radius (420px) to keep points inside the visible area.

### Working Radius
The `workingRadius` constant controls how far from the center the data points can be positioned. It's defined in the constructor:

```javascript
this.workingRadius = 420;  // <-- Adjust this value
```

**To adjust**:
- **Increase** (e.g., `450`): Points can be positioned closer to the outer rings
- **Decrease** (e.g., `380`): Points stay closer to the center
- **Recommended range**: `350`–`450` to keep points within the visible rings

### Label Offsets
Label positioning offsets are defined in `drawLabels()`:

```javascript
const labelOffsetX = isLeftHalf ? -12 : 12;  // Horizontal offset
const labelY = y + 4;  // Vertical offset (dy = 4)
```

Adjust these values to change how far labels are positioned from their points.

## How the Sweep Works

The sweep is a visual indicator that rotates continuously around the radar. It consists of:

1. **Sweep Line**: A thin radius line from center to outer edge
2. **Sweep Wedge**: An 18° wide translucent sector that fades from the line to the trailing edge

### Animation

The sweep rotates via CSS animation:
- **Duration**: Controlled by CSS variable `--period` (default: 40s)
- **Timing**: Linear (constant speed)
- **Transform origin**: Center of the SVG (500px, 500px)

### Pausing

The sweep automatically pauses when:
- Mouse hovers over a point or label
- Modal dialog is open

It resumes when:
- Mouse leaves the point/label
- Modal dialog is closed

### Adjusting Speed

To change the sweep speed, modify the CSS variable in `css/styles.css`:

```css
:root {
    --period: 40s;  /* Change this value (e.g., 20s for faster, 60s for slower) */
}
```

## Label Positioning and Collision Detection

### Positioning Rules

Labels are positioned based on the point's angle:
- **Left half** (90° to 270°): Label placed to the **left** of the point
  - `text-anchor="end"`
  - `dx = -12`
- **Right half** (270° to 90°, wrapping): Label placed to the **right** of the point
  - `text-anchor="start"`
  - `dx = 12`

Labels are always **horizontal** (never rotated) for maximum readability.

### Collision Detection

After initial placement, the system runs a collision detection algorithm:

1. **Check overlaps**: Compares bounding boxes of all label pairs
2. **Nudge outward**: When overlaps are detected, the label farther from center is nudged radially outward by 6px
3. **Iterate**: Repeats up to 10 times until no overlaps remain
4. **Update leader lines**: Leader lines are automatically updated to connect to the new label positions

This ensures labels remain readable even when points are close together.

## Acceptance Criteria

1. ✅ **Static dial** — rings and all text remain fixed
2. ✅ **Single rotating sweep** (line + faint wedge) completes a revolution in ~40s
3. ✅ **Trend names visible by default** with leader lines; never upside-down; left/right anchoring rules applied; basic collision avoidance implemented
4. ✅ Quadrant/arc titles (**HIGH/LOW IMPACT**, **SOCIAL & BUSINESS TRENDS**, **TECHNOLOGY TRENDS**) are stable and legible
5. ✅ Click dot or label opens an accessible modal; sweep pauses while open
6. ✅ Works locally from file:// and via a static server; no console errors; responsive and crisp on HiDPI

## File Structure

```
finance-trend-radar/
├── index.html          # Main HTML file
├── css/
│   └── styles.css     # All styles and animations
├── js/
│   └── app.js         # Application logic and rendering
├── data/
│   └── trends.json    # Trend data (10 items)
└── README.md          # This file
```

## Browser Support

- Chrome (latest)
- Safari (latest)
- Firefox (latest)
- Edge (latest)

Requires:
- ES6 JavaScript support (async/await, classes)
- SVG rendering
- CSS animations
- Fetch API

## License

This project is provided as-is for educational and demonstration purposes.


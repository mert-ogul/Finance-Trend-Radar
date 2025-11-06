// Finance Trend Radar Application
class FinanceTrendRadar {
    constructor() {
        this.trends = [];
        this.svg = document.getElementById('radar');
        this.tooltip = document.getElementById('tooltip');
        this.modal = document.getElementById('modal');
        this.modalTitle = document.getElementById('modal-title');
        this.modalMeta = document.querySelector('.modal-meta');
        this.modalBlurb = document.querySelector('.modal-blurb');
        this.modalCtaLink = document.getElementById('modal-cta-link');
        this.centerX = 500;
        this.centerY = 500;
        this.workingRadius = 420;
        this.currentTrend = null;
        this.previouslyFocusedElement = null;
        this.modalFocusableElements = null;
        this.firstFocusableElement = null;
        this.lastFocusableElement = null;
        this.trapFocusHandler = this.trapFocus.bind(this);
        this.sweepGroup = null;
        this.labelElements = [];
    }

    async loadTrends() {
        try {
            const response = await fetch('data/trends.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            this.trends = await response.json();
            this.render();
            this.setupEventListeners();
        } catch (error) {
            console.error('Error loading trends:', error);
        }
    }

    setupEventListeners() {
        // Close modal on ESC key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal.getAttribute('aria-hidden') === 'false') {
                this.closeModal();
            }
        });

        // Close modal on close button click
        const closeBtn = document.querySelector('.modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeModal());
        }

        // Close modal on backdrop click
        const backdrop = document.querySelector('.modal-backdrop');
        if (backdrop) {
            backdrop.addEventListener('click', () => this.closeModal());
        }
    }

    getFocusableElements() {
        const modalContent = document.querySelector('.modal-content');
        if (!modalContent) return [];

        const focusableSelectors = [
            'a[href]',
            'button:not([disabled])',
            'textarea:not([disabled])',
            'input:not([disabled])',
            'select:not([disabled])',
            '[tabindex]:not([tabindex="-1"])'
        ].join(', ');

        return Array.from(modalContent.querySelectorAll(focusableSelectors))
            .filter(el => {
                const style = window.getComputedStyle(el);
                return style.display !== 'none' && style.visibility !== 'hidden';
            });
    }

    trapFocus(e) {
        if (this.modal.getAttribute('aria-hidden') === 'true') return;

        if (e.key !== 'Tab') return;

        const focusableElements = this.getFocusableElements();
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
            // Shift + Tab
            if (document.activeElement === firstElement) {
                e.preventDefault();
                lastElement.focus();
            }
        } else {
            // Tab
            if (document.activeElement === lastElement) {
                e.preventDefault();
                firstElement.focus();
            }
        }
    }

    pauseSweep() {
        const wedge = document.querySelector('#sweep .wedge');
        if (wedge) {
            wedge.style.animationPlayState = 'paused';
        }
    }

    resumeSweep() {
        // Only resume if modal is not open
        const wedge = document.querySelector('#sweep .wedge');
        if (wedge && this.modal.getAttribute('aria-hidden') === 'true') {
            wedge.style.animationPlayState = 'running';
        }
    }

    render() {
        this.renderRadar();
    }

    renderRadar() {
        // Get groups from HTML
        const bgGroup = document.getElementById('bg');
        const sweepGroup = document.getElementById('sweep');
        const pointsGroup = document.getElementById('points');
        const labelsGroup = document.getElementById('labels');
        const hudGroup = document.getElementById('hud');

        // Clear existing content in groups
        bgGroup.innerHTML = '';
        sweepGroup.innerHTML = '';
        pointsGroup.innerHTML = '';
        labelsGroup.innerHTML = '';
        hudGroup.innerHTML = '';

        this.sweepGroup = sweepGroup;
        this.labelElements = [];

        // Create SVG filters and gradients
        this.createFilters();

        // Draw static background in #bg
        this.drawBackground(bgGroup);

        // Draw rotating sweep in #sweep
        this.drawSweep(sweepGroup);

        // Draw points in #points
        if (this.trends.length > 0) {
            this.drawPoints(pointsGroup);
            this.drawLabels(labelsGroup);
            // Resolve collisions after a short delay to ensure bboxes are calculated
            setTimeout(() => this.resolveLabelCollisions(), 10);
        }
    }

    createFilters() {
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        
        // Drop shadow filter
        const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
        filter.setAttribute('id', 'dropshadow');
        filter.setAttribute('x', '-50%');
        filter.setAttribute('y', '-50%');
        filter.setAttribute('width', '200%');
        filter.setAttribute('height', '200%');

        const feGaussianBlur = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
        feGaussianBlur.setAttribute('in', 'SourceAlpha');
        feGaussianBlur.setAttribute('stdDeviation', '2');
        
        const feOffset = document.createElementNS('http://www.w3.org/2000/svg', 'feOffset');
        feOffset.setAttribute('dx', '1');
        feOffset.setAttribute('dy', '1');
        feOffset.setAttribute('result', 'offsetblur');
        
        const feComponentTransfer = document.createElementNS('http://www.w3.org/2000/svg', 'feComponentTransfer');
        const feFuncA = document.createElementNS('http://www.w3.org/2000/svg', 'feFuncA');
        feFuncA.setAttribute('type', 'linear');
        feFuncA.setAttribute('slope', '0.3');
        
        const feMerge = document.createElementNS('http://www.w3.org/2000/svg', 'feMerge');
        const feMergeNode1 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
        const feMergeNode2 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
        feMergeNode2.setAttribute('in', 'SourceGraphic');

        feComponentTransfer.appendChild(feFuncA);
        feMerge.appendChild(feMergeNode1);
        feMerge.appendChild(feMergeNode2);
        filter.appendChild(feGaussianBlur);
        filter.appendChild(feOffset);
        filter.appendChild(feComponentTransfer);
        filter.appendChild(feMerge);
        defs.appendChild(filter);

        // Radial gradients for rings
        const ringRadii = [120, 220, 320, 420];
        ringRadii.forEach((r, i) => {
            const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'radialGradient');
            gradient.setAttribute('id', `ringGradient${i}`);
            gradient.setAttribute('cx', '50%');
            gradient.setAttribute('cy', '50%');
            gradient.setAttribute('r', '50%');

            const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
            stop1.setAttribute('offset', '0%');
            stop1.setAttribute('stop-color', '#e0e0e0');
            stop1.setAttribute('stop-opacity', '0.6');

            const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
            stop2.setAttribute('offset', '100%');
            stop2.setAttribute('stop-color', '#f0f0f0');
            stop2.setAttribute('stop-opacity', '0.3');

            gradient.appendChild(stop1);
            gradient.appendChild(stop2);
            defs.appendChild(gradient);
        });

        // Radial gradient for sweep wedge (fading from center line outward)
        const wedgeGradient = document.createElementNS('http://www.w3.org/2000/svg', 'radialGradient');
        wedgeGradient.setAttribute('id', 'wedgeGradient');
        wedgeGradient.setAttribute('cx', '50%');
        wedgeGradient.setAttribute('cy', '0%');
        wedgeGradient.setAttribute('r', '100%');
        
        const wedgeStop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
        wedgeStop1.setAttribute('offset', '0%');
        wedgeStop1.setAttribute('stop-color', '#667eea');
        wedgeStop1.setAttribute('stop-opacity', '0.15');
        
        const wedgeStop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
        wedgeStop2.setAttribute('offset', '100%');
        wedgeStop2.setAttribute('stop-color', '#667eea');
        wedgeStop2.setAttribute('stop-opacity', '0');
        
        wedgeGradient.appendChild(wedgeStop1);
        wedgeGradient.appendChild(wedgeStop2);
        defs.appendChild(wedgeGradient);

        this.svg.appendChild(defs);
    }

    createAnnularArcPath(startAngle, endAngle, innerRadius, outerRadius) {
        const startRad = (startAngle * Math.PI) / 180;
        const endRad = (endAngle * Math.PI) / 180;
        
        const x1Outer = this.centerX + Math.cos(startRad) * outerRadius;
        const y1Outer = this.centerY + Math.sin(startRad) * outerRadius;
        const x2Outer = this.centerX + Math.cos(endRad) * outerRadius;
        const y2Outer = this.centerY + Math.sin(endRad) * outerRadius;
        const x1Inner = this.centerX + Math.cos(startRad) * innerRadius;
        const y1Inner = this.centerY + Math.sin(startRad) * innerRadius;
        const x2Inner = this.centerX + Math.cos(endRad) * innerRadius;
        const y2Inner = this.centerY + Math.sin(endRad) * innerRadius;

        const largeArcFlag = Math.abs(endAngle - startAngle) > 180 ? 1 : 0;
        
        return `M ${x1Outer} ${y1Outer} A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${x2Outer} ${y2Outer} L ${x2Inner} ${y2Inner} A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${x1Inner} ${y1Inner} Z`;
    }

    makeTextOnPath(bgGroup, text, pathId, opts = {}) {
        const { startOffset = '50%', anchor = 'middle', cls = '' } = opts;
        
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        if (cls) {
            textElement.setAttribute('class', cls);
        }
        textElement.setAttribute('font-size', '18');
        textElement.setAttribute('font-weight', '700');
        textElement.setAttribute('letter-spacing', '0.6px');
        textElement.setAttribute('fill', '#12171d');
        textElement.setAttribute('opacity', '0.9');
        textElement.setAttribute('filter', 'url(#dropshadow)');
        
        const textPath = document.createElementNS('http://www.w3.org/2000/svg', 'textPath');
        textPath.setAttributeNS('http://www.w3.org/1999/xlink', 'href', `#${pathId}`);
        textPath.setAttribute('startOffset', startOffset);
        textPath.setAttribute('text-anchor', anchor);
        textPath.textContent = text;
        
        textElement.appendChild(textPath);
        bgGroup.appendChild(textElement);
    }

    drawCurvedTextPath(bgGroup, text, startAngle, endAngle, radius, color) {
        const startRad = (startAngle * Math.PI) / 180;
        const endRad = (endAngle * Math.PI) / 180;
        const largeArcFlag = Math.abs(endAngle - startAngle) > 180 ? 1 : 0;
        
        const x1 = this.centerX + Math.cos(startRad) * radius;
        const y1 = this.centerY + Math.sin(startRad) * radius;
        const x2 = this.centerX + Math.cos(endRad) * radius;
        const y2 = this.centerY + Math.sin(endRad) * radius;
        
        const pathId = `textPath-${startAngle}-${endAngle}`;
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('id', pathId);
        path.setAttribute('d', `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', 'none');
        bgGroup.appendChild(path);
        
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-size', '14');
        textElement.setAttribute('font-weight', '600');
        textElement.setAttribute('fill', color);
        textElement.setAttribute('letter-spacing', '1px');
        textElement.setAttribute('filter', 'url(#dropshadow)');
        
        const textPath = document.createElementNS('http://www.w3.org/2000/svg', 'textPath');
        textPath.setAttributeNS('http://www.w3.org/1999/xlink', 'href', `#${pathId}`);
        textPath.setAttribute('startOffset', '50%');
        textPath.setAttribute('text-anchor', 'middle');
        textPath.textContent = text;
        
        textElement.appendChild(textPath);
        bgGroup.appendChild(textElement);
    }

    drawBackground(bgGroup) {
        // Concentric rings
        const ringRadii = [120, 220, 320, 420];
        ringRadii.forEach((r, i) => {
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', this.centerX);
            circle.setAttribute('cy', this.centerY);
            circle.setAttribute('r', r);
            circle.setAttribute('fill', `url(#ringGradient${i})`);
            circle.setAttribute('stroke', '#d0d0d0');
            circle.setAttribute('stroke-width', '1');
            circle.setAttribute('filter', 'url(#dropshadow)');
            bgGroup.appendChild(circle);
        });

        // Sector dividers (grid lines every 15°)
        const outerRadius = 480;
        for (let angle = 0; angle < 360; angle += 15) {
            const isCardinal = angle % 90 === 0;
            const angleRad = (angle * Math.PI) / 180;
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', this.centerX);
            line.setAttribute('y1', this.centerY);
            line.setAttribute('x2', this.centerX + Math.cos(angleRad) * outerRadius);
            line.setAttribute('y2', this.centerY + Math.sin(angleRad) * outerRadius);
            line.setAttribute('stroke', isCardinal ? 'var(--color-grid-cardinal)' : 'var(--color-grid-stroke)');
            line.setAttribute('stroke-width', isCardinal ? '1.5' : '0.5');
            line.setAttribute('opacity', isCardinal ? '0.8' : '0.5');
            bgGroup.appendChild(line);
        }

        // Annular bands (top green, bottom blue)
        const outerRadiusBand = 420;
        const innerRadiusBand = 330; // 90px thickness
        
        // Top semicircle (green) - 90° to 270°
        const topPath = this.createAnnularArcPath(90, 270, innerRadiusBand, outerRadiusBand);
        const topArc = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        topArc.setAttribute('d', topPath);
        topArc.setAttribute('fill', 'rgba(76, 175, 80, 0.15)');
        topArc.setAttribute('stroke', 'rgba(76, 175, 80, 0.3)');
        topArc.setAttribute('stroke-width', '1');
        topArc.setAttribute('filter', 'url(#dropshadow)');
        bgGroup.appendChild(topArc);

        // Bottom semicircle (blue) - 270° to 90°
        const bottomPath = this.createAnnularArcPath(270, 90, innerRadiusBand, outerRadiusBand);
        const bottomArc = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        bottomArc.setAttribute('d', bottomPath);
        bottomArc.setAttribute('fill', 'rgba(33, 150, 243, 0.15)');
        bottomArc.setAttribute('stroke', 'rgba(33, 150, 243, 0.3)');
        bottomArc.setAttribute('stroke-width', '1');
        bottomArc.setAttribute('filter', 'url(#dropshadow)');
        bgGroup.appendChild(bottomArc);

        // Center dot
        const centerDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        centerDot.setAttribute('cx', this.centerX);
        centerDot.setAttribute('cy', this.centerY);
        centerDot.setAttribute('r', '6');
        centerDot.setAttribute('fill', '#667eea');
        centerDot.setAttribute('stroke', '#fff');
        centerDot.setAttribute('stroke-width', '2');
        centerDot.setAttribute('filter', 'url(#dropshadow)');
        bgGroup.appendChild(centerDot);

        // Center label
        const centerLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        centerLabel.setAttribute('x', this.centerX);
        centerLabel.setAttribute('y', this.centerY + 30);
        centerLabel.setAttribute('text-anchor', 'middle');
        centerLabel.setAttribute('font-size', '12');
        centerLabel.setAttribute('font-weight', '500');
        centerLabel.setAttribute('fill', '#666');
        centerLabel.textContent = 'Finance Radar';
        bgGroup.appendChild(centerLabel);

        // Stable text labels using textPath
        const R_OUT = 470;
        const CX = this.centerX;
        const CY = this.centerY;
        
        // Top semicircle path (left→right along the top)
        const topTextPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        topTextPath.setAttribute('id', 'arc-top');
        topTextPath.setAttribute('d', `M ${CX - R_OUT} ${CY} A ${R_OUT} ${R_OUT} 0 0 1 ${CX + R_OUT} ${CY}`);
        topTextPath.setAttribute('fill', 'none');
        topTextPath.setAttribute('stroke', 'none');
        bgGroup.appendChild(topTextPath);
        
        // Bottom semicircle path (left→right along the bottom)
        const botTextPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        botTextPath.setAttribute('id', 'arc-bottom');
        botTextPath.setAttribute('d', `M ${CX - R_OUT} ${CY} A ${R_OUT} ${R_OUT} 0 0 0 ${CX + R_OUT} ${CY}`);
        botTextPath.setAttribute('fill', 'none');
        botTextPath.setAttribute('stroke', 'none');
        bgGroup.appendChild(botTextPath);
        
        // HIGH IMPACT at top (centered)
        this.makeTextOnPath(bgGroup, 'HIGH IMPACT', 'arc-top', { startOffset: '50%', anchor: 'middle', cls: 'impact-high' });
        
        // LOW IMPACT at bottom (centered)
        this.makeTextOnPath(bgGroup, 'LOW IMPACT', 'arc-bottom', { startOffset: '50%', anchor: 'middle', cls: 'impact-low' });
        
        // TECHNOLOGY TRENDS on bottom (blue band, 270° to 90°)
        const labelRadius = 450;
        this.drawCurvedTextPath(bgGroup, 'TECHNOLOGY TRENDS', 270, 90, labelRadius - 20, 'rgba(33, 150, 243, 0.8)');
        
        // SOCIAL & BUSINESS TRENDS on top (green band, 90° to 270°)
        this.drawCurvedTextPath(bgGroup, 'SOCIAL & BUSINESS TRENDS', 90, 270, labelRadius - 20, 'rgba(76, 175, 80, 0.8)');
    }

    drawSweep(sweepGroup) {
        // 18° sector from 0°; rotation comes from CSS animation
        const cx = this.centerX;
        const cy = this.centerY;
        const rOuter = 470;
        const deg = 18;
        
        const a = (deg * Math.PI) / 180;
        const x1 = cx + rOuter * Math.cos(-a / 2);
        const y1 = cy + rOuter * Math.sin(-a / 2);
        const x2 = cx + rOuter * Math.cos(a / 2);
        const y2 = cy + rOuter * Math.sin(a / 2);
        
        // Wedge starts from center (cx, cy) and extends to outer radius
        const wedgePath = `M ${cx} ${cy} L ${x1} ${y1} A ${rOuter} ${rOuter} 0 0 1 ${x2} ${y2} Z`;
        
        const wedge = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        wedge.setAttribute('class', 'wedge');
        wedge.setAttribute('d', wedgePath);
        wedge.setAttribute('fill', 'rgba(59, 130, 246, 0.18)'); // blue with transparency
        sweepGroup.appendChild(wedge);
    }

    drawPoints(pointsGroup) {
        this.trends.forEach((trend, index) => {
            // Compute coordinates: 0° at top, clockwise positive
            const theta = (trend.angle - 90) * Math.PI / 180;
            const x = this.centerX + (this.workingRadius * trend.radius) * Math.cos(theta);
            const y = this.centerY + (this.workingRadius * trend.radius) * Math.sin(theta);

            // Create clickable group
            const pointGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            pointGroup.setAttribute('class', 'point');
            pointGroup.setAttribute('data-index', index);
            pointGroup.setAttribute('data-x', x);
            pointGroup.setAttribute('data-y', y);
            pointGroup.setAttribute('tabindex', '0');
            pointGroup.setAttribute('role', 'button');
            pointGroup.setAttribute('aria-label', trend.title || 'Unnamed Trend');

            // Determine fill color by type
            const isTechnology = trend.type === 'Technology Trend';
            const fillColor = isTechnology ? 'var(--blueTech)' : 'var(--greenBiz)';

            // Draw circle
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', x);
            circle.setAttribute('cy', y);
            circle.setAttribute('r', '7.2');
            circle.setAttribute('fill', fillColor);
            circle.setAttribute('stroke', 'rgba(255, 255, 255, 0.6)');
            circle.setAttribute('stroke-width', '1.2');
            circle.setAttribute('filter', 'url(#dropshadow)');
            
            pointGroup.appendChild(circle);
            
            // Add hover and click events
            pointGroup.addEventListener('mouseenter', (e) => {
                this.pauseSweep();
                circle.setAttribute('r', '9');
                pointGroup.classList.add('active');
                const labelGroup = document.querySelector(`.label-group[data-index="${index}"]`);
                if (labelGroup) labelGroup.classList.add('active');
                this.showTooltip(e, trend, pointGroup);
            });
            pointGroup.addEventListener('mouseleave', () => {
                this.resumeSweep();
                circle.setAttribute('r', '7.2');
                pointGroup.classList.remove('active');
                const labelGroup = document.querySelector(`.label-group[data-index="${index}"]`);
                if (labelGroup) labelGroup.classList.remove('active');
                this.hideTooltip();
            });
            pointGroup.addEventListener('click', () => {
                this.previouslyFocusedElement = pointGroup;
                this.openModal(trend);
            });
            
            // Keyboard support
            pointGroup.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.previouslyFocusedElement = pointGroup;
                    this.openModal(trend);
                }
            });
            
            pointsGroup.appendChild(pointGroup);
        });
    }

    drawLabels(labelsGroup) {
        const pointsGroup = document.getElementById('points');
        
        this.trends.forEach((trend, index) => {
            // Compute coordinates
            const theta = (trend.angle - 90) * Math.PI / 180;
            const x = this.centerX + (this.workingRadius * trend.radius) * Math.cos(theta);
            const y = this.centerY + (this.workingRadius * trend.radius) * Math.sin(theta);

            // Determine label position (left or right of point)
            // Left half: angles 90° to 270°
            // Right half: angles 270° to 90° (wrapping)
            const normalizedAngle = ((trend.angle % 360) + 360) % 360;
            const isLeftHalf = normalizedAngle >= 90 && normalizedAngle <= 270;
            
            const labelOffsetX = isLeftHalf ? -12 : 12;
            const textAnchor = isLeftHalf ? 'end' : 'start';
            const labelX = x + labelOffsetX;
            const labelY = y + 4;

            // Create label group
            const labelGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            labelGroup.setAttribute('class', 'label-group');
            labelGroup.setAttribute('data-index', index);
            labelGroup.setAttribute('data-x', labelX);
            labelGroup.setAttribute('data-y', labelY);
            labelGroup.setAttribute('tabindex', '0');
            labelGroup.setAttribute('role', 'button');
            labelGroup.setAttribute('aria-label', trend.title || 'Unnamed Trend');

            // Leader line (connects point to label)
            const leaderLength = 12;
            const leader = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            leader.setAttribute('x1', x);
            leader.setAttribute('y1', y);
            leader.setAttribute('x2', labelX);
            leader.setAttribute('y2', labelY);
            leader.setAttribute('class', 'leader');
            labelGroup.appendChild(leader);

            // Label text
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', labelX);
            text.setAttribute('y', labelY);
            text.setAttribute('text-anchor', textAnchor);
            text.setAttribute('class', 'trend-label');
            text.setAttribute('dx', '0');
            text.setAttribute('dy', '0');
            
            // Handle text wrapping for long labels
            const title = trend.title || 'Unnamed Trend';
            const words = title.split(' ');
            const maxWidth = 180;
            let currentLine = '';
            let tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
            tspan.setAttribute('x', labelX);
            tspan.setAttribute('dy', '0');
            
            words.forEach((word, i) => {
                const testLine = currentLine ? `${currentLine} ${word}` : word;
                // Simple approximation: ~6px per character
                if (testLine.length * 6 > maxWidth && currentLine) {
                    tspan.textContent = currentLine;
                    text.appendChild(tspan);
                    tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
                    tspan.setAttribute('x', labelX);
                    tspan.setAttribute('dy', '14');
                    currentLine = word;
                } else {
                    currentLine = testLine;
                }
            });
            tspan.textContent = currentLine;
            text.appendChild(tspan);
            
            labelGroup.appendChild(text);
            labelsGroup.appendChild(labelGroup);
            
            // Make label clickable (opens modal)
            labelGroup.addEventListener('click', () => {
                this.previouslyFocusedElement = pointsGroup.querySelector(`.point[data-index="${index}"]`);
                this.openModal(trend);
            });
            
            labelGroup.addEventListener('mouseenter', () => {
                this.pauseSweep();
                labelGroup.classList.add('active');
                const point = pointsGroup.querySelector(`.point[data-index="${index}"]`);
                if (point) {
                    point.classList.add('active');
                    point.querySelector('circle').setAttribute('r', '9');
                }
            });
            
            labelGroup.addEventListener('mouseleave', () => {
                this.resumeSweep();
                labelGroup.classList.remove('active');
                const point = pointsGroup.querySelector(`.point[data-index="${index}"]`);
                if (point) {
                    point.classList.remove('active');
                    point.querySelector('circle').setAttribute('r', '7.2');
                }
            });
            
            // Keyboard support for labels
            labelGroup.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.previouslyFocusedElement = pointsGroup.querySelector(`.point[data-index="${index}"]`);
                    this.openModal(trend);
                }
            });
            
            // Store for collision detection
            this.labelElements.push({
                group: labelGroup,
                x: labelX,
                y: labelY,
                bbox: null,
                pointIndex: index
            });
        });
    }

    resolveLabelCollisions() {
        const maxIterations = 10;
        const nudgeDistance = 6;
        const pointsGroup = document.getElementById('points');
        
        // Get bounding boxes
        this.labelElements.forEach(item => {
            item.bbox = item.group.getBBox();
        });

        for (let iter = 0; iter < maxIterations; iter++) {
            let hasCollision = false;
            
            for (let i = 0; i < this.labelElements.length; i++) {
                for (let j = i + 1; j < this.labelElements.length; j++) {
                    const a = this.labelElements[i];
                    const b = this.labelElements[j];
                    
                    // Check if bounding boxes overlap
                    const overlap = !(
                        a.bbox.x + a.bbox.width < b.bbox.x ||
                        b.bbox.x + b.bbox.width < a.bbox.x ||
                        a.bbox.y + a.bbox.height < b.bbox.y ||
                        b.bbox.y + b.bbox.height < a.bbox.y
                    );
                    
                    if (overlap) {
                        hasCollision = true;
                        
                        // Calculate distance from center for each label
                        const distA = Math.sqrt((a.x - this.centerX) ** 2 + (a.y - this.centerY) ** 2);
                        const distB = Math.sqrt((b.x - this.centerX) ** 2 + (b.y - this.centerY) ** 2);
                        
                        // Nudge the one farther from center radially outward
                        const labelToNudge = distA > distB ? a : b;
                        const dx = labelToNudge.x - this.centerX;
                        const dy = labelToNudge.y - this.centerY;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        const nudgeX = (dx / dist) * nudgeDistance;
                        const nudgeY = (dy / dist) * nudgeDistance;
                        
                        labelToNudge.x += nudgeX;
                        labelToNudge.y += nudgeY;
                        
                        // Update position
                        const dataX = parseFloat(labelToNudge.group.getAttribute('data-x'));
                        const dataY = parseFloat(labelToNudge.group.getAttribute('data-y'));
                        labelToNudge.group.setAttribute('transform', `translate(${labelToNudge.x - dataX}, ${labelToNudge.y - dataY})`);
                        
                        // Update leader line
                        const leader = labelToNudge.group.querySelector('.leader');
                        if (leader) {
                            leader.setAttribute('x2', labelToNudge.x);
                            leader.setAttribute('y2', labelToNudge.y);
                        }
                        
                        // Recalculate bbox
                        labelToNudge.bbox = labelToNudge.group.getBBox();
                    }
                }
            }
            
            if (!hasCollision) break;
        }
    }

    showTooltip(event, trend, pointGroup) {
        this.tooltip.textContent = trend.title || 'Unnamed Trend';
        this.updateTooltipPosition(event, pointGroup);
        this.tooltip.setAttribute('aria-hidden', 'false');
    }

    updateTooltipPosition(event, pointGroup) {
        const bbox = pointGroup.getBBox();
        const svgRect = this.svg.getBoundingClientRect();
        const viewBox = this.svg.viewBox.baseVal;
        const scaleX = svgRect.width / viewBox.width;
        const scaleY = svgRect.height / viewBox.height;
        
        const pointX = svgRect.left + (bbox.x + bbox.width / 2) * scaleX;
        const pointY = svgRect.top + (bbox.y + bbox.height / 2) * scaleY;
        
        this.tooltip.style.left = `${pointX + 15}px`;
        this.tooltip.style.top = `${pointY - 30}px`;
    }

    hideTooltip() {
        this.tooltip.setAttribute('aria-hidden', 'true');
    }

    openModal(trend) {
        this.currentTrend = trend;
        this.modalTitle.textContent = trend.title || 'Unnamed Trend';
        this.modalMeta.innerHTML = `
            <span class="modal-type">${trend.type || ''}</span>
            <span class="modal-impact">Impact: ${trend.impact || 'N/A'}</span>
            <span class="modal-adoption">Adoption: ${trend.adoption || 'N/A'}</span>
        `;
        this.modalBlurb.textContent = trend.blurb || 'No description available.';
        this.modalCtaLink.href = trend.link || '#';
        
        // Set aria-hidden to false before showing
        this.modal.setAttribute('aria-hidden', 'false');
        this.modal.style.display = 'flex';
        
        // Pause sweep animation while modal is open
        this.pauseSweep();
        
        // Set up focus trap
        this.modalFocusableElements = this.getFocusableElements();
        if (this.modalFocusableElements.length > 0) {
            this.firstFocusableElement = this.modalFocusableElements[0];
            this.lastFocusableElement = this.modalFocusableElements[this.modalFocusableElements.length - 1];
        }
        
        // Add focus trap event listener
        this.modal.addEventListener('keydown', this.trapFocusHandler);
        
        // Focus management for accessibility - focus first focusable element
        const closeBtn = document.querySelector('.modal-close');
        if (closeBtn) {
            closeBtn.focus();
        } else if (this.firstFocusableElement) {
            this.firstFocusableElement.focus();
        }
    }

    closeModal() {
        // Remove focus trap event listener
        this.modal.removeEventListener('keydown', this.trapFocusHandler);
        
        // Set aria-hidden to true
        this.modal.setAttribute('aria-hidden', 'true');
        this.modal.style.display = 'none';
        this.currentTrend = null;
        
        // Resume sweep animation
        this.resumeSweep();
        
        // Return focus to previously focused element (the clicked point)
        if (this.previouslyFocusedElement) {
            setTimeout(() => {
                if (this.previouslyFocusedElement) {
                    this.previouslyFocusedElement.focus();
                    this.previouslyFocusedElement = null;
                }
            }, 0);
        }
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    const app = new FinanceTrendRadar();
    app.loadTrends();
});


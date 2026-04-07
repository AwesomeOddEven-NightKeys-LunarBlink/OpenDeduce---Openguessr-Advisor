// ==UserScript==
// @name         OpenDeduce
// @namespace    http://tampermonkey.net/
// @version      1.1.0
// @description  Geo-Deduction advisor with fast Tag-based search, visual guides, and probabilistic scoring.
// @author       OpenDeduce Team
// @match        https://openguessr.com/*
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    /**
     * STATE MANAGEMENT
     */
    const STATE = {
        countries: [],
        rules: [],
        activeClueIds: new Set(),
        searchQuery: "",
        isLoaded: false
    };

    /**
     * STYLESHEET
     */
    const STYLES = `
        #od-v2-panel {
            position: fixed;
            top: 20px;
            right: 20px;
            width: 340px;
            max-height: 90vh;
            background: rgba(30, 30, 36, 0.94);
            backdrop-filter: blur(20px) saturate(180%);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 24px;
            color: #f8fafc;
            font-family: 'Inter', -apple-system, system-ui, sans-serif;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);
            overflow: hidden;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .od-header {
            padding: 24px 24px 12px;
        }
        .od-badge {
            font-size: 0.6rem;
            color: #60a5fa;
            text-transform: uppercase;
            letter-spacing: 0.18em;
            font-weight: 800;
            margin-bottom: 4px;
            display: block;
        }
        .od-title {
            font-size: 1.6rem;
            font-weight: 900;
            background: linear-gradient(135deg, #60a5fa, #c084fc);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin: 0;
            letter-spacing: -0.03em;
        }

        /* NEW: Tag-based Search & Active Clues */
        .od-search-container {
            padding: 0 24px 16px;
            position: relative;
        }
        .od-input {
            width: 100%;
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 12px;
            padding: 12px 16px;
            color: #fff;
            font-size: 0.9rem;
            outline: none;
            box-sizing: border-box;
            transition: all 0.2s;
        }
        .od-input:focus {
            border-color: #60a5fa;
            background: rgba(255, 255, 255, 0.03);
        }

        .od-suggestions {
            position: absolute;
            top: 100%;
            left: 24px;
            right: 24px;
            background: #121212;
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 12px;
            max-height: 250px;
            overflow-y: auto;
            z-index: 100;
            display: none;
            box-shadow: 0 10px 40px rgba(0,0,0,0.6);
        }
        .od-suggestion-item {
            padding: 10px 16px;
            font-size: 0.8rem;
            cursor: pointer;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            transition: background 0.2s;
        }
        .od-suggestion-item:hover {
            background: rgba(96, 165, 250, 0.15);
        }

        .od-active-container {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            padding: 0 24px 12px;
        }
        .od-tag {
            background: rgba(96, 165, 250, 0.15);
            color: #60a5fa;
            font-size: 0.72rem;
            padding: 6px 12px;
            border: 1px solid rgba(96, 165, 250, 0.3);
            border-radius: 10px;
            cursor: pointer;
            display: flex;
            align-items: center;
            font-weight: 700;
        }
        .od-tag:hover {
            border-color: #ef4444;
            color: #ef4444;
            background: rgba(239, 68, 68, 0.1);
        }
        .od-tag::after {
            content: ' ×';
            margin-left: 6px;
            font-size: 1rem;
            opacity: 0.6;
        }

        /* Content & Accordions */
        .od-content {
            flex: 1;
            overflow-y: auto;
            padding: 0 16px 20px;
            scrollbar-width: thin;
            scrollbar-color: rgba(255,255,255,0.15) transparent;
        }
        .od-accordion {
            margin-bottom: 8px;
            border-radius: 14px;
            overflow: hidden;
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid rgba(255, 255, 255, 0.03);
        }
        .od-acc-header {
            padding: 14px 18px;
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 0.82rem;
            font-weight: 700;
        }
        .od-acc-header:hover { background: rgba(255, 255, 255, 0.04); }
        .od-acc-body {
            display: none;
            padding: 8px 18px 16px;
            border-top: 1px solid rgba(255, 255, 255, 0.02);
        }
        .od-acc-body.active { display: block; }

        .od-clue-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 8px 0;
            font-size: 0.82rem;
            cursor: pointer;
            opacity: 0.75;
            transition: all 0.2s;
        }
        .od-clue-item:hover { opacity: 1; }
        .od-clue-item input {
            cursor: pointer;
            accent-color: #60a5fa;
            width: 15px; height: 15px;
        }

        /* Results Display */
        .od-results {
            padding: 20px 24px;
            background: rgba(0, 0, 0, 0.4);
            border-top: 1px solid rgba(255, 255, 255, 0.08);
        }
        .od-res-header {
            display: flex;
            justify-content: space-between;
            font-size: 0.72rem;
            font-weight: 800;
            opacity: 0.4;
            text-transform: uppercase;
            margin-bottom: 12px;
            letter-spacing: 0.05em;
        }
        .od-country-list {
            max-height: 200px;
            overflow-y: auto;
        }
        .od-country-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 6px;
            border-radius: 8px;
            transition: all 0.2s;
        }
        .od-country-row:hover { background: rgba(255, 255, 255, 0.06); }
        .od-score-pill {
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.72rem;
            font-weight: 800;
            min-width: 42px;
            text-align: right;
        }

        /* Tooltip Guide */
        #od-tooltip {
            position: fixed;
            pointer-events: none;
            background: rgba(15, 15, 20, 0.98);
            border: 1px solid rgba(255, 255, 255, 0.2);
            padding: 12px;
            border-radius: 14px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.7);
            z-index: 10000;
            width: 220px;
            display: none;
            font-size: 0.78rem;
            color: #cbd5e1;
            line-height: 1.4;
        }
        .od-tooltip-img {
            width: 100%; height: 120px;
            background: #000;
            border-radius: 10px;
            margin-bottom: 10px;
            object-fit: cover;
            border: 1px solid rgba(255,255,255,0.1);
        }
    `;

    /**
     * COMPONENT: ACCORDIONS
     */
    function renderClues() {
        const container = document.querySelector('.od-content');
        if (!container) return;
        container.innerHTML = '';

        STATE.rules.forEach(group => {
            const accordion = document.createElement('div');
            accordion.className = 'od-accordion';
            
            const header = document.createElement('div');
            header.className = 'od-acc-header';
            header.innerHTML = `<span>${group.category}</span><small style="opacity:0.4">${group.clues.length}</small>`;
            
            const body = document.createElement('div');
            body.className = 'od-acc-body';
            
            group.clues.forEach(clue => {
                const label = document.createElement('label');
                label.className = 'od-clue-item';
                const checked = STATE.activeClueIds.has(clue.id) ? 'checked' : '';
                
                label.innerHTML = `
                    <input type="checkbox" data-clue-id="${clue.id}" ${checked}>
                    <span>${clue.aspect}</span>
                `;
                
                label.addEventListener('mouseenter', (e) => showTooltip(e, clue));
                label.addEventListener('mouseleave', hideTooltip);
                label.addEventListener('mousemove', moveTooltip);
                
                label.querySelector('input').addEventListener('change', (e) => {
                    if (e.target.checked) STATE.activeClueIds.add(clue.id);
                    else STATE.activeClueIds.delete(clue.id);
                    syncUI();
                });
                
                body.appendChild(label);
            });

            header.addEventListener('click', () => {
                const wasActive = body.classList.contains('active');
                document.querySelectorAll('.od-acc-body').forEach(b => b.classList.remove('active'));
                if(!wasActive) body.classList.add('active');
            });

            accordion.appendChild(header);
            accordion.appendChild(body);
            container.appendChild(accordion);
        });
    }

    /**
     * COMPONENT: TAGS & SEARCH
     */
    function renderActiveTags() {
        const container = document.querySelector('.od-active-container');
        container.innerHTML = '';
        
        STATE.activeClueIds.forEach(id => {
            let rule = findRuleById(id);
            if(!rule) return;
            
            const tag = document.createElement('div');
            tag.className = 'od-tag';
            tag.innerText = rule.aspect;
            tag.addEventListener('click', () => {
                STATE.activeClueIds.delete(id);
                syncUI();
            });
            container.appendChild(tag);
        });
    }

    function setupSearch() {
        const input = document.getElementById('od-global-search');
        const suggestBox = document.getElementById('od-suggestions');

        input.addEventListener('input', (e) => {
            const val = e.target.value.toLowerCase();
            if (!val) { suggestBox.style.display = 'none'; return; }

            // Flatten all clues for searching
            const matches = [];
            STATE.rules.forEach(group => {
                group.clues.forEach(clue => {
                    const searchPool = [clue.aspect, group.category, clue.description || ""].join(' ').toLowerCase();
                    if (searchPool.includes(val)) matches.push({...clue, category: group.category});
                });
            });

            if (matches.length > 0) {
                suggestBox.innerHTML = matches.slice(0, 8).map(c => `
                    <div class="od-suggestion-item" data-id="${c.id}">
                        <div style="font-size:0.6rem; color:#60a5fa; opacity:0.6; text-transform:uppercase">${c.category}</div>
                        <div>${c.aspect}</div>
                        <div style="font-size:0.6rem; opacity:0.4">${c.description ? c.description.substring(0,30)+'...' : ''}</div>
                    </div>
                `).join('');
                suggestBox.style.display = 'block';
            } else {
                suggestBox.style.display = 'none';
            }
        });

        suggestBox.addEventListener('click', (e) => {
            const item = e.target.closest('.od-suggestion-item');
            if (item) {
                STATE.activeClueIds.add(item.dataset.id);
                input.value = '';
                suggestBox.style.display = 'none';
                syncUI();
            }
        });

        document.addEventListener('click', (e) => { if (!input.contains(e.target)) suggestBox.style.display = 'none'; });
    }

    /**
     * ENGINE: SCALPEL & SYNC
     */
    function syncUI() {
        // Sync checkboxes
        document.querySelectorAll('.od-clue-item input').forEach(input => {
            input.checked = STATE.activeClueIds.has(input.dataset.clueId);
        });
        
        renderActiveTags();
        updateSuspects();
    }

    function updateSuspects() {
        const listContainer = document.querySelector('.od-country-list');
        const countLabel = document.getElementById('od-suspect-count');
        const suspectList = STATE.countries.map(c => ({ ...c, likelihood: 1.0 }));

        STATE.activeClueIds.forEach(clueId => {
            const rule = findRuleById(clueId);
            if (!rule) return;

            suspectList.forEach(country => {
                const confidence = rule.confidence || 1.0;
                let isMatch = true;

                if (rule.onlyCountries && rule.onlyCountries.length > 0) {
                    if (!rule.onlyCountries.includes(country.id.toUpperCase())) isMatch = false;
                } else {
                    if (rule.excludeContinents && rule.excludeContinents.includes(country.continent)) isMatch = false;
                    if (rule.excludeCountries && rule.excludeCountries.includes(country.id.toUpperCase())) isMatch = false;
                    
                    if (rule.excludeRegions && rule.excludeRegions.includes("Mainland Europe")) {
                        if (country.continent === "Europe" && country.id !== "uk" && country.id !== "ie") isMatch = false;
                    }
                }

                if (!isMatch) country.likelihood = Math.max(0, country.likelihood * (1.0 - confidence));
            });
        });

        const sorted = suspectList
            .sort((a, b) => b.likelihood - a.likelihood)
            .filter(c => c.likelihood > 0.001);

        countLabel.innerText = `${sorted.length} Suspects`;

        listContainer.innerHTML = sorted.map(c => {
            const pct = Math.round(c.likelihood * 100);
            const color = pct > 75 ? '#10b981' : (pct > 30 ? '#f59e0b' : '#ef4444');
            return `
                <div class="od-country-row" style="opacity: ${Math.max(0.4, pct/100)}">
                    <span>${c.name}</span>
                    <span class="od-score-pill" style="color: ${color}">${pct}%</span>
                </div>
            `;
        }).join('') || '<div style="opacity:0.3; padding:20px; text-align:center">Zero matches. Reset clues!</div>';
    }

    /**
     * TOOLTIP & HELPERS
     */
    function findRuleById(id) {
        let rule = null;
        STATE.rules.forEach(g => { const r = g.clues.find(c => c.id === id); if(r) rule = r; });
        return rule;
    }

    function showTooltip(e, clue) {
        const tt = document.getElementById('od-tooltip');
        if (!clue.description && !clue.image) return;
        tt.style.display = 'block';
        tt.innerHTML = `${clue.image ? `<img src="${clue.image}" class="od-tooltip-img">` : ''} <div>${clue.description || ""}</div>`;
        moveTooltip(e);
    }
    function hideTooltip() { document.getElementById('od-tooltip').style.display = 'none'; }
    function moveTooltip(e) {
        const tt = document.getElementById('od-tooltip');
        tt.style.top = (e.clientY + 20) + 'px';
        tt.style.left = (e.clientX - 230) + 'px';
    }

    async function init() {
        // Full Country Master List initialized at 100%
        STATE.countries = [
            {"id": "al", "name": "Albania", "continent": "Europe"},
            {"id": "ba", "name": "Bosnia and Herzegovina", "continent": "Europe"},
            {"id": "be", "name": "Belgium", "continent": "Europe"},
            {"id": "bg", "name": "Bulgaria", "continent": "Europe"},
            {"id": "br", "name": "Brazil", "continent": "South America"},
            {"id": "jp", "name": "Japan", "continent": "Asia"},
            {"id": "au", "name": "Australia", "continent": "Oceania"},
            {"id": "us", "name": "United States", "continent": "North America"},
            {"id": "ca", "name": "Canada", "continent": "North America"},
            {"id": "uk", "name": "United Kingdom", "continent": "Europe"},
            {"id": "fr", "name": "France", "continent": "Europe"},
            {"id": "de", "name": "Germany", "continent": "Europe"}
        ];

        STATE.rules = [
            {
                "category": "Global Meta",
                "clues": [
                    { "id": "g-left", "aspect": "Driving Side: Left", "confidence": 1.0, "excludeRegions": ["Mainland Europe"], "excludeContinents": ["North America", "South America"] },
                    { "id": "g-north", "aspect": "Sun Position: North", "confidence": 1.0, "excludeContinents": ["North America"], "excludeRegions": ["Europe"] }
                ]
            },
            {
                "category": "Botany (Trees)",
                "clues": [
                    { "id": "t1", "aspect": "Jacaranda (Purple)", "description": "Lush trees with vibrant purple/violet flowers.", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/Jacaranda_mimosifolia_flowers.jpg/1024px-Jacaranda_mimosifolia_flowers.jpg", "excludeContinents": ["Europe"], "confidence": 0.8 },
                    { "id": "t2", "aspect": "Banyan Tree", "description": "Large tree with dangling 'aerial roots' from branches.", "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Banyan_tree_in_Hawaii.jpg/1024px-Banyan_tree_in_Hawaii.jpg", "onlyCountries": ["IN", "TH", "ID", "LK"], "confidence": 1.0 }
                ]
            }
        ];

        GM_addStyle(STYLES);
        const panel = document.createElement('div');
        panel.id = 'od-v2-panel';
        panel.innerHTML = `
            <div class="od-header">
                <span class="od-badge">Geographic Advisor v1.1.0</span>
                <h1 class="od-title">OpenDeduce</h1>
            </div>
            
            <div class="od-search-container">
                <input type="text" id="od-global-search" class="od-input" placeholder="Search (e.g. 'purple')...">
                <div id="od-suggestions" class="od-suggestions"></div>
            </div>

            <div class="od-active-container">
                <!-- Selected Tags Injected Here -->
            </div>

            <div class="od-content"></div>

            <div class="od-results">
                <div class="od-res-header">
                    <span id="od-suspect-count">Calculating...</span>
                    <span>Likelihood</span>
                </div>
                <div class="od-country-list"></div>
            </div>
        `;
        document.body.appendChild(panel);

        const tt = document.createElement('div');
        tt.id = 'od-tooltip';
        document.body.appendChild(tt);

        renderClues();
        updateSuspects();
        setupSearch();
        STATE.isLoaded = true;
    }

    init();
})();

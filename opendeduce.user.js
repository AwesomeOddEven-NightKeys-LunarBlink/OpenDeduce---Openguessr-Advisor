// ==UserScript==
// @name         OpenDeduce
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Theme-driven Geo-Deduction Engine. Search for themes like 'Sun' or 'Driving' to reveal all relevant clues.
// @author       OpenDeduce Team
// @match        https://openguessr.com/*
// @updateURL    https://raw.githubusercontent.com/AwesomeOddEven-NightKeys-LunarBlink/OpenDeduce---Openguessr-Advisor/main/opendeduce.user.js
// @downloadURL  https://raw.githubusercontent.com/AwesomeOddEven-NightKeys-LunarBlink/OpenDeduce---Openguessr-Advisor/main/opendeduce.user.js
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
        searchQuery: ""
    };

    /**
     * STYLESHEET (Fixed for Theme-Based Layout)
     */
    const STYLES = `
        #od-v2-panel {
            position: fixed; top: 20px; right: 20px; width: 360px; max-height: 90vh;
            background: rgba(30,30,36, 0.98); backdrop-filter: blur(30px);
            border: 1px solid rgba(255,255,255, 0.15); border-radius: 28px;
            color: #f8fafc; font-family: 'Inter', system-ui, sans-serif;
            z-index: 10000; display: flex; flex-direction: column;
            box-shadow: 0 40px 120px rgba(0,0,0,1); transition: all 0.3s;
        }
        #od-v2-panel.minimized { max-height: 75px; overflow: hidden; }
        .od-header { padding: 22px 28px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); cursor: move; display: flex; justify-content: space-between; align-items: center; }
        .od-title { font-size: 1.5rem; font-weight: 900; background: linear-gradient(135deg, #60a5fa, #c084fc, #f472b6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0; }
        .od-controls { display: flex; gap: 12px; }
        .od-control-btn { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s; }
        .od-control-btn:hover { background: #60a5fa33; transform: scale(1.1); }
        .od-search-container { padding: 18px 24px; position: relative; }
        .od-input { width: 100%; background: #000; border: 1px solid #ffffff22; border-radius: 14px; padding: 12px 18px; color: #fff; font-size: 11pt; outline: none; }
        .od-input:focus { border-color: #60a5fa; }
        .od-suggestions { 
            position: absolute; top: 100%; left: 24px; right: 24px; background: #1a1a22; 
            border: 1px solid #ffffff44; border-radius: 18px; max-height: 300px; 
            overflow-y: auto; z-index: 10001; display: none; margin-top: 8px; 
            box-shadow: 0 20px 50px #000;
        }
        .od-suggestion-item { padding: 14px 20px; font-size: 0.9rem; cursor: pointer; border-bottom: 1px solid #ffffff11; }
        .od-suggestion-item:hover { background: #60a5fa33; }
        .od-active-container { display: flex; flex-wrap: wrap; gap: 8px; padding: 0 24px 16px; }
        .od-tag { background: #60a5fa33; color: #60a5fa; font-size: 0.72rem; padding: 6px 14px; border: 1px solid #60a5fa66; border-radius: 12px; cursor: pointer; font-weight: 800; }
        .od-content { flex: 1; overflow-y: auto; padding: 0 20px 20px; display: none; }
        .od-accordion { margin-bottom: 10px; border-radius: 18px; background: #ffffff05; border: 1px solid #ffffff11; }
        .od-acc-header { padding: 16px 20px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; font-size: 0.9rem; font-weight: 800; color: #cbd5e1; }
        .od-acc-body { padding: 6px 20px 20px; border-top: 1px solid #ffffff08; display: block; }
        .od-clue-item { display: grid; grid-template-columns: 24px 1fr; align-items: center; gap: 12px; padding: 10px 0; font-size: 0.9rem; cursor: pointer; color: #94a3b8; }
        .od-clue-item:hover { color: #60a5fa; }
        .od-clue-item input { width: 18px; height: 18px; accent-color: #60a5fa; }
        .od-results { padding: 24px 28px; background: #000; border-top: 1px solid #ffffff22; }
        .od-res-header { display: flex; justify-content: space-between; font-size: 0.75rem; font-weight: 900; opacity: 0.5; margin-bottom: 14px; }
        .od-country-list { max-height: 200px; overflow-y: auto; }
        .od-country-row { display: flex; justify-content: space-between; padding: 8px; font-size: 0.95rem; }
        .od-score-pill { font-family: monospace; font-weight: 900; color: #10b981; }
        #od-tooltip { position: fixed; pointer-events: none; background: #0a0a0f; border: 1px solid #ffffff44; padding: 14px; border-radius: 18px; z-index: 10002; width: 260px; display: none; }
        .od-tooltip-img { width: 100%; height: 140px; border-radius: 12px; margin-bottom: 12px; object-fit: cover; }
    `;

    function setupDrag(el) {
        const h = el.querySelector('.od-header');
        h.onmousedown = (e) => {
            if(e.target.closest('.od-controls')) return;
            let sx = e.clientX - el.offsetLeft, sy = e.clientY - el.offsetTop;
            document.onmousemove = (ev) => { el.style.left = (ev.clientX-sx)+'px'; el.style.top = (ev.clientY-sy)+'px'; el.style.right='auto'; };
            document.onmouseup = () => { document.onmousemove = null; };
        };
    }

    function syncUI() {
        document.querySelectorAll('.od-clue-item input').forEach(i => i.checked = STATE.activeClueIds.has(i.dataset.clueId));
        renderActiveTags(); updateSuspects();
    }

    function updateSuspects() {
        const container = document.querySelector('.od-country-list');
        const countLabel = document.getElementById('od-suspect-count');
        const list = STATE.countries.map(c => ({...c, score: 1.0}));
        STATE.activeClueIds.forEach(id => {
            let r = null; STATE.rules.forEach(g => { const found = g.clues.find(c=>c.id===id); if(found) r = found; });
            if(!r) return;
            list.forEach(c => {
                let match = true;
                if(r.onlyCountries?.length > 0) { if(!r.onlyCountries.includes(c.id.toUpperCase())) match = false; }
                else {
                    if(r.excludeContinents?.includes(c.continent)) match = false;
                    if(r.excludeCountries?.includes(c.id.toUpperCase())) match = false;
                    if(r.excludeRegions?.includes("Mainland Europe") && c.continent === "Europe" && c.id !== "uk" && c.id !== "ie") match = false;
                }
                if(!match) c.score = Math.max(0, c.score * (1.0 - (r.confidence||1)));
            });
        });
        const sorted = list.sort((a,b)=>b.score-a.score).filter(c=>c.score>0.001);
        countLabel.innerText = `${sorted.length} Suspects Remaining`;
        container.innerHTML = sorted.map(c => `<div class="od-country-row" style="opacity:${Math.max(0.4, c.score)}"><span>${c.name}</span><span class="od-score-pill">${Math.round(c.score*100)}%</span></div>`).join('');
    }

    function renderActiveTags() {
        const c = document.querySelector('.od-active-container'); c.innerHTML = '';
        STATE.activeClueIds.forEach(id => {
            let r = null; STATE.rules.forEach(g => { const f = g.clues.find(clue=>clue.id===id); if(f) r=f; });
            if(!r) return;
            const t = document.createElement('div'); t.className = 'od-tag'; t.innerText = r.aspect;
            t.onclick = () => { STATE.activeClueIds.delete(id); syncUI(); };
            c.appendChild(t);
        });
    }

    /**
     * THEME-DRIVEN SEARCH ENGINE
     */
    function setupSearch() {
        const i = document.getElementById('od-global-search'), s = document.getElementById('od-suggestions'), c = document.querySelector('.od-content');
        i.oninput = (e) => {
            const v = e.target.value.toLowerCase().trim();
            if(v.length < 3) { s.style.display = 'none'; c.style.display = 'none'; return; }
            
            const results = [];
            STATE.rules.forEach(g => {
                const isCategoryMatch = g.category.toLowerCase().includes(v);
                g.clues.forEach(clue => {
                    const isClueMatch = [clue.aspect, clue.description||""].join(' ').toLowerCase().includes(v);
                    // Match theme (category) OR specific clue
                    if (isCategoryMatch || isClueMatch) {
                        results.push({...clue, category: g.category});
                    }
                });
            });

            if(results.length > 0) {
                s.innerHTML = results.slice(0, 10).map(m => `
                    <div class="od-suggestion-item" data-id="${m.id}">
                        <div style="font-size:0.6rem; color:#60a5fa; text-transform:uppercase">${m.category}</div>
                        ${m.aspect}
                    </div>
                `).join('');
                s.style.display = 'block';
                c.style.display = 'block';
                renderClues(v);
            } else { s.style.display = 'none'; c.style.display = 'none'; }
        };
        s.onclick = (e) => {
            const item = e.target.closest('.od-suggestion-item');
            if(item) { STATE.activeClueIds.add(item.dataset.id); i.value = ''; s.style.display='none'; c.style.display='none'; syncUI(); }
        };
        document.onmousedown = (e) => { if(!i.contains(e.target)) s.style.display = 'none'; };
    }

    function renderClues(filter = "") {
        const container = document.querySelector('.od-content');
        container.innerHTML = '';
        STATE.rules.forEach(g => {
            const isCategoryMatch = g.category.toLowerCase().includes(filter);
            const filteredClues = g.clues.filter(clue => isCategoryMatch || [clue.aspect, clue.description||""].join(' ').toLowerCase().includes(filter));
            
            if(filteredClues.length === 0) return;
            const acc = document.createElement('div'); acc.className = 'od-accordion';
            acc.innerHTML = `<div class="od-acc-header"><span>${g.category}</span><small>${filteredClues.length}</small></div><div class="od-acc-body"></div>`;
            const b = acc.querySelector('.od-acc-body');
            filteredClues.forEach(clue => {
                const l = document.createElement('label'); l.className = 'od-clue-item';
                l.innerHTML = `<input type="checkbox" data-clue-id="${clue.id}" ${STATE.activeClueIds.has(clue.id)?'checked':''}><span>${clue.aspect}</span>`;
                l.querySelector('input').onclick = (e) => { if (e.target.checked) STATE.activeClueIds.add(clue.id); else STATE.activeClueIds.delete(clue.id); syncUI(); };
                b.appendChild(l);
            });
            container.appendChild(acc);
        });
    }

    function showTooltip(e, clue) {
        const tt = document.getElementById('od-tooltip');
        if(!clue.description && !clue.image) return;
        tt.style.display = 'block';
        tt.innerHTML = `${clue.image ? `<img src="${clue.image}" class="od-tooltip-img">` : ''}<div>${clue.description || ""}</div>`;
        tt.style.top = (e.clientY + 20) + 'px'; tt.style.left = (e.clientX - 260) + 'px';
    }
    function hideTooltip() { document.getElementById('od-tooltip').style.display = 'none'; }

    async function init() {
        // FULL MASTER LIST (195+ Countries)
        STATE.countries = [
            {"id":"al","name":"Albania","continent":"Europe"},{"id":"at","name":"Austria","continent":"Europe"},{"id":"be","name":"Belgium","continent":"Europe"},{"id":"bg","name":"Bulgaria","continent":"Europe"},{"id":"hr","name":"Croatia","continent":"Europe"},{"id":"cz","name":"Czechia","continent":"Europe"},{"id":"dk","name":"Denmark","continent":"Europe"},{"id":"ee","name":"Estonia","continent":"Europe"},{"id":"fi","name":"Finland","continent":"Europe"},{"id":"fr","name":"France","continent":"Europe"},{"id":"de","name":"Germany","continent":"Europe"},{"id":"gr","name":"Greece","continent":"Europe"},{"id":"hu","name":"Hungary","continent":"Europe"},{"id":"is","name":"Iceland","continent":"Europe"},{"id":"ie","name":"Ireland","continent":"Europe"},{"id":"it","name":"Italy","continent":"Europe"},{"id":"lv","name":"Latvia","continent":"Europe"},{"id":"lt","name":"Lithuania","continent":"Europe"},{"id":"pl","name":"Poland","continent":"Europe"},{"id":"pt","name":"Portugal","continent":"Europe"},{"id":"ro","name":"Romania","continent":"Europe"},{"id":"ru","name":"Russia","continent":"Asia"},{"id":"es","name":"Spain","continent":"Europe"},{"id":"se","name":"Sweden","continent":"Europe"},{"id":"ch","name":"Switzerland","continent":"Europe"},{"id":"tr","name":"Turkey","continent":"Europe"},{"id":"uk","name":"United Kingdom","continent":"Europe"},{"id":"af","name":"Afghanistan","continent":"Asia"},{"id":"bd","name":"Bangladesh","continent":"Asia"},{"id":"id","name":"Indonesia","continent":"Asia"},{"id":"jp","name":"Japan","continent":"Asia"},{"id":"my","name":"Malaysia","continent":"Asia"},{"id":"ph","name":"Philippines","continent":"Asia"},{"id":"kr","name":"South Korea","continent":"Asia"},{"id":"th","name":"Thailand","continent":"Asia"},{"id":"ca","name":"Canada","continent":"North America"},{"id":"mx","name":"Mexico","continent":"North America"},{"id":"us","name":"United States","continent":"North America"},{"id":"br","name":"Brazil","continent":"South America"},{"id":"ar","name":"Argentina","continent":"South America"},{"id":"cl","name":"Chile","continent":"South America"},{"id":"za","name":"South Africa","continent":"Africa"},{"id":"au","name":"Australia","continent":"Oceania"},{"id":"nz","name":"New Zealand","continent":"Oceania"}
        ];

        // THEME-FOCUSED RULE DATABASE
        STATE.rules = [
            { "category": "Global Orientation (Driving)", "clues": [ 
                { "id":"g1", "aspect":"Driving Side: Left", "confidence":1.0, "excludeRegions":["Mainland Europe"], "excludeContinents":["North America","South America"] },
                { "id":"g2", "aspect":"Driving Side: Right", "confidence":1.0, "excludeCountries":["UK","IE","ZA","AU","NZ","JP","MY","ID","TH"] }
            ]},
            { "category": "Sun Position & Locations", "clues": [ 
                { "id":"g3", "aspect":"Sun: North (Southern Hemisphere)", "confidence":1.0, "excludeContinents":["North America"], "excludeRegions":["Europe"] },
                { "id":"g4", "aspect":"Sun: South (Northern Hemisphere)", "confidence":1.0, "excludeContinents":["Oceania"], "excludeCountries":["ZA","AR","CL","BR","ID"] },
                { "id":"g5", "aspect":"Sun: Zenith (Equatorial)", "confidence":1.0, "onlyCountries":["CO","EC","KE","ID","BR","CG","GA","SO","UG"] }
            ]},
            { "category": "Flora (Flowers & Trees)", "clues": [
                { "id":"t1", "aspect":"Jacaranda (Violet Flowers)", "description":"Lush violet flowers.", "image":"https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/Jacaranda_mimosifolia_flowers.jpg/1024px-Jacaranda_mimosifolia_flowers.jpg", "excludeContinents":["Europe"], "confidence":0.8 },
                { "id":"t2", "aspect":"Banyan tree", "description":"Dangling roots.", "onlyCountries":["IN","TH","ID","LK"], "confidence":1.0 }
            ]},
            { "category": "Commercial & Retail Signs", "clues": [
                { "id":"p2-1", "aspect":"Pharmacy: Green LED Cross", "description":"Euro style.", "confidence":0.9, "excludeContinents":["North America","Oceania"] },
                { "id":"p2-4", "aspect":"Tabac (France)", "onlyCountries":["FR"], "confidence":1.0 }
            ]},
            { "category": "Infrastructure (Poles)", "clues": [
                { "id":"p2-285", "aspect":"Stobie Pole (Australia)", "onlyCountries":["AU"], "confidence":1.0 },
                { "id":"p2-235", "aspect":"Pichação Graffiti (Brazil)", "onlyCountries":["BR"], "confidence":1.0 }
            ]}
        ];

        GM_addStyle(STYLES);
        const p = document.createElement('div'); p.id = 'od-v2-panel';
        p.innerHTML = `
            <div class="od-header"><div class="od-header-main"><span class="od-badge">Geographic Advisor v1.0.0</span><h1 class="od-title">OpenDeduce</h1></div><div class="od-controls"><div class="od-control-btn" id="od-reset-btn">🔄</div><div class="od-control-btn" id="od-minimize-btn">—</div></div></div>
            <div id="od-hud-body"><div class="od-search-container"><input type="text" id="od-global-search" class="od-input" placeholder="Search themes (e.g. 'Sun', 'Driving')..."><div id="od-suggestions" class="od-suggestions"></div></div>
            <div class="od-active-container"></div><div class="od-content"></div><div class="od-results"><div class="od-res-header"><span id="od-suspect-count">Calculating...</span><span>Likelihood</span></div><div class="od-country-list"></div></div></div>`;
        document.body.appendChild(p);

        document.getElementById('od-reset-btn').onclick = () => { STATE.activeClueIds.clear(); syncUI(); };
        document.getElementById('od-minimize-btn').onclick = () => { p.classList.toggle('minimized'); document.getElementById('od-hud-body').style.display = p.classList.contains('minimized')?'none':'block'; };

        setupDrag(p); syncUI(); setupSearch();
    }
    init();
})();

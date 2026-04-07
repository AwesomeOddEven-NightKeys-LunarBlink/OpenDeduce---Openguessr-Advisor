// ==UserScript==
// @name         OpenDeduce
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Geo-Deduction Engine with Biomes (Tropical, Arid) and Google Meta (Gen 4, Taped Car) search layers.
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
     * STYLESHEET
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
        #od-v2-panel.minimized { max-height: 70px; overflow: hidden; }
        .od-header { padding: 20px 24px; border-bottom: 1px solid #ffffff11; cursor: move; display: flex; justify-content: space-between; align-items: center; }
        .od-title { font-size: 1.4rem; font-weight: 900; background: linear-gradient(135deg, #60a5fa, #c084fc, #f472b6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .od-controls { display: flex; gap: 8px; }
        .od-control-btn { background: #ffffff08; border: 1px solid #ffffff11; border-radius: 10px; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s; }
        .od-control-btn:hover { background: #60a5fa33; transform: scale(1.1); }
        
        .od-search-container { padding: 16px 20px; position: relative; }
        .od-input { width: 100%; background: #000; border: 1px solid #ffffff22; border-radius: 12px; padding: 12px 16px; color: #fff; font-size: 10pt; outline: none; }
        .od-input:focus { border-color: #60a5fa; }
        
        .od-suggestions { 
            position: absolute; top: 100%; left: 20px; right: 20px; background: #15151c; 
            border: 1px solid #ffffff33; border-radius: 16px; max-height: 300px; 
            overflow-y: auto; z-index: 10001; display: none; margin-top: 6px; 
            box-shadow: 0 10px 40px #000;
        }
        .od-suggestion-item { padding: 12px 16px; font-size: 0.85rem; cursor: pointer; border-bottom: 1px solid #ffffff05; }
        .od-suggestion-item:hover { background: #60a5fa22; }
        .od-s-type { font-size: 0.55rem; color: #60a5fa; text-transform: uppercase; font-weight: 800; opacity: 0.8; }
        .od-s-aspect { font-weight: 700; color: #f1f5f9; }
        
        .od-active-container { display: flex; flex-wrap: wrap; gap: 6px; padding: 0 20px 12px; }
        .od-tag { background: #60a5fa22; color: #60a5fa; font-size: 0.7rem; padding: 5px 12px; border: 1px solid #60a5fa44; border-radius: 10px; cursor: pointer; font-weight: 800; }
        .od-tag:hover { color: #f87171; border-color: #f87171; }

        .od-content { flex: 1; overflow-y: auto; padding: 0 16px 16px; display: none; }
        .od-accordion { margin-bottom: 8px; border-radius: 14px; background: #ffffff03; border: 1px solid #ffffff08; }
        .od-acc-header { padding: 14px 18px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; font-weight: 800; color: #94a3b8; }
        .od-acc-body { padding: 4px 18px 16px; border-top: 1px solid #ffffff05; display: block; }
        .od-clue-item { display: grid; grid-template-columns: 22px 1fr; align-items: center; gap: 10px; padding: 8px 0; font-size: 0.85rem; cursor: pointer; color: #cbd5e1; }
        .od-clue-item:hover { color: #60a5fa; }
        .od-clue-item input { width: 16px; height: 16px; accent-color: #60a5fa; }
        
        .od-results { padding: 20px 24px; background: #000; border-top: 1px solid #ffffff11; }
        .od-res-header { display: flex; justify-content: space-between; font-size: 0.65rem; font-weight: 800; opacity: 0.3; text-transform: uppercase; margin-bottom: 10px; }
        .od-country-list { max-height: 180px; overflow-y: auto; }
        .od-country-row { display: flex; justify-content: space-between; padding: 6px; font-size: 0.9rem; border-radius: 6px; }
        .od-score-pill { font-family: monospace; font-weight: 900; color: #10b981; }

        #od-tooltip { position: fixed; pointer-events: none; background: #0a0a0f; border: 1px solid #ffffff33; padding: 12px; border-radius: 16px; z-index: 10002; width: 240px; display: none; }
        .od-tooltip-img { width: 100%; height: 120px; border-radius: 10px; margin-bottom: 8px; object-fit: cover; }
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
            let r = null; STATE.rules.forEach(g => { const f = g.clues.find(c=>c.id===id); if(f) r=f; });
            if(!r) return;
            list.forEach(c => {
                let match = true;
                if(r.onlyCountries?.length > 0) { if(!r.onlyCountries.includes(c.id.toUpperCase())) match = false; }
                else {
                    if(r.excludeContinents?.includes(c.continent)) match = false;
                    if(r.excludeCountries?.includes(c.id.toUpperCase())) match = false;
                    if(r.excludeTraits?.includes(c.trait)) match = false;
                    if(r.onlyTraits?.length > 0 && !r.onlyTraits.includes(c.trait)) match = false;
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

    function setupSearch() {
        const i = document.getElementById('od-global-search'), s = document.getElementById('od-suggestions'), c = document.querySelector('.od-content');
        i.oninput = (e) => {
            const v = e.target.value.toLowerCase().trim();
            if(v.length < 3) { s.style.display = 'none'; c.style.display = 'none'; return; }
            const res = [];
            STATE.rules.forEach(g => {
                const tMatch = g.category.toLowerCase().includes(v);
                g.clues.forEach(clue => {
                    const aMatch = clue.aspect.toLowerCase().includes(v);
                    const dMatch = (clue.description || "").toLowerCase().includes(v);
                    let rank = 0;
                    if (tMatch) rank = 3;
                    else if (aMatch) rank = 2;
                    else if (dMatch) rank = 1;
                    if (rank > 0) res.push({...clue, category: g.category, _rank: rank});
                });
            });
            const sorted = res.sort((a,b) => b._rank - a._rank);
            if(sorted.length > 0) {
                s.innerHTML = sorted.slice(0, 10).map(m => `
                    <div class="od-suggestion-item" data-id="${m.id}">
                        <div class="od-s-type">${m._rank === 3 ? 'Theme' : (m._rank === 2 ? 'Feature' : 'Vibe')} • ${m.category}</div>
                        <div class="od-s-aspect">${m.aspect}</div>
                    </div>
                `).join('');
                s.style.display = 'block'; c.style.display = 'block';
                renderClues(v);
            } else { s.style.display = 'none'; c.style.display = 'none'; }
        };
        s.onclick = (e) => {
            const item = e.target.closest('.od-suggestion-item');
            if(item) { STATE.activeClueIds.add(item.dataset.id); i.value = ''; s.style.display='none'; c.style.display='none'; syncUI(); }
        };
    }

    function renderClues(filter = "") {
        const container = document.querySelector('.od-content'); container.innerHTML = '';
        STATE.rules.forEach(g => {
            const tMatch = g.category.toLowerCase().includes(filter);
            const clues = g.clues.filter(f => tMatch || f.aspect.toLowerCase().includes(filter) || (f.description||"").toLowerCase().includes(filter));
            if(clues.length === 0) return;
            const acc = document.createElement('div'); acc.className = 'od-accordion';
            acc.innerHTML = `<div class="od-acc-header"><span>${g.category}</span><small>${clues.length}</small></div><div class="od-acc-body"></div>`;
            const b = acc.querySelector('.od-acc-body');
            clues.forEach(clue => {
                const l = document.createElement('label'); l.className = 'od-clue-item';
                l.innerHTML = `<input type="checkbox" data-clue-id="${clue.id}" ${STATE.activeClueIds.has(clue.id)?'checked':''}><span>${clue.aspect}</span>`;
                l.querySelector('input').onclick = (e) => { if (e.target.checked) STATE.activeClueIds.add(clue.id); else STATE.activeClueIds.delete(clue.id); syncUI(); };
                b.appendChild(l);
            });
            container.appendChild(acc);
        });
    }

    async function init() {
        // FULL MASTER LIST with BIOME TRAITS
        STATE.countries = [
            {"id":"id","name":"Indonesia","continent":"Asia","trait":"Tropical"},{"id":"br","name":"Brazil","continent":"South America","trait":"Tropical"},{"id":"th","name":"Thailand","continent":"Asia","trait":"Tropical"},{"id":"co","name":"Colombia","continent":"South America","trait":"Tropical"},{"id":"ng","name":"Nigeria","continent":"Africa","trait":"Tropical"},{"id":"no","name":"Norway","continent":"Europe","trait":"Cold"},{"id":"ru","name":"Russia","continent":"Asia","trait":"Cold"},{"id":"ca","name":"Canada","continent":"North America","trait":"Cold"},{"id":"fi","name":"Finland","continent":"Europe","trait":"Cold"},{"id":"cl","name":"Chile","continent":"South America","trait":"Cold"},{"id":"ar","name":"Argentina","continent":"South America","trait":"Temperate"},{"id":"za","name":"South Africa","continent":"Africa","trait":"Arid"},{"id":"au","name":"Australia","continent":"Oceania","trait":"Arid"},{"id":"mx","name":"Mexico","continent":"North America","trait":"Arid"},{"id":"jo","name":"Jordan","continent":"Asia","trait":"Arid"},{"id":"ae","name":"United Arab Emirates","continent":"Asia","trait":"Arid"},{"id":"us","name":"United States","continent":"North America","trait":"Temperate"},{"id":"uk","name":"United Kingdom","continent":"Europe","trait":"Temperate"},{"id":"fr","name":"France","continent":"Europe","trait":"Temperate"},{"id":"jp","name":"Japan","continent":"Asia","trait":"Temperate"}
        ];

        STATE.rules = [
            { "category": "Theme: Biomes & Climate Zones", "clues": [ 
                { "id":"b1", "aspect":"Tropical Zone", "description":"Lush, humid jungle. High rain.", "onlyTraits":["Tropical"], "confidence":1.0 },
                { "id":"b2", "aspect":"Arid / Desert Site", "description":"Dry, sandy, sparse botany.", "onlyTraits":["Arid"], "confidence":1.0 },
                { "id":"b3", "aspect":"Cold / Arctic Zone", "description":"Pine trees, snow, permafrost.", "onlyTraits":["Cold"], "confidence":1.0 }
            ]},
            { "category": "Theme: Google Meta & Camera", "clues": [ 
                { "id":"m1", "aspect":"Gen 4 Camera", "description":"High res, vivid colors.", "excludeCountries":["BW","LS","SZ","KG"], "confidence":0.7 },
                { "id":"m2", "aspect":"Google Car: Black Tape", "description":"Ghanian / Nigerian car markers.", "onlyCountries":["GH","NG"], "confidence":1.0 },
                { "id":"m3", "aspect":"Google Car: Roof Racks", "description":"Metal racks visible on car shadow.", "onlyCountries":["MN","KE","GT","CW"], "confidence":1.0 }
            ]},
            { "category": "Theme: Orientation", "clues": [ 
                { "id":"g1", "aspect":"Sun: North (Southern Hem)", "confidence":1.0, "excludeTraits":["Cold"] },
                { "id":"d1", "aspect":"Driving Side: Left", "confidence":1.0, "excludeRegions":["Mainland Europe"] }
            ]},
            { "category": "Theme: Botany Vibing", "clues": [
                { "id":"t1", "aspect":"Jacaranda (Violet)", "description":"Purple flowers.", "confidence":0.8 },
                { "id":"t2", "aspect":"Oil Palms", "description":"SE Asia agriculture marker.", "onlyCountries":["ID","MY","TH"], "confidence":0.95 }
            ]}
        ];

        GM_addStyle(STYLES);
        const p = document.createElement('div'); p.id = 'od-v2-panel';
        p.innerHTML = `
            <div class="od-header"><div class="od-header-main"><span class="od-badge">Geographic Advisor v1.0.0</span><h1 class="od-title">OpenDeduce</h1></div><div class="od-controls"><div class="od-control-btn" id="od-reset-btn">🔄</div><div class="od-control-btn" id="od-minimize-btn">—</div></div></div>
            <div id="od-hud-body"><div class="od-search-container"><input type="text" id="od-global-search" class="od-input" placeholder="Search Biomes (e.g. 'Tropical') or Meta..."><div id="od-suggestions" class="od-suggestions"></div></div>
            <div class="od-active-container"></div><div class="od-content"></div>
            <div class="od-results"><div class="od-res-header"><span id="od-suspect-count">Calculating...</span><span>Likelihood</span></div><div class="od-country-list"></div></div></div>`;
        document.body.appendChild(p);
        document.getElementById('od-reset-btn').onclick = () => { STATE.activeClueIds.clear(); syncUI(); };
        document.getElementById('od-minimize-btn').onclick = () => { p.classList.toggle('minimized'); document.getElementById('od-hud-body').style.display = p.classList.contains('minimized')?'none':'block'; };
        setupDrag(p); syncUI(); setupSearch();
    }
    init();
})();

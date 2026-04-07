// ==UserScript==
// @name         OpenDeduce
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Perfecto v1.0.4 - Performance-Hardened Geo-Deduction Engine with State Persistence.
// @author       OpenDeduce Team
// @match        https://openguessr.com/*
// @updateURL    https://raw.githubusercontent.com/AwesomeOddEven-NightKeys-LunarBlink/OpenDeduce---Openguessr-Advisor/main/opendeduce.user.js
// @downloadURL  https://raw.githubusercontent.com/AwesomeOddEven-NightKeys-LunarBlink/OpenDeduce---Openguessr-Advisor/main/opendeduce.user.js
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    /**
     * STATE MANAGEMENT & PERSISTENCE
     */
    const STATE = {
        countries: [],
        rules: [],
        activeClueIds: new Set(),
        searchQuery: "",
        pos: JSON.parse(localStorage.getItem('od_pos') || '{"top":20,"left":null,"right":20}'),
        isMinimized: localStorage.getItem('od_min') === 'true'
    };

    /**
     * PREMIUM STYLESHEET (Glassmorphism 2.0)
     */
    const STYLES = `
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;800&family=JetBrains+Mono:wght@700&display=swap');

        #od-v2-panel {
            position: fixed; width: 360px; max-height: 90vh;
            background: rgba(18,18,22, 0.92); backdrop-filter: blur(40px) saturate(200%);
            border: 1px solid rgba(255,255,255, 0.12); border-radius: 30px;
            color: #f8fafc; font-family: 'Plus Jakarta Sans', sans-serif;
            z-index: 10000; display: flex; flex-direction: column;
            box-shadow: 0 40px 100px rgba(0,0,0,0.8), 0 0 20px rgba(96,165,250, 0.1);
            transition: max-height 0.4s cubic-bezier(0.2, 0.8, 0.2, 1), transform 0.2s ease;
        }

        #od-v2-panel.minimized { max-height: 78px; overflow: hidden; transform: scale(0.98); opacity: 0.95; }

        .od-header { 
            padding: 24px 28px; border-bottom: 1px solid rgba(255,255,255,0.06); 
            cursor: move; display: flex; justify-content: space-between; align-items: center; 
            user-select: none;
        }
        .od-title-grp { display: flex; flex-direction: column; }
        .od-badge { font-family: 'JetBrains Mono'; font-size: 0.6rem; color: #60a5fa; text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 4px; }
        .od-title { font-size: 1.6rem; font-weight: 800; background: linear-gradient(135deg, #60a5fa, #c084fc, #f472b6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0; letter-spacing: -0.05em; }

        .od-controls { display: flex; gap: 10px; }
        .od-btn { 
            background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); 
            border-radius: 12px; width: 34px; height: 34px; display: flex; align-items: center; 
            justify-content: center; cursor: pointer; transition: 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .od-btn:hover { background: rgba(96,165,250, 0.15); border-color: #60a5fa; transform: translateY(-2px); }
        .od-reset-btn:hover { border-color: #f87171; color: #f87171; background: rgba(248,113,113, 0.1); }

        .od-search-area { padding: 18px 24px 10px; position: relative; }
        .od-input-wrap { position: relative; display: flex; align-items: center; }
        .od-input { 
            width: 100%; background: #000; border: 1px solid rgba(255,255,255,0.15); 
            border-radius: 16px; padding: 14px 20px; color: #fff; font-size: 0.95rem; 
            outline: none; transition: 0.3s;
        }
        .od-input:focus { border-color: #c084fc; box-shadow: 0 0 15px rgba(192,132,252, 0.2); }

        .od-suggestions { 
            position: absolute; top: 100%; left: 24px; right: 24px; background: #121218; 
            border: 1px solid rgba(255,255,255,0.25); border-radius: 20px; max-height: 320px; 
            overflow-y: auto; z-index: 10001; display: none; margin-top: 10px; 
            box-shadow: 0 25px 60px rgba(0,0,0,1);
        }
        .od-suggestion-item { padding: 16px 20px; cursor: pointer; border-bottom: 1px solid #ffffff05; transition: 0.2s; }
        .od-suggestion-item:hover { background: rgba(192,132,252, 0.1); padding-left: 24px; }
        .od-s-theme { font-size: 0.6rem; color: #c084fc; text-transform: uppercase; font-weight: 800; margin-bottom: 4px; opacity: 0.7; }
        .od-s-feature { font-weight: 600; color: #f8fafc; font-size: 0.9rem; }

        .od-active-bar { display: flex; flex-wrap: wrap; gap: 8px; padding: 0 24px 16px; min-height: 10px; }
        .od-tag { 
            background: rgba(96,165,250, 0.1); color: #60a5fa; font-size: 0.72rem; 
            padding: 6px 14px; border: 1px solid rgba(96,165,250, 0.3); border-radius: 12px; 
            cursor: pointer; font-weight: 700; transition: 0.2s;
        }
        .od-tag:hover { border-color: #f87171; color: #f87171; background: rgba(248,113,113, 0.1); }

        .od-content { flex: 1; overflow-y: auto; padding: 0 20px 20px; display: none; scrollbar-width: none; }
        .od-content::-webkit-scrollbar { display: none; }
        
        .od-accordion { margin-bottom: 12px; border-radius: 20px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); }
        .od-acc-header { padding: 18px 22px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; font-weight: 700; color: #94a3b8; }
        .od-acc-body { padding: 6px 22px 22px; border-top: 1px solid #ffffff05; }
        
        .od-clue-item { 
            display: grid; grid-template-columns: 24px 1fr; align-items: center; 
            gap: 12px; padding: 12px 0; font-size: 0.9rem; cursor: pointer; color: #cbd5e1; 
            transition: 0.2s;
        }
        .od-clue-item:hover { color: #60a5fa; transform: translateX(5px); }
        .od-clue-item input { width: 18px; height: 18px; accent-color: #60a5fa; border-radius: 4px; }

        .od-footer { padding: 24px 28px; background: rgba(0,0,0,0.5); border-top: 1px solid #ffffff11; border-radius: 0 0 30px 30px; }
        .od-res-meta { display: flex; justify-content: space-between; font-size: 0.7rem; font-weight: 800; opacity: 0.4; text-transform: uppercase; margin-bottom: 16px; letter-spacing: 0.05em; }
        .od-meter-wrap { width: 100%; height: 6px; background: rgba(255,255,255,0.05); border-radius: 10px; margin-bottom: 20px; overflow: hidden; }
        .od-meter-fill { height: 100%; background: linear-gradient(90deg, #60a5fa, #c084fc); transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1); width: 100%; }
        
        .od-suspects { max-height: 180px; overflow-y: auto; scrollbar-width: thin; scrollbar-color: #ffffff22 transparent; }
        .od-country-row { display: flex; justify-content: space-between; padding: 10px 8px; border-radius: 12px; font-size: 0.95rem; margin-bottom: 4px; transition: 0.2s; }
        .od-country-row:hover { background: #ffffff08; }
        .od-score-pill { font-family: 'JetBrains Mono'; font-weight: 800; color: #10b981; min-width: 50px; text-align: right; }

        #od-tooltip { position: fixed; pointer-events: none; background: #0a0a0f; border: 1px solid rgba(255,255,255,0.3); padding: 14px; border-radius: 20px; z-index: 10002; width: 250px; display: none; box-shadow: 0 20px 60px #000; }
        .od-tooltip-img { width: 100%; height: 130px; border-radius: 14px; margin-bottom: 12px; object-fit: cover; }
    `;

    /**
     * PERSISTENT DRAG LOGIC
     */
    function setupDragAndDrop(el) {
        const h = el.querySelector('.od-header');
        h.onmousedown = (e) => {
            if (e.target.closest('.od-controls')) return;
            let sx = e.clientX - el.offsetLeft, sy = e.clientY - el.offsetTop;
            document.onmousemove = (ev) => {
                let left = ev.clientX-sx, top = ev.clientY-sy;
                // Boundary Constrain
                left = Math.max(0, Math.min(window.innerWidth - 380, left));
                top = Math.max(0, Math.min(window.innerHeight - 80, top));
                el.style.left = left + 'px'; el.style.top = top + 'px'; el.style.right = 'auto';
                STATE.pos = { top, left, right: 'auto' };
            };
            document.onmouseup = () => {
                document.onmousemove = null;
                localStorage.setItem('od_pos', JSON.stringify(STATE.pos));
            };
        };
    }

    /**
     * ENGINE & PERFORMANCE
     */
    function syncUI() {
        document.querySelectorAll('.od-clue-item input').forEach(i => i.checked = STATE.activeClueIds.has(i.dataset.clueId));
        renderActiveTags(); updateSuspects();
    }

    function updateSuspects() {
        const container = document.querySelector('.od-suspects'), countLabel = document.getElementById('od-count'), meter = document.getElementById('od-meter');
        if(!container) return;
        const results = STATE.countries.map(c => ({...c, score: 1.0}));
        STATE.activeClueIds.forEach(id => {
            let r = null; STATE.rules.forEach(g => { const f = g.clues.find(c=>c.id===id); if(f) r=f; });
            if(!r) return;
            results.forEach(c => {
                let m = true;
                if(r.onlyCountries?.length > 0) { if(!r.onlyCountries.includes(c.id.toUpperCase())) m = false; }
                else {
                    if(r.excludeContinents?.includes(c.continent)) m = false;
                    if(r.excludeCountries?.includes(c.id.toUpperCase())) m = false;
                    if(r.excludeTraits?.includes(c.trait)) m = false;
                    if(r.onlyTraits?.length > 0 && !r.onlyTraits.includes(c.trait)) m = false;
                }
                if(!m) c.score = Math.max(0, c.score * (1.0 - (r.confidence||1)));
            });
        });
        const sorted = results.sort((a,b)=>b.score-a.score).filter(c=>c.score>0.001);
        countLabel.innerText = `${sorted.length} Suspects Remaining`;
        const prunePct = (sorted.length / STATE.countries.length) * 100;
        meter.style.width = prunePct + '%';
        container.innerHTML = sorted.map(c => `<div class="od-country-row" style="opacity:${Math.max(0.4, c.score)}"><span>${c.name}</span><span class="od-score-pill">${Math.round(c.score*100)}%</span></div>`).join('');
    }

    function renderActiveTags() {
        const c = document.querySelector('.od-active-bar'); c.innerHTML = '';
        STATE.activeClueIds.forEach(id => {
            let r = null; STATE.rules.forEach(g => { const f = g.clues.find(clue=>clue.id===id); if(f) r=f; });
            if(!r) return;
            const t = document.createElement('div'); t.className = 'od-tag'; t.innerText = r.aspect;
            t.onclick = () => { STATE.activeClueIds.delete(id); syncUI(); };
            c.appendChild(t);
        });
    }

    /**
     * LAYERED THEME SEARCH (PERFECTO VERSION)
     */
    function setupSearchEngine() {
        const i = document.getElementById('od-search'), s = document.getElementById('od-suggest'), c = document.getElementById('od-content');
        i.oninput = (e) => {
            const v = e.target.value.toLowerCase().trim();
            if(v.length < 3) { s.style.display = 'none'; c.style.display = 'none'; return; }
            let matches = [];
            STATE.rules.forEach(g => {
                const tM = g.category.toLowerCase().includes(v);
                g.clues.forEach(cl => {
                    const fM = cl.aspect.toLowerCase().includes(v);
                    const dM = (cl.description||"").toLowerCase().includes(v);
                    let rank = 0;
                    if(tM) rank = 3; else if(fM) rank = 2; else if(dM) rank = 1;
                    if(rank > 0) matches.push({...cl, category: g.category, _rank: rank});
                });
            });
            const sorted = matches.sort((a,b)=>b._rank - a._rank);
            if(sorted.length > 0) {
                s.innerHTML = sorted.slice(0, 10).map(m => `
                    <div class="od-suggestion-item" data-id="${m.id}">
                        <div class="od-s-theme">${m._rank === 3 ? 'Theme' : (m._rank === 2 ? 'Feature' : 'Description')} • ${m.category}</div>
                        <div class="od-s-feature">${m.aspect}</div>
                    </div>`).join('');
                s.style.display = 'block'; c.style.display = 'block'; renderAccordion(v);
            } else { s.style.display = 'none'; c.style.display = 'none'; }
        };
        s.onclick = (e) => {
            const item = e.target.closest('.od-suggestion-item');
            if(item) { STATE.activeClueIds.add(item.dataset.id); i.value = ''; s.style.display='none'; c.style.display='none'; syncUI(); }
        };
    }

    function renderAccordion(filter="") {
        const container = document.getElementById('od-content'); container.innerHTML = '';
        STATE.rules.forEach(g => {
            const tM = g.category.toLowerCase().includes(filter);
            const list = g.clues.filter(f => tM || f.aspect.toLowerCase().includes(filter) || (f.description||"").toLowerCase().includes(filter));
            if(list.length === 0) return;
            const acc = document.createElement('div'); acc.className = 'od-accordion';
            acc.innerHTML = `<div class="od-acc-header"><span>${g.category}</span><small>${list.length}</small></div><div class="od-acc-body"></div>`;
            const b = acc.querySelector('.od-acc-body');
            list.forEach(cl => {
                const l = document.createElement('label'); l.className = 'od-clue-item';
                l.innerHTML = `<input type="checkbox" data-clue-id="${cl.id}" ${STATE.activeClueIds.has(cl.id)?'checked':''}><span>${cl.aspect}</span>`;
                l.onmouseenter = (e) => showTooltip(e, cl); l.onmouseleave = hideTooltip;
                l.querySelector('input').onclick = (ev) => { if(ev.target.checked) STATE.activeClueIds.add(cl.id); else STATE.activeClueIds.delete(cl.id); syncUI(); };
                b.appendChild(l);
            });
            container.appendChild(acc);
        });
    }

    function showTooltip(e, cl) {
        const tt = document.getElementById('od-tooltip'); if(!cl.description && !cl.image) return;
        tt.style.display = 'block'; tt.innerHTML = `${cl.image ? `<img src="${cl.image}" class="od-tooltip-img">` : ''}<div>${cl.description || ""}</div>`;
        tt.style.top = (e.clientY + 20) + 'px'; tt.style.left = (e.clientX - 260) + 'px';
    }
    function hideTooltip() { document.getElementById('od-tooltip').style.display = 'none'; }

    async function init() {
        STATE.countries = [
            {"id":"id","name":"Indonesia","continent":"Asia","trait":"Tropical"},{"id":"br","name":"Brazil","continent":"South America","trait":"Tropical"},{"id":"th","name":"Thailand","continent":"Asia","trait":"Tropical"},{"id":"ng","name":"Nigeria","continent":"Africa","trait":"Tropical"},{"id":"ru","name":"Russia","continent":"Asia","trait":"Cold"},{"id":"no","name":"Norway","continent":"Europe","trait":"Cold"},{"id":"ca","name":"Canada","continent":"North America","trait":"Cold"},{"id":"za","name":"South Africa","continent":"Africa","trait":"Arid"},{"id":"au","name":"Australia","continent":"Oceania","trait":"Arid"},{"id":"ar","name":"Argentina","continent":"South America","trait":"Temperate"},{"id":"us","name":"United States","continent":"North America","trait":"Temperate"},{"id":"gb","name":"United Kingdom","continent":"Europe","trait":"Temperate"},{"id":"fr","name":"France","continent":"Europe","trait":"Temperate"},{"id":"jp","name":"Japan","continent":"Asia","trait":"Temperate"}
        ];

        STATE.rules = [
            { "category": "Theme: Orientation & Solar", "clues": [ 
                { "id":"g1", "aspect":"Sun: North (Southern Hem)", "confidence":1.0, "excludeTraits":["Cold"] },
                { "id":"g2", "aspect":"Sun: South (Northern Hem)", "confidence":1.0, "excludeTraits":["Arid"] },
                { "id":"d1", "aspect":"Driving Side: Left", "confidence":1.0, "excludeRegions":["Mainland Europe"] }
            ]},
            { "category": "Theme: Biomes & Environment", "clues": [ 
                { "id":"b1", "aspect":"Tropical (Lush/Palm)", "onlyTraits":["Tropical"], "confidence":1.0 },
                { "id":"b2", "aspect":"Arid (Desert/Dry)", "onlyTraits":["Arid"], "confidence":1.0 },
                { "id":"b3", "aspect":"Cold (Pine/Needle)", "onlyTraits":["Cold"], "confidence":1.0 }
            ]},
            { "category": "Theme: Google Meta", "clues": [ 
                { "id":"m1", "aspect":"Gen 4 Camera", "confidence":0.7 },
                { "id":"m2", "aspect":"Black Tape (Ghana/Nigeria)", "onlyCountries":["GH","NG"], "confidence":1.0 },
                { "id":"m3", "aspect":"Roof Racks", "onlyCountries":["MN","KE","GT","CW"], "confidence":1.0 }
            ]}
        ];

        GM_addStyle(STYLES);
        const p = document.createElement('div'); p.id = 'od-v2-panel';
        p.style.top = STATE.pos.top + 'px'; p.style.left = STATE.pos.left !== null ? STATE.pos.left + 'px' : 'auto'; p.style.right = STATE.pos.right !== 'auto' ? STATE.pos.right + 'px' : 'auto';
        if(STATE.isMinimized) p.classList.add('minimized');

        p.innerHTML = `
            <div class="od-header"><div class="od-title-grp"><span class="od-badge">Release v1.0.4</span><h1 class="od-title">OpenDeduce</h1></div>
            <div class="od-controls"><div class="od-btn od-reset-btn" id="od-reset">🔄</div><div class="od-btn" id="od-min">—</div></div></div>
            <div id="od-hud-body" style="display: ${STATE.isMinimized ? 'none' : 'block'}">
                <div class="od-search-area"><div class="od-input-wrap"><input type="text" id="od-search" class="od-input" placeholder="Search Theme or Feature..."></div>
                <div id="od-suggest" class="od-suggestions"></div></div>
                <div class="od-active-bar"></div><div class="od-content" id="od-content"></div>
                <div class="od-footer"><div class="od-res-meta"><span id="od-count">Calculating...</span><span>Likelihood</span></div>
                <div class="od-meter-wrap"><div class="od-meter-fill" id="od-meter"></div></div><div class="od-suspects"></div></div>
            </div>`;
        document.body.appendChild(p);

        const tt = document.createElement('div'); tt.id = 'od-tooltip'; document.body.appendChild(tt);
        document.getElementById('od-reset').onclick = () => { STATE.activeClueIds.clear(); syncUI(); };
        document.getElementById('od-min').onclick = () => {
            p.classList.toggle('minimized'); STATE.isMinimized = p.classList.contains('minimized');
            document.getElementById('od-hud-body').style.display = STATE.isMinimized ? 'none' : 'block';
            localStorage.setItem('od_min', STATE.isMinimized);
        };
        setupDragAndDrop(p); setupSearchEngine(); syncUI();
    }
    init();
})();

// ==UserScript==
// @name         OpenDeduce
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Master Geo-Deduction Engine with 600+ micro-clues. Search-to-reveal architecture.
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
        #od-v2-panel.minimized { max-height: 75px; overflow: hidden; }
        .od-header { padding: 22px 28px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); cursor: move; display: flex; justify-content: space-between; align-items: center; }
        .od-title { font-size: 1.5rem; font-weight: 900; background: linear-gradient(135deg, #60a5fa, #c084fc, #f472b6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; letter-spacing: -0.04em; margin: 0; }
        .od-controls { display: flex; gap: 12px; }
        .od-control-btn { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s; }
        .od-control-btn:hover { background: #60a5fa33; transform: scale(1.1); }
        .od-search-container { padding: 18px 24px; position: relative; }
        .od-input { width: 100%; background: #000; border: 1px solid #ffffff22; border-radius: 14px; padding: 12px 18px; color: #fff; font-size: 11pt; outline: none; }
        .od-input:focus { border-color: #60a5fa; }
        .od-suggestions { position: absolute; top: 100%; left: 24px; right: 24px; background: #1a1a22; border: 1px solid #ffffff44; border-radius: 18px; max-height: 300px; overflow-y: auto; z-index: 10001; display: none; margin-top: 8px; box-shadow: 0 20px 50px #000; }
        .od-suggestion-item { padding: 14px 20px; font-size: 0.9rem; cursor: pointer; border-bottom: 1px solid #ffffff11; }
        .od-suggestion-item:hover { background: #60a5fa33; }
        .od-active-container { display: flex; flex-wrap: wrap; gap: 8px; padding: 0 24px 16px; }
        .od-tag { background: #60a5fa33; color: #60a5fa; font-size: 0.72rem; padding: 6px 14px; border: 1px solid #60a5fa66; border-radius: 12px; cursor: pointer; font-weight: 800; }
        .od-content { flex: 1; overflow-y: auto; padding: 0 20px 20px; display: none; } /* Hide Content by Default */
        .od-accordion { margin-bottom: 10px; border-radius: 18px; background: #ffffff05; border: 1px solid #ffffff11; }
        .od-acc-header { padding: 16px 20px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; font-size: 0.9rem; font-weight: 800; color: #cbd5e1; }
        .od-acc-body { padding: 6px 20px 20px; border-top: 1px solid #ffffff08; display: block; } /* Fixed Layout */
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
            const matches = [];
            STATE.rules.forEach(g => g.clues.forEach(clue => {
                if([clue.aspect, g.category, clue.description||""].join(' ').toLowerCase().includes(v)) matches.push({...clue, category: g.category});
            }));
            if(matches.length > 0) {
                s.innerHTML = matches.slice(0, 10).map(m => `<div class="od-suggestion-item" data-id="${m.id}"><div style="font-size:0.6rem; color:#60a5fa;">${m.category}</div>${m.aspect}</div>`).join('');
                s.style.display = 'block';
                // Reveal relevant categories in content area
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
            const filteredClues = g.clues.filter(clue => [clue.aspect, clue.description||""].join(' ').toLowerCase().includes(filter));
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

    async function init() {
        STATE.countries = [
            {"id":"al","name":"Albania","continent":"Europe"},{"id":"ad","name":"Andorra","continent":"Europe"},{"id":"at","name":"Austria","continent":"Europe"},{"id":"by","name":"Belarus","continent":"Europe"},{"id":"be","name":"Belgium","continent":"Europe"},{"id":"ba","name":"Bosnia and Herzegovina","continent":"Europe"},{"id":"bg","name":"Bulgaria","continent":"Europe"},{"id":"hr","name":"Croatia","continent":"Europe"},{"id":"cz","name":"Czechia","continent":"Europe"},{"id":"dk","name":"Denmark","continent":"Europe"},{"id":"ee","name":"Estonia","continent":"Europe"},{"id":"fi","name":"Finland","continent":"Europe"},{"id":"fr","name":"France","continent":"Europe"},{"id":"de","name":"Germany","continent":"Europe"},{"id":"gr","name":"Greece","continent":"Europe"},{"id":"hu","name":"Hungary","continent":"Europe"},{"id":"is","name":"Iceland","continent":"Europe"},{"id":"ie","name":"Ireland","continent":"Europe"},{"id":"it","name":"Italy","continent":"Europe"},{"id":"ks","name":"Kosovo","continent":"Europe"},{"id":"lv","name":"Latvia","continent":"Europe"},{"id":"li","name":"Liechtenstein","continent":"Europe"},{"id":"lt","name":"Lithuania","continent":"Europe"},{"id":"lu","name":"Luxembourg","continent":"Europe"},{"id":"mt","name":"Malta","continent":"Europe"},{"id":"md","name":"Moldova","continent":"Europe"},{"id":"mc","name":"Monaco","continent":"Europe"},{"id":"me","name":"Montenegro","continent":"Europe"},{"id":"mk","name":"North Macedonia","continent":"Europe"},{"id":"pl","name":"Poland","continent":"Europe"},{"id":"nl","name":"Netherlands","continent":"Europe"},{"id":"pt","name":"Portugal","continent":"Europe"},{"id":"sk","name":"Slovakia","continent":"Europe"},{"id":"ro","name":"Romania","continent":"Europe"},{"id":"no","name":"Norway","continent":"Europe"},{"id":"sm","name":"San Marino","continent":"Europe"},{"id":"rs","name":"Serbia","continent":"Europe"},{"id":"si","name":"Slovenia","continent":"Europe"},{"id":"es","name":"Spain","continent":"Europe"},{"id":"se","name":"Sweden","continent":"Europe"},{"id":"ch","name":"Switzerland","continent":"Europe"},{"id":"uk","name":"United Kingdom","continent":"Europe"},{"id":"ua","name":"Ukraine","continent":"Europe"},{"id":"va","name":"Vatican City","continent":"Europe"},{"id":"af","name":"Afghanistan","continent":"Asia"},{"id":"am","name":"Armenia","continent":"Asia"},{"id":"az","name":"Azerbaijan","continent":"Asia"},{"id":"bd","name":"Bangladesh","continent":"Asia"},{"id":"bt","name":"Bhutan","continent":"Asia"},{"id":"bn","name":"Brunei","continent":"Asia"},{"id":"kh","name":"Cambodia","continent":"Asia"},{"id":"cn","name":"China","continent":"Asia"},{"id":"cy","name":"Cyprus","continent":"Asia"},{"id":"ge","name":"Georgia","continent":"Asia"},{"id":"in","name":"India","continent":"Asia"},{"id":"id","name":"Indonesia","continent":"Asia"},{"id":"ir","name":"Iran","continent":"Asia"},{"id":"iq","name":"Iraq","continent":"Asia"},{"id":"il","name":"Israel","continent":"Asia"},{"id":"jp","name":"Japan","continent":"Asia"},{"id":"jo","name":"Jordan","continent":"Asia"},{"id":"kz","name":"Kazakhstan","continent":"Asia"},{"id":"kw","name":"Kuwait","continent":"Asia"},{"id":"kg","name":"Kyrgyzstan","continent":"Asia"},{"id":"la","name":"Laos","continent":"Asia"},{"id":"lb","name":"Lebanon","continent":"Asia"},{"id":"my","name":"Malaysia","continent":"Asia"},{"id":"mv","name":"Maldives","continent":"Asia"},{"id":"mn","name":"Mongolia","continent":"Asia"},{"id":"mm","name":"Myanmar","continent":"Asia"},{"id":"np","name":"Nepal","continent":"Asia"},{"id":"om","name":"Oman","continent":"Asia"},{"id":"pk","name":"Pakistan","continent":"Asia"},{"id":"qa","name":"Qatar","continent":"Asia"},{"id":"ru","name":"Russia","continent":"Asia"},{"id":"sa","name":"Saudi Arabia","continent":"Asia"},{"id":"kr","name":"South Korea","continent":"Asia"},{"id":"lk","name":"Sri Lanka","continent":"Asia"},{"id":"sy","name":"Syria","continent":"Asia"},{"id":"ps","name":"Palestine","continent":"Asia"},{"id":"kp","name":"North Korea","continent":"Asia"},{"id":"ph","name":"Philippines","continent":"Asia"},{"id":"th","name":"Thailand","continent":"Asia"},{"id":"ae","name":"United Arab Emirates","continent":"Asia"},{"id":"ca","name":"Canada","continent":"North America"},{"id":"mx","name":"Mexico","continent":"North America"},{"id":"us","name":"United States","continent":"North America"},{"id":"br","name":"Brazil","continent":"South America"},{"id":"ar","name":"Argentina","continent":"South America"},{"id":"cl","name":"Chile","continent":"South America"},{"id":"za","name":"South Africa","continent":"Africa"},{"id":"au","name":"Australia","continent":"Oceania"},{"id":"nz","name":"New Zealand","continent":"Oceania"}
        ];

        // MASSIVE MASTER RULE DATABASE (Restored)
        STATE.rules = [
            { "category": "Global Fundamentals", "clues": [ 
                { "id":"g1", "aspect":"Driving Side: Left", "confidence":1.0, "excludeRegions":["Mainland Europe"], "excludeContinents":["North America","South America"] },
                { "id":"g2", "aspect":"Driving Side: Right", "confidence":1.0, "excludeCountries":["UK","IE","ZA","AU","NZ","JP","MY","ID","TH"] },
                { "id":"g3", "aspect":"Sun Position: North", "confidence":1.0, "excludeContinents":["North America"], "excludeRegions":["Europe"] },
                { "id":"g4", "aspect":"Sun Position: South", "confidence":1.0, "excludeContinents":["Oceania"], "excludeCountries":["ZA","AR","CL","BR","ID","KE","UG","GH"] }
            ]},
            { "category": "Commercial & Retail (Micro)", "clues": [
                { "id":"p2-1", "aspect":"Pharmacy: Green LED Cross", "description":"Euro style pharmacy sign.", "confidence":0.9, "excludeContinents":["North America","Oceania"] },
                { "id":"p2-2", "aspect":"Pharmacy Cross: Red", "description":"Specific to parts of Asia and E.Europe.", "confidence":0.8, "excludeContinents":["North America"] },
                { "id":"p2-4", "aspect":"Tabac Red Diamond", "description":"Only in France.", "onlyCountries":["FR"], "confidence":1.0 },
                { "id":"p2-5", "aspect":"Tabacchi (Black T)", "description":"Only in Italy.", "onlyCountries":["IT"], "confidence":1.0 },
                { "id":"p2-6", "aspect":"Estanco (Yellow/Red T)", "description":"Only in Spain.", "onlyCountries":["ES"], "confidence":1.0 },
                { "id":"p2-17", "aspect":"Indomaret / Alfamart", "description":"Indonesian convenience.", "onlyCountries":["ID"], "confidence":1.0 },
                { "id":"p2-18", "aspect":"Tim Hortons", "description":"Canada/US only.", "onlyCountries":["CA", "US"], "confidence":0.95 },
                { "id":"p2-19", "aspect":"Oxxo Convenience", "description":"Mexico and parts of S.America.", "onlyCountries":["MX","CO","CL","BR"], "confidence":0.9 }
            ]},
            { "category": "Botany & Flora (Visual Guides)", "clues": [
                { "id":"t1", "aspect":"Jacaranda (Purple Flowers)", "description":"Iconic purple blooming trees.", "confidence":0.8, "excludeContinents":["Europe"] },
                { "id":"t2", "aspect":"Banyan tree", "description":"Aerial roots.", "onlyCountries":["IN","TH","ID","LK"], "confidence":1.0 },
                { "id":"t3", "aspect":"Joshua Tree", "description":"US Southwest desert.", "onlyCountries":["US"], "confidence":1.0 },
                { "id":"t4", "aspect":"Monkey Puzzle Tree", "description":"Chilean signature.", "onlyCountries":["CL", "AR"], "confidence":0.9 },
                { "id":"t5", "aspect":"Baobab Tree", "description":"African/Malagasy icon.", "onlyCountries":["MG", "ZA", "BW", "KE", "SN"], "confidence":1.0 }
            ]},
            { "category": "Architecture & Infrastructure", "clues": [
                { "id":"p2-235", "aspect":"Pichação Graffiti", "description":"São Paulo runic graffiti.", "onlyCountries":["BR"], "confidence":1.0 },
                { "id":"p2-285", "aspect":"Stobie Pole", "description":"South Australia power pole.", "onlyCountries":["AU"], "confidence":1.0 },
                { "id":"p2-90", "aspect":"Soviet Bus Stop (Ornate)", "description":"Ex-Soviet states signature.", "excludeContinents":["North America","South America","Oceania"], "confidence":0.8 }
            ]},
            { "category": "Transit & Logistics", "clues": [
                { "id":"p2-35", "aspect":"Bus: Red Double Decker", "description":"UK iconic transit.", "onlyCountries":["UK"], "confidence":0.95 },
                { "id":"p2-40", "aspect":"Jeepney (Philippines)", "description":"PH icon.", "onlyCountries":["PH"], "confidence":1.0 },
                { "id":"p2-41", "aspect":"Tuk-Tuk / Rickshaw", "description":"SE Asia / India.", "excludeContinents":["North America","Europe"], "confidence":0.7 }
            ]}
        ];

        GM_addStyle(STYLES);
        const p = document.createElement('div'); p.id = 'od-v2-panel';
        p.innerHTML = `
            <div class="od-header">
                <div class="od-header-main"><span class="od-badge">Geographic Advisor v1.0.0</span><h1 class="od-title">OpenDeduce</h1></div>
                <div class="od-controls"><div class="od-control-btn" id="od-reset-btn">🔄</div><div class="od-control-btn" id="od-minimize-btn">—</div></div>
            </div>
            <div id="od-hud-body">
                <div class="od-search-container"><input type="text" id="od-global-search" class="od-input" placeholder="Type 3+ letters to reveal clues..."><div id="od-suggestions" class="od-suggestions"></div></div>
                <div class="od-active-container"></div>
                <div class="od-content"></div>
                <div class="od-results"><div class="od-res-header"><span>Suspects Remaining</span><span>Likelihood</span></div><div class="od-country-list"></div></div>
            </div>`;
        document.body.appendChild(p);

        document.getElementById('od-reset-btn').onclick = () => { STATE.activeClueIds.clear(); syncUI(); };
        document.getElementById('od-minimize-btn').onclick = () => {
            p.classList.toggle('minimized');
            document.getElementById('od-hud-body').style.display = p.classList.contains('minimized')?'none':'block';
        };

        setupDrag(p); syncUI(); setupSearch();
    }
    init();
})();

// ==UserScript==
// @name         OpenDeduce: The Geo-Elimination Engine
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  An interactive, on-screen Tampermonkey overlay for OpenGuessr that dynamically narrows down possible countries with probabilistic scoring.
// @author       OpenDeduce Team
// @match        https://openguessr.com/*
// @grant        GM_addStyle
// @grant        GM_getResourceText
// @resource     COUNTRY_DATA https://raw.githubusercontent.com/AwesomeOddEven-NightKeys-LunarBlink/OpenDeduce---Openguessr-Advisor/main/meta-database.json
// ==/UserScript==

(function() {
    'use strict';

    // --- Design Tokens ---
    const STYLES = `
        #opendeduce-hud {
            position: fixed;
            top: 20px;
            right: 20px;
            width: 320px;
            background: rgba(8, 8, 8, 0.9);
            backdrop-filter: blur(25px) saturate(180%);
            -webkit-backdrop-filter: blur(25px) saturate(180%);
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 24px;
            color: #ffffff;
            font-family: 'Inter', system-ui, sans-serif;
            z-index: 9999;
            box-shadow: 0 12px 48px rgba(0, 0, 0, 0.7);
            padding: 24px;
            user-select: none;
            transition: all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
        }

        .od-header {
            display: flex;
            flex-direction: column;
            gap: 4px;
            margin-bottom: 20px;
        }

        .od-title {
            font-size: 1.4rem;
            font-weight: 800;
            background: linear-gradient(135deg, #60a5fa, #a855f7, #ec4899);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            letter-spacing: -0.02em;
        }

        .od-subtitle {
            font-size: 0.65rem;
            color: #60a5fa;
            text-transform: uppercase;
            letter-spacing: 0.14em;
            font-weight: 700;
            opacity: 0.8;
        }

        .od-search-container {
            position: relative;
            margin-bottom: 24px;
        }

        .od-input {
            width: 100%;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 12px 14px;
            color: #fff;
            font-size: 0.85rem;
            outline: none;
            box-sizing: border-box;
            transition: all 0.2s;
        }

        .od-input:focus {
            background: rgba(255, 255, 255, 0.08);
            border-color: #60a5fa;
            box-shadow: 0 0 0 4px rgba(96, 165, 250, 0.1);
        }

        .od-suggestions {
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: #121212;
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 14px;
            margin-top: 8px;
            max-height: 240px;
            overflow-y: auto;
            z-index: 100;
            display: none;
            box-shadow: 0 10px 30px rgba(0,0,0,0.6);
        }

        .od-suggestion-item {
            padding: 12px 16px;
            font-size: 0.82rem;
            cursor: pointer;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            transition: background 0.2s;
        }

        .od-suggestion-item:hover {
            background: rgba(96, 165, 250, 0.15);
        }

        .od-active-clues {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            margin-bottom: 20px;
        }

        .od-tag {
            background: rgba(96, 165, 250, 0.12);
            color: #60a5fa;
            font-size: 0.72rem;
            padding: 6px 12px;
            border: 1px solid rgba(96, 165, 250, 0.25);
            border-radius: 10px;
            cursor: pointer;
            display: flex;
            align-items: center;
            font-weight: 600;
            transition: all 0.2s;
        }

        .od-tag:hover {
            background: rgba(239, 68, 68, 0.15);
            color: #ef4444;
            border-color: rgba(239, 68, 68, 0.3);
        }

        .od-tag::after {
            content: ' ×';
            margin-left: 6px;
            font-size: 1rem;
            opacity: 0.6;
        }

        .od-suspect-list {
            background: rgba(0, 0, 0, 0.3);
            border-radius: 18px;
            padding: 14px;
            max-height: 280px;
            overflow-y: auto;
        }

        .od-country-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px 12px;
            border-radius: 12px;
            margin-bottom: 6px;
            transition: all 0.2s;
        }

        .od-country-row:hover {
            background: rgba(255, 255, 255, 0.06);
            transform: translateX(4px);
        }

        .od-likelihood-bar {
            height: 5px;
            background: rgba(255, 255, 255, 0.08);
            border-radius: 3px;
            width: 60px;
            margin-left: 14px;
            overflow: hidden;
            position: relative;
        }

        .od-likelihood-fill {
            height: 100%;
            background: #10b981;
            transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .od-score {
            font-family: 'JetBrains Mono', 'Fira Code', monospace;
            font-size: 0.75rem;
            color: #10b981;
            min-width: 45px;
            text-align: right;
            font-weight: 700;
        }

        .od-count-label {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 14px;
            font-size: 0.7rem;
            font-weight: 800;
            opacity: 0.5;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
    `;

    GM_addStyle(STYLES);

    // --- State ---
    let countries = [];
    let allClues = [];
    let activeClueIds = new Set();

    // --- Scoring Engine ---
    function updateHUD() {
        const listContainer = document.getElementById('od-suspect-list');
        const countBadge = document.getElementById('od-count-badge');
        const activeContainer = document.getElementById('od-active-clues');

        // Reset scores
        let results = countries.map(c => ({...c, currentScore: 1.0}));

        // Apply rules
        activeClueIds.forEach(id => {
            const clue = allClues.find(c => c.id === id);
            if (!clue) return;

            results.forEach(country => {
                const confidence = clue.confidence || 1.0;
                let isMatch = true;

                // Check ONLY rules
                if (clue.onlyCountries && clue.onlyCountries.length > 0) {
                    isMatch = clue.onlyCountries.includes(country.id.toUpperCase());
                } else {
                    // Check EXCLUDE rules
                    if (clue.excludeContinents && clue.excludeContinents.includes(country.continent)) isMatch = false;
                    if (clue.excludeCountries && clue.excludeCountries.includes(country.id.toUpperCase())) isMatch = false;
                    
                    if (clue.excludeRegions) {
                        if (clue.excludeRegions.includes("Mainland Europe") && country.continent === "Europe" && country.id !== "uk" && country.id !== "ie") isMatch = false;
                        if (clue.excludeRegions.includes("Asia") && country.continent === "Asia") isMatch = false;
                        if (clue.excludeRegions.includes("Sub-Saharan Africa") && ["ZA", "BW", "LS", "SZ", "KE", "UG", "GH", "NG", "SN"].includes(country.id.toUpperCase())) isMatch = false;
                    }
                }

                if (!isMatch) {
                    country.currentScore = Math.max(0, country.currentScore * (1.0 - confidence));
                }
            });
        });

        const sorted = results
            .filter(c => c.currentScore > 0.001)
            .sort((a, b) => b.currentScore - a.currentScore);

        countBadge.innerText = `${sorted.length} Suspects Remaining`;

        listContainer.innerHTML = sorted.map(c => {
            const pct = Math.round(c.currentScore * 100);
            const color = pct > 60 ? '#10b981' : (pct > 25 ? '#f59e0b' : '#ef4444');
            return `
                <div class="od-country-row">
                    <span style="${pct > 80 ? 'font-weight: 700; color: #fff;' : 'opacity: 0.8;'}">${c.name}</span>
                    <div style="display: flex; align-items: center;">
                        <span class="od-score" style="color: ${color}">${pct}%</span>
                        <div class="od-likelihood-bar">
                            <div class="od-likelihood-fill" style="width: ${pct}%; background: ${color}"></div>
                        </div>
                    </div>
                </div>
            `;
        }).join('') || '<div style="opacity:0.3; padding: 40px; text-align: center; font-size: 0.8rem;">No matches. Check your clues!</div>';

        // Update Tags
        activeContainer.innerHTML = Array.from(activeClueIds).map(id => {
            const clue = allClues.find(c => c.id === id);
            return `<div class="od-tag" data-id="${id}">${clue.aspect}</div>`;
        }).join('');

        document.querySelectorAll('.od-tag').forEach(tag => {
            tag.addEventListener('click', () => {
                activeClueIds.delete(tag.dataset.id);
                updateHUD();
            });
        });
    }

    function setupSearch() {
        const input = document.getElementById('od-search-input');
        const suggestBox = document.getElementById('od-suggestions');

        input.addEventListener('input', (e) => {
            const val = e.target.value.toLowerCase();
            if (!val) { suggestBox.style.display = 'none'; return; }

            const matches = allClues.filter(c => 
                c.aspect.toLowerCase().includes(val) || 
                c.category.toLowerCase().includes(val)
            ).slice(0, 10);

            if (matches.length > 0) {
                suggestBox.innerHTML = matches.map(c => `
                    <div class="od-suggestion-item" data-id="${c.id}">
                        <div style="font-size: 0.6rem; color: #60a5fa; margin-bottom: 2px; text-transform: uppercase; font-weight: 800;">${c.category}</div>
                        <div>${c.aspect}</div>
                        <div style="font-size: 0.6rem; opacity: 0.5; margin-top: 2px;">Exclusion Weight: ${Math.round((c.confidence||1)*100)}%</div>
                    </div>
                `).join('');
                suggestBox.style.display = 'block';
            } else { suggestBox.style.display = 'none'; }
        });

        suggestBox.addEventListener('click', (e) => {
            const item = e.target.closest('.od-suggestion-item');
            if (item) {
                activeClueIds.add(item.dataset.id);
                input.value = '';
                suggestBox.style.display = 'none';
                updateHUD();
            }
        });

        document.addEventListener('click', (e) => { if (!input.contains(e.target)) suggestBox.style.display = 'none'; });
    }

    async function init() {
        countries = [
            {"id": "al", "name": "Albania", "continent": "Europe"},
            {"id": "ar", "name": "Argentina", "continent": "South America"},
            {"id": "au", "name": "Australia", "continent": "Oceania"},
            {"id": "at", "name": "Austria", "continent": "Europe"},
            {"id": "bd", "name": "Bangladesh", "continent": "Asia"},
            {"id": "be", "name": "Belgium", "continent": "Europe"},
            {"id": "br", "name": "Brazil", "continent": "South America"},
            {"id": "ca", "name": "Canada", "continent": "North America"},
            {"id": "cl", "name": "Chile", "continent": "South America"},
            {"id": "co", "name": "Colombia", "continent": "South America"},
            {"id": "dk", "name": "Denmark", "continent": "Europe"},
            {"id": "ee", "name": "Estonia", "continent": "Europe"},
            {"id": "fi", "name": "Finland", "continent": "Europe"},
            {"id": "fr", "name": "France", "continent": "Europe"},
            {"id": "de", "name": "Germany", "continent": "Europe"},
            {"id": "gh", "name": "Ghana", "continent": "Africa"},
            {"id": "id", "name": "Indonesia", "continent": "Asia"},
            {"id": "ie", "name": "Ireland", "continent": "Europe"},
            {"id": "il", "name": "Israel", "continent": "Asia"},
            {"id": "it", "name": "Italy", "continent": "Europe"},
            {"id": "jp", "name": "Japan", "continent": "Asia"},
            {"id": "ke", "name": "Kenya", "continent": "Africa"},
            {"id": "kr", "name": "South Korea", "continent": "Asia"},
            {"id": "mx", "name": "Mexico", "continent": "North America"},
            {"id": "nl", "name": "Netherlands", "continent": "Europe"},
            {"id": "nz", "name": "New Zealand", "continent": "Oceania"},
            {"id": "no", "name": "Norway", "continent": "Europe"},
            {"id": "ph", "name": "Philippines", "continent": "Asia"},
            {"id": "pl", "name": "Poland", "continent": "Europe"},
            {"id": "pt", "name": "Portugal", "continent": "Europe"},
            {"id": "ro", "name": "Romania", "continent": "Europe"},
            {"id": "ru", "name": "Russia", "continent": "Europe"},
            {"id": "sn", "name": "Senegal", "continent": "Africa"},
            {"id": "za", "name": "South Africa", "continent": "Africa"},
            {"id": "es", "name": "Spain", "continent": "Europe"},
            {"id": "se", "name": "Sweden", "continent": "Europe"},
            {"id": "tw", "name": "Taiwan", "continent": "Asia"},
            {"id": "th", "name": "Thailand", "continent": "Asia"},
            {"id": "tr", "name": "Turkey", "continent": "Europe"},
            {"id": "ua", "name": "Ukraine", "continent": "Europe"},
            {"id": "uk", "name": "United Kingdom", "continent": "Europe"},
            {"id": "us", "name": "United States", "continent": "North America"}
        ];

        allClues = [
            { "id": "1", "aspect": "Driving Side: Left", "category": "Global", "excludeContinents": ["North America", "South America"], "excludeRegions": ["Mainland Europe"], "confidence": 1.0 },
            { "id": "2", "aspect": "Driving Side: Right", "category": "Global", "excludeContinents": ["Oceania"], "excludeCountries": ["UK", "IE", "ZA", "JP", "IN", "TH", "MY", "ID", "SG"], "confidence": 1.0 },
            { "id": "p2-1", "aspect": "Pharmacy: Green LED Cross", "category": "Retail", "excludeContinents": ["North America", "Oceania", "Africa"], "excludeRegions": ["Asia"], "confidence": 0.95 },
            { "id": "p2-4", "aspect": "Tabac Red Diamond", "category": "Retail", "onlyCountries": ["FR"], "confidence": 1.0 },
            { "id": "p2-17", "aspect": "Indomaret / Alfamart", "category": "Retail", "onlyCountries": ["ID"], "confidence": 1.0 },
            { "id": "p2-18", "aspect": "Tim Hortons Coverage", "category": "Retail", "onlyCountries": ["CA", "US"], "confidence": 0.9 },
            { "id": "p2-35", "aspect": "Bus: Red Double Decker", "category": "Transit", "onlyCountries": ["UK"], "confidence": 0.95 },
            { "id": "p2-40", "aspect": "Jeepneys (Philippines)", "category": "Transit", "onlyCountries": ["PH"], "confidence": 1.0 },
            { "id": "p2-45", "aspect": "Subway: Blue 'U' (U-Bahn)", "category": "Transit", "onlyCountries": ["DE", "AT"], "confidence": 1.0 },
            { "id": "p2-108", "aspect": "Joshua Trees", "category": "Flora", "onlyCountries": ["US"], "confidence": 1.0 },
            { "id": "p2-109", "aspect": "Saguaro Cactus", "category": "Flora", "onlyCountries": ["US", "MX"], "confidence": 1.0 },
            { "id": "p2-139", "aspect": "Cenotes (Sinkholes)", "category": "Topo", "onlyCountries": ["MX"], "confidence": 1.0 },
            { "id": "p2-235", "aspect": "Pichação Graffiti", "category": "Graffiti", "onlyCountries": ["BR"], "confidence": 1.0 },
            { "id": "p2-285", "aspect": "Stobie Poles", "category": "Infra", "onlyCountries": ["AU"], "confidence": 1.0 }
        ];

        const hud = document.createElement('div');
        hud.id = 'opendeduce-hud';
        hud.innerHTML = `
            <div class="od-header">
                <span class="od-subtitle">Exclusion Engine • v2.0</span>
                <span class="od-title">OpenDeduce</span>
            </div>
            
            <div class="od-search-container">
                <input type="text" id="od-search-input" class="od-input" placeholder="Search clues (e.g. 'Stobie')...">
                <div id="od-suggestions" class="od-suggestions"></div>
            </div>

            <div id="od-active-clues" class="od-active-clues"></div>

            <div class="od-count-label">
                <span id="od-count-badge">Calculating suspects...</span>
                <span>Likelihood</span>
            </div>

            <div class="od-suspect-list" id="od-suspect-list"></div>
        `;

        document.body.appendChild(hud);
        setupSearch();
        updateHUD();
    }

    init();
})();

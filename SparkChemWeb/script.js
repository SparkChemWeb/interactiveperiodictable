console.log('🚀 SparkChemWeb script loaded');

// ============================================
// GLOBAL VARIABLES
// ============================================
let elementsData = [];
let ionData = [];
let compoundsData = [];
const tableViewContainer = document.getElementById('table-view');
const detailView = document.getElementById('element-detail');

let currentMode = 'atom';
let currentTemperature = 25;
let currentPressure = 101;
let currentCatalyst = 'none';
let elementQuantities = new Map();
let ionIndexMap = new Map();
let paletteQuantities = new Map();
let isDragging = false;
let reactionLogEntries = [];

let cardSize = 80;

// IGCSE Solubility Rules
const solubilityRules = {
    alwaysSoluble: ['Na⁺', 'K⁺', 'NH₄⁺', 'NO₃⁻'],
    halides: { soluble: true, exceptions: ['Ag⁺', 'Pb²⁺'] },
    sulfates: { soluble: true, exceptions: ['Ca²⁺', 'Ba²⁺', 'Pb²⁺'] },
    carbonates: { soluble: false },
    hydroxides: { soluble: false, exceptions: ['Na⁺', 'K⁺', 'Ca²⁺', 'NH₄⁺'] }
};

const paletteIons = [
    { symbol: "OH⁻",  charge: -1, name: "Hydroxide",   root: "OH" },
    { symbol: "NO₃⁻", charge: -1, name: "Nitrate",    root: "NO₃" },
    { symbol: "SO₄²⁻",charge: -2, name: "Sulfate",    root: "SO₄" },
    { symbol: "CO₃²⁻",charge: -2, name: "Carbonate",  root: "CO₃" },
    { symbol: "NH₄⁺", charge: +1, name: "Ammonium",   root: "NH₄" },
    { symbol: "PO₄³⁻",charge: -3, name: "Phosphate",  root: "PO₄" }
];

// ============================================
// OLD REACTION MAP
// ============================================
const reactionMap = {
    "Na+Cl":       { symbol: "NaCl", name: "Sodium chloride", formula: "NaCl", type: "metal+halogen", balanced: "2Na + Cl₂ → 2NaCl" },
    "Na+O":        { symbol: "Na₂O", name: "Sodium oxide", formula: "Na₂O", type: "metal+oxygen", balanced: "4Na + O₂ → 2Na₂O" },
    "H+O":         { symbol: "H₂O", name: "Water", formula: "H₂O", type: "combustion", balanced: "2H₂ + O₂ → 2H₂O" },
    "Mg+O":        { symbol: "MgO", name: "Magnesium oxide", formula: "MgO", type: "metal+oxygen", balanced: "2Mg + O₂ → 2MgO" },
    "Fe+O":        { symbol: "Fe₂O₃", name: "Iron(III) oxide", formula: "Fe₂O₃", type: "metal+oxygen", balanced: "4Fe + 3O₂ → 2Fe₂O₃" },
    "C+O":         { symbol: "CO₂", name: "Carbon dioxide", formula: "CO₂", type: "combustion", balanced: "C + O₂ → CO₂" },
    "Ca+O":        { symbol: "CaO", name: "Calcium oxide", formula: "CaO", type: "metal+oxygen", balanced: "2Ca + O₂ → 2CaO" },
    "Zn+O":        { symbol: "ZnO", name: "Zinc oxide", formula: "ZnO", type: "metal+oxygen", balanced: "2Zn + O₂ → 2ZnO" },
    "Cu+O":        { symbol: "CuO", name: "Copper(II) oxide", formula: "CuO", type: "metal+oxygen", balanced: "2Cu + O₂ → 2CuO" },
    "S+O":         { symbol: "SO₂", name: "Sulfur dioxide", formula: "SO₂", type: "combustion", balanced: "S + O₂ → SO₂" },
    "N+H":         { symbol: "NH₃", name: "Ammonia", formula: "NH₃", type: "direct combination", balanced: "N₂ + 3H₂ ⇌ 2NH₃" },
    "H+Cl":        { symbol: "HCl", name: "Hydrogen chloride", formula: "HCl", type: "direct combination", balanced: "H₂ + Cl₂ → 2HCl" },
    "Na+F":        { symbol: "NaF", name: "Sodium fluoride", formula: "NaF", type: "metal+halogen", balanced: "2Na + F₂ → 2NaF" },
    "Ca+Cl":       { symbol: "CaCl₂", name: "Calcium chloride", formula: "CaCl₂", type: "metal+halogen", balanced: "Ca + Cl₂ → CaCl₂" },
    "K+Cl":        { symbol: "KCl", name: "Potassium chloride", formula: "KCl", type: "metal+halogen", balanced: "2K + Cl₂ → 2KCl" },
    "Li+O":        { symbol: "Li₂O", name: "Lithium oxide", formula: "Li₂O", type: "metal+oxygen", balanced: "4Li + O₂ → 2Li₂O" }
};

// ============================================
// COMPOUND CLASSIFICATION
// ============================================
function classifyCompound(compound) {
    if (!compound) return null;
    const name = (compound.name || '').toLowerCase();
    const formula = (compound.formula || compound.symbol || '').toLowerCase();
    if (name === 'water' || formula === 'h2o' || formula === 'h₂o') return 'water';
    if (/^h[^2o]/.test(formula) || name.includes('acid')) return 'acid';
    if (name.endsWith('hydroxide') || /oh/i.test(formula)) return 'base';
    if (name.includes('carbonate') || /co3/i.test(formula)) return 'carbonate';
    if (name.endsWith('oxide') || /o[^h]/i.test(formula)) return 'oxide';
    return 'salt';
}

// ============================================
// REACTION PATTERNS
// ============================================
const reactionPatterns = [
    {
        reactantTypes: ['acid', 'base'],
        description: 'Neutralisation',
        generateProducts: (reactantA, reactantB) => {
            const acid = reactantA.category === 'acid' ? reactantA : reactantB;
            const base = reactantA.category === 'base' ? reactantA : reactantB;
            const acidAnion = getAnionFromAcid(acid);
            const baseCation = getCationFromBase(base);
            const saltFormula = buildIonicFormula(baseCation, acidAnion);
            const saltName = buildSaltName(baseCation, acidAnion);
            // salt is aqueous if soluble (all examples here are soluble)
            const saltSolubility = checkSolubility(baseCation.root, acidAnion.root);
            return [
                { symbol: saltFormula, name: saltName, formula: saltFormula, type: 'salt', isAqueous: saltSolubility },
                { symbol: 'H₂O', name: 'Water', formula: 'H₂O', type: 'water' }
            ];
        }
    },
    {
        reactantTypes: ['metal', 'acid'],
        description: 'Metal + Acid',
        generateProducts: (metal, acid) => {
            const acidAnion = getAnionFromAcid(acid);
            const metalCation = {
                symbol: metal.symbol + (metal.oxidationStates ? superscriptNumber(Math.abs(metal.oxidationStates[0])) : '⁺'),
                charge: metal.oxidationStates ? Math.abs(metal.oxidationStates[0]) : 1,
                root: metal.symbol,
                name: metal.name
            };
            const saltFormula = buildIonicFormula(metalCation, acidAnion);
            const saltSolubility = checkSolubility(metalCation.root, acidAnion.root);
            return [
                { symbol: saltFormula, name: buildSaltName(metalCation, acidAnion), formula: saltFormula, type: 'salt', isAqueous: saltSolubility },
                { symbol: 'H₂', name: 'Hydrogen', formula: 'H₂', type: 'gas' }
            ];
        }
    },
    {
        reactantTypes: ['oxide', 'acid'],
        description: 'Metal Oxide + Acid',
        generateProducts: (oxide, acid) => {
            const acidAnion = getAnionFromAcid(acid);
            const metalName = oxide.name.replace(' oxide', '').replace('(II)', '').replace('(III)', '').trim();
            const metalElement = elementsData.find(el => el.name.toLowerCase() === metalName.toLowerCase());
            if (!metalElement) return null;
            const metalCation = {
                symbol: metalElement.symbol + (metalElement.oxidationStates ? superscriptNumber(Math.abs(metalElement.oxidationStates[0])) : '⁺'),
                charge: metalElement.oxidationStates ? Math.abs(metalElement.oxidationStates[0]) : 1,
                root: metalElement.symbol,
                name: metalElement.name
            };
            const saltFormula = buildIonicFormula(metalCation, acidAnion);
            const saltSolubility = checkSolubility(metalCation.root, acidAnion.root);
            return [
                { symbol: saltFormula, name: buildSaltName(metalCation, acidAnion), formula: saltFormula, type: 'salt', isAqueous: saltSolubility },
                { symbol: 'H₂O', name: 'Water', formula: 'H₂O', type: 'water' }
            ];
        }
    },
    {
        reactantTypes: ['carbonate', 'acid'],
        description: 'Carbonate + Acid',
        generateProducts: (carbonate, acid) => {
            const acidAnion = getAnionFromAcid(acid);
            const metalName = carbonate.name.replace(' carbonate', '').replace('(II)', '').replace('(III)', '').trim();
            const metalElement = elementsData.find(el => el.name.toLowerCase() === metalName.toLowerCase());
            if (!metalElement) return null;
            const metalCation = {
                symbol: metalElement.symbol + (metalElement.oxidationStates ? superscriptNumber(Math.abs(metalElement.oxidationStates[0])) : '⁺'),
                charge: metalElement.oxidationStates ? Math.abs(metalElement.oxidationStates[0]) : 1,
                root: metalElement.symbol,
                name: metalElement.name
            };
            const saltFormula = buildIonicFormula(metalCation, acidAnion);
            const saltSolubility = checkSolubility(metalCation.root, acidAnion.root);
            return [
                { symbol: saltFormula, name: buildSaltName(metalCation, acidAnion), formula: saltFormula, type: 'salt', isAqueous: saltSolubility },
                { symbol: 'H₂O', name: 'Water', formula: 'H₂O', type: 'water' },
                { symbol: 'CO₂', name: 'Carbon dioxide', formula: 'CO₂', type: 'gas' }
            ];
        }
    }
];

function getAnionFromAcid(acid) {
    const formula = acid.formula || acid.symbol || '';
    const anionRoot = formula.replace(/^h/i, '').replace(/[₀₁₂₃₄₅₆₇₈₉]/g, '');
    const chargeMap = { 'Cl': -1, 'F': -1, 'Br': -1, 'I': -1, 'NO3': -1, 'SO4': -2, 'CO3': -2, 'PO4': -3 };
    const charge = chargeMap[anionRoot] || -1;
    return { symbol: anionRoot + (charge === -1 ? '⁻' : charge === -2 ? '²⁻' : '³⁻'), charge, root: anionRoot, name: anionRoot + (charge === -1 ? 'ide' : 'ate') };
}
function getCationFromBase(base) {
    const formula = base.formula || base.symbol || '';
    const cationRoot = formula.replace(/oh/i, '').replace(/[₀₁₂₃₄₅₆₇₈₉]/g, '');
    const element = elementsData.find(el => el.symbol.toLowerCase() === cationRoot.toLowerCase());
    if (element) {
        const charge = element.oxidationStates ? Math.abs(element.oxidationStates[0]) : 1;
        return { symbol: element.symbol + superscriptNumber(charge) + '⁺', charge, root: element.symbol, name: element.name };
    }
    return { symbol: cationRoot + '⁺', charge: 1, root: cationRoot, name: cationRoot };
}
function buildIonicFormula(cation, anion) {
    const cCharge = Math.abs(cation.charge);
    const aCharge = Math.abs(anion.charge);
    const gcd = (a, b) => b ? gcd(b, a % b) : a;
    const g = gcd(cCharge, aCharge);
    const cSub = aCharge / g;
    const aSub = cCharge / g;
    let cationPart = cation.root;
    if (cSub > 1) cationPart += subscriptNumber(cSub);
    let anionPart = anion.root;
    if (aSub > 1) {
        if (anion.root.length > 1 || /[A-Z][a-z]/.test(anion.root)) {
            anionPart = '(' + anion.root + ')' + subscriptNumber(aSub);
        } else {
            anionPart += subscriptNumber(aSub);
        }
    }
    return cationPart + anionPart;
}
function buildSaltName(cation, anion) {
    return cation.name + ' ' + anion.name;
}
function superscriptNumber(num) {
    const sups = '⁰¹²³⁴⁵⁶⁷⁸⁹';
    return String(num).split('').map(d => sups[parseInt(d)]).join('');
}
function subscriptNumber(num) {
    const subs = '₀₁₂₃₄₅₆₇₈₉';
    return String(num).split('').map(d => subs[parseInt(d)]).join('');
}
function gcd(a, b) { return b ? gcd(b, a % b) : a; }

// ============================================
// STATE DETERMINATION (improved with isAqueous)
// ============================================
function getProductState(product, temp, isAqueous = false) {
    // If explicitly formed in aqueous solution, force (aq) unless it's a gas that overrides?
    if (isAqueous) {
        // Check if compound is a known gas that would escape (like CO₂, SO₂, NH₃?) But for salts/ions, (aq)
        const formula = product.formula || product.symbol || '';
        // If it's a water molecule, still use normal rules (water can be (l) even in aqueous context)
        if (formula === 'H₂O') {
            return temp < 0 ? 's' : temp >= 100 ? 'g' : 'l';
        }
        // For everything else, aqueous
        return 'aq';
    }
    // Normal rules
    const formula = product.formula || product.symbol || '';
    const props = compoundsData.find(c => c.formula === formula);
    if (props) {
        if (temp < props.meltingPoint) return 's';
        if (props.boilingPoint === null || temp < props.boilingPoint) return 'l';
        return 'g';
    }
    if (product.meltingPoint !== undefined && product.boilingPoint !== undefined) {
        if (temp < product.meltingPoint) return 's';
        if (temp >= product.meltingPoint && temp < product.boilingPoint) return 'l';
        return 'g';
    }
    const cation = getCationFromFormula(formula);
    const anion = getAnionFromFormula(formula);
    if (cation && anion) {
        return checkSolubility(cation, anion) ? 'aq' : 's';
    }
    if (product.type === 'gas') return 'g';
    if (product.type === 'water') return temp < 0 ? 's' : temp >= 100 ? 'g' : 'l';
    return 's';
}
function getCationFromFormula(formula) {
    const match = formula.match(/^([A-Z][a-z]?)/);
    return match ? match[1] : null;
}
function getAnionFromFormula(formula) {
    const cationMatch = formula.match(/^[A-Z][a-z]?[₀₁₂₃₄₅₆₇₈₉]*/);
    if (!cationMatch) return null;
    const anionPart = formula.slice(cationMatch[0].length);
    return anionPart.replace(/[₀₁₂₃₄₅₆₇₈₉()]/g, '');
}
function checkSolubility(cation, anion) {
    if (solubilityRules.alwaysSoluble.includes(cation) || solubilityRules.alwaysSoluble.includes(anion)) return true;
    if (anion === 'Cl' || anion === 'Br' || anion === 'I') return !solubilityRules.halides.exceptions.includes(cation);
    if (anion === 'SO₄' || anion === 'SO4') return !solubilityRules.sulfates.exceptions.includes(cation);
    if (anion === 'CO₃' || anion === 'CO3') return false;
    if (anion === 'OH') return solubilityRules.hydroxides.exceptions && solubilityRules.hydroxides.exceptions.includes(cation);
    return true;
}
function updateAllProductStates() {
    document.querySelectorAll('.product-card').forEach(card => {
        const product = JSON.parse(card.dataset.product || '{}');
        const isAqueous = product.isAqueous === true;  // stored boolean
        const state = getProductState(product, currentTemperature, isAqueous);
        const stateSpan = card.querySelector('.product-state');
        if (stateSpan) stateSpan.textContent = `(${state})`;
    });
}

// ============================================
// MOLECULAR MASS CALCULATION
// ============================================
function calculateMolecularMass(formula) {
    const found = compoundsData.find(c => c.formula === formula);
    if (found && found.molecularMass) return found.molecularMass;
    let mass = 0, i = 0;
    const len = formula.length;
    while (i < len) {
        if (formula[i] === '(') {
            const j = formula.indexOf(')', i);
            const inner = formula.slice(i+1, j);
            i = j + 1;
            let count = '';
            while (i < len && /[₀₁₂₃₄₅₆₇₈₉]/.test(formula[i])) {
                count += formula[i]; i++;
            }
            const num = count ? parseInt(decodeSubscript(count)) : 1;
            mass += num * calculateMolecularMass(inner);
        } else if (/[A-Z]/.test(formula[i])) {
            let symbol = formula[i]; i++;
            if (i < len && /[a-z]/.test(formula[i])) { symbol += formula[i]; i++; }
            let count = '';
            while (i < len && /[₀₁₂₃₄₅₆₇₈₉]/.test(formula[i])) {
                count += formula[i]; i++;
            }
            const num = count ? parseInt(decodeSubscript(count)) : 1;
            const el = elementsData.find(e => e.symbol === symbol);
            if (el) mass += el.atomicMass * num;
        } else { i++; }
    }
    return Math.round(mass * 100) / 100;
}
function decodeSubscript(sub) {
    const map = {'₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9'};
    let result = '';
    for (let ch of sub) result += map[ch] || ch;
    return result;
}

// ============================================
// FETCH & SETUP
// ============================================
fetch('data/elements.json')
    .then(response => {
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        return response.json();
    })
    .then(data => {
        elementsData = data;
        return fetch('data/ion.json');
    })
    .then(response => {
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        return response.json();
    })
    .then(ionJson => {
        ionData = ionJson;
        return fetch('data/compounds.json');
    })
    .then(response => {
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        return response.json();
    })
    .then(compoundsJson => {
        compoundsData = compoundsJson;
        renderPeriodicTable(elementsData);
        buildIonPalette();
        updateCardSize();
        window.addEventListener('hashchange', router);
        router();
        positionOverlayControls();
        window.addEventListener('resize', () => {
            positionOverlayControls();
            updateCardSize();
        });
    })
    .catch(error => {
        console.error('Error loading data:', error);
        document.getElementById('periodic-table').innerHTML =
            '<p style="color: red;">Failed to load data. Check console.</p>';
    });

// ============================================
// HELPER: Determine state based on temperature (for elements)
// ============================================
function getState(element, temp) {
    const mp = element.meltingPoint;
    const bp = element.boilingPoint;
    if (mp === null || mp === undefined || bp === null || bp === undefined) {
        if (element.category === 'noble gas' || element.category === 'diatomic nonmetal') return 'g';
        if (element.symbol === 'Hg') return 'l';
        if (element.symbol === 'Br') return 'l';
        return 's';
    }
    if (temp < mp) return 's';
    if (temp >= mp && temp < bp) return 'l';
    return 'g';
}

// ============================================
// Update state symbols on all cards
// ============================================
function updateAllStateSymbols() {
    const allCards = document.querySelectorAll('.element-card:not(.placeholder):not(.f-block-label-card)');
    allCards.forEach(card => {
        const atomicNumber = parseInt(card.dataset.atomicNumber);
        const element = elementsData.find(el => el.atomicNumber === atomicNumber);
        if (!element) return;
        const quantity = elementQuantities.get(atomicNumber) || 1;
        updateCardDisplay(card, element, quantity);
    });
}

// ============================================
// Update a single card's display
// ============================================
function updateCardDisplay(card, element, quantity) {
    const symbolSpan = card.querySelector('.symbol');
    if (!symbolSpan) return;
    const state = getState(element, currentTemperature);
    let displaySymbol = element.symbol;
    let ionSelected = false;
    if (currentMode === 'ion' && element.commonIons && element.commonIons.length > 0) {
        const idx = ionIndexMap.get(element.atomicNumber);
        if (idx !== undefined && idx >= 0 && idx < element.commonIons.length) {
            displaySymbol = element.commonIons[idx].symbol;
            ionSelected = true;
        }
    }
    symbolSpan.textContent = displaySymbol;
    let stateSpan = card.querySelector('.state-symbol');
    if (!stateSpan) {
        stateSpan = document.createElement('span');
        stateSpan.className = 'state-symbol';
        symbolSpan.appendChild(stateSpan);
    }
    stateSpan.textContent = ionSelected ? '(aq)' : `(${state})`;
    let badge = card.querySelector('.quantity-badge');
    if (quantity > 1) {
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'quantity-badge';
            card.appendChild(badge);
        }
        badge.textContent = quantity;
    } else {
        if (badge) badge.remove();
    }
    card.dataset.quantity = quantity;
}

// ============================================
// RENDER PERIODIC TABLE GRID
// ============================================
function renderPeriodicTable(elements) {
    const mainContainer = document.getElementById('periodic-table');
    const lanthanidesContainer = document.getElementById('lanthanides-grid');
    const actinidesContainer = document.getElementById('actinides-grid');
    if (!mainContainer || !lanthanidesContainer || !actinidesContainer) {
        console.error('One or more grid containers are missing!');
        return;
    }
    mainContainer.innerHTML = '';
    lanthanidesContainer.innerHTML = '';
    actinidesContainer.innerHTML = '';
    const laPlaceholder = document.createElement('div');
    laPlaceholder.className = 'element-card placeholder';
    laPlaceholder.innerHTML = '57–71<br>La–Lu';
    laPlaceholder.style.gridColumn = '3';
    laPlaceholder.style.gridRow = '6';
    mainContainer.appendChild(laPlaceholder);
    const acPlaceholder = document.createElement('div');
    acPlaceholder.className = 'element-card placeholder';
    acPlaceholder.innerHTML = '89–103<br>Ac–Lr';
    acPlaceholder.style.gridColumn = '3';
    acPlaceholder.style.gridRow = '7';
    mainContainer.appendChild(acPlaceholder);
    const laLabelCard = document.createElement('div');
    laLabelCard.className = 'f-block-label-card';
    laLabelCard.innerHTML = 'Lanthanides<br><span>57–71</span>';
    laLabelCard.style.gridColumn = '1 / span 2';
    laLabelCard.style.gridRow = '1';
    lanthanidesContainer.appendChild(laLabelCard);
    const acLabelCard = document.createElement('div');
    acLabelCard.className = 'f-block-label-card';
    acLabelCard.innerHTML = 'Actinides<br><span>89–103</span>';
    acLabelCard.style.gridColumn = '1 / span 2';
    acLabelCard.style.gridRow = '1';
    actinidesContainer.appendChild(acLabelCard);
    elements.forEach(element => {
        const isLanthanide = element.atomicNumber >= 57 && element.atomicNumber <= 71;
        const isActinide = element.atomicNumber >= 89 && element.atomicNumber <= 103;
        const card = document.createElement('div');
        card.className = 'element-card';
        let targetContainer = mainContainer;
        if (isLanthanide) {
            targetContainer = lanthanidesContainer;
            const startColumn = 3;
            const col = startColumn + (element.atomicNumber - 57);
            card.style.gridColumn = col.toString();
            card.style.gridRow = '1';
        } else if (isActinide) {
            targetContainer = actinidesContainer;
            const startColumn = 3;
            const col = startColumn + (element.atomicNumber - 89);
            card.style.gridColumn = col.toString();
            card.style.gridRow = '1';
        } else {
            card.style.gridColumn = element.groupNumber;
            card.style.gridRow = element.period;
        }
        const atomicNumberSpan = document.createElement('span');
        atomicNumberSpan.className = 'atomic-number';
        atomicNumberSpan.textContent = element.atomicNumber;
        const symbolSpan = document.createElement('span');
        symbolSpan.className = 'symbol';
        const atomicMassSpan = document.createElement('span');
        atomicMassSpan.className = 'atomic-mass';
        atomicMassSpan.textContent = element.atomicMass.toFixed(3);
        card.appendChild(atomicNumberSpan);
        card.appendChild(symbolSpan);
        card.appendChild(atomicMassSpan);
        const infoBtn = document.createElement('span');
        infoBtn.className = 'info-btn';
        infoBtn.textContent = 'ⓘ';
        infoBtn.title = 'Ion details';
        infoBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (currentMode === 'ion' && element.commonIons && element.commonIons.length > 0) {
                const idx = ionIndexMap.get(element.atomicNumber);
                if (idx !== undefined && idx >= 0 && idx < element.commonIons.length) {
                    const ion = element.commonIons[idx];
                    showIonDetail(ion.symbol);
                }
            }
        });
        card.appendChild(infoBtn);
        card.dataset.atomicNumber = element.atomicNumber;
        card.dataset.symbol = element.symbol;
        card.dataset.name = element.name;
        card.setAttribute('data-block', element.block);
        card.setAttribute('data-category', element.category.toLowerCase().replace(/\s+/g, '-'));
        if (!elementQuantities.has(element.atomicNumber)) elementQuantities.set(element.atomicNumber, 1);
        if (!ionIndexMap.has(element.atomicNumber)) {
            if (element.commonIons && element.commonIons.length > 0) ionIndexMap.set(element.atomicNumber, 0);
            else ionIndexMap.set(element.atomicNumber, -1);
        }
        const quantity = elementQuantities.get(element.atomicNumber);
        updateCardDisplay(card, element, quantity);
        // ========== DRAG & DROP ==========
        card.draggable = true;
        card.addEventListener('dragstart', (e) => {
            isDragging = true;
            const ionIdx = ionIndexMap.get(element.atomicNumber) || 0;
            const qty = elementQuantities.get(element.atomicNumber) || 1;
            e.dataTransfer.setData('application/json', JSON.stringify({ atomicNumber: element.atomicNumber, ionIndex: ionIdx, quantity: qty }));
            e.dataTransfer.effectAllowed = 'move';
            card.style.overflow = 'visible';
        });
        card.addEventListener('dragend', () => {
            card.style.overflow = 'hidden';
            setTimeout(() => { isDragging = false; }, 0);
        });
        card.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
        card.addEventListener('drop', (e) => {
            e.preventDefault();
            const rawData = e.dataTransfer.getData('application/json');
            if (!rawData) return;
            const dragData = JSON.parse(rawData);
            handleReaction(dragData, e, element);
        });
        // ---------- Click ----------
        card.addEventListener('click', (e) => {
            e.stopPropagation();
            if (isDragging) return;
            if (currentMode === 'ion') {
                if (element.commonIons && element.commonIons.length > 0) {
                    const currentIdx = ionIndexMap.get(element.atomicNumber) || 0;
                    const nextIdx = (currentIdx + 1) % element.commonIons.length;
                    ionIndexMap.set(element.atomicNumber, nextIdx);
                    updateCardDisplay(card, element, elementQuantities.get(element.atomicNumber) || 1);
                }
            } else {
                window.location.hash = `element/${element.atomicNumber}`;
            }
        });
        // ---------- Right‑click ----------
        card.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const currentQty = elementQuantities.get(element.atomicNumber) || 1;
            elementQuantities.set(element.atomicNumber, currentQty + 1);
            updateCardDisplay(card, element, currentQty + 1);
        });
        targetContainer.appendChild(card);
    });
}

// ============================================
// UNIVERSAL REACTION HANDLER
// ============================================
function handleReaction(dragData, event, targetElementOrIon) {
    let reactantA = null, ionA = null, productA = null;
    if (dragData.atomicNumber !== undefined) {
        reactantA = elementsData.find(el => el.atomicNumber === dragData.atomicNumber);
        if (currentMode === 'ion' && reactantA && reactantA.commonIons && reactantA.commonIons.length > 0) {
            const idx = dragData.ionIndex !== undefined ? dragData.ionIndex : 0;
            if (idx >= 0 && idx < reactantA.commonIons.length) {
                const ion = reactantA.commonIons[idx];
                ionA = { symbol: ion.symbol, charge: ion.charge, name: reactantA.name, root: reactantA.symbol };
            }
        }
    } else if (dragData.charge !== undefined) {
        ionA = { symbol: dragData.symbol, charge: dragData.charge, name: dragData.name, root: dragData.symbol.replace(/[⁺⁻²³⁴⁵⁶⁷⁸⁹⁰]/g, '') };
    } else if (dragData.symbol && dragData.formula) {
        productA = { symbol: dragData.symbol, name: dragData.name, formula: dragData.formula, balanced: dragData.balanced || '', quantity: dragData.quantity || 1, category: dragData.category || classifyCompound({ name: dragData.name, formula: dragData.formula }) };
    }
    let reactantB = null, ionB = null, productB = null;
    if (targetElementOrIon && targetElementOrIon.atomicNumber) {
        reactantB = targetElementOrIon;
        if (currentMode === 'ion' && reactantB.commonIons && reactantB.commonIons.length > 0) {
            const idxB = ionIndexMap.get(reactantB.atomicNumber) || 0;
            if (idxB >= 0 && idxB < reactantB.commonIons.length) {
                const ion = reactantB.commonIons[idxB];
                ionB = { symbol: ion.symbol, charge: ion.charge, name: reactantB.name, root: reactantB.symbol };
            }
        }
    } else if (targetElementOrIon && targetElementOrIon.charge !== undefined) {
        ionB = { symbol: targetElementOrIon.symbol, charge: targetElementOrIon.charge, name: targetElementOrIon.name, root: targetElementOrIon.root };
    } else if (targetElementOrIon && targetElementOrIon.dataset && targetElementOrIon.dataset.formula) {
        productB = { symbol: targetElementOrIon.dataset.symbol, name: targetElementOrIon.dataset.name, formula: targetElementOrIon.dataset.formula, balanced: targetElementOrIon.dataset.balanced || '', quantity: parseInt(targetElementOrIon.dataset.quantity) || 1, category: targetElementOrIon.dataset.category || classifyCompound({ name: targetElementOrIon.dataset.name, formula: targetElementOrIon.dataset.formula }) };
    }
    let result = null;
    if (ionA && ionB) {
        result = reactIons(ionA, ionB);
    } else if ((reactantA || productA) && (reactantB || productB)) {
        const symA = reactantA ? reactantA.symbol : productA.symbol;
        const symB = reactantB ? reactantB.symbol : productB.symbol;
        const key1 = symA + '+' + symB;
        const key2 = symB + '+' + symA;
        const reaction = reactionMap[key1] || reactionMap[key2];
        if (reaction) {
            result = { products: [ { ...reaction, quantity: 1 } ], type: reaction.type };
        } else {
            const catA = reactantA ? reactantA.category : productA.category;
            const catB = reactantB ? reactantB.category : productB.category;
            if (catA && catB) {
                const pattern = reactionPatterns.find(p =>
                    (p.reactantTypes[0] === catA && p.reactantTypes[1] === catB) ||
                    (p.reactantTypes[0] === catB && p.reactantTypes[1] === catA)
                );
                if (pattern) {
                    const reactantObjA = reactantA || { name: productA.name, formula: productA.formula, category: productA.category };
                    const reactantObjB = reactantB || { name: productB.name, formula: productB.formula, category: productB.category };
                    const products = pattern.generateProducts(reactantObjA, reactantObjB);
                    if (products) {
                        result = { products: products.map(p => ({ ...p, quantity: 1 })), type: pattern.description };
                    }
                }
            }
        }
    }
    if (result) {
        const wrapper = document.querySelector('.table-relative-wrapper');
        const rect = wrapper.getBoundingClientRect();
        const products = result.products;
        products.forEach(prod => {
            prod.reactionType = result.type;
            const x = event.clientX - rect.left - 40 + Math.random() * 20;
            const y = event.clientY - rect.top - 40 + Math.random() * 20;
            createProductCard(prod, x, y);
        });
        const aStr = reactantA || ionA || productA;
        const bStr = reactantB || ionB || productB;
        logReaction(products[0], result.type, aStr, bStr);
    } else {
        const aStr = reactantA || ionA || productA;
        const bStr = reactantB || ionB || productB;
        logNoReaction(aStr, bStr);
    }
}

// ============================================
// ION REACTION ENGINE
// ============================================
function reactIons(ionA, ionB) {
    let cation, anion;
    if (ionA.charge > 0 && ionB.charge < 0) { cation = ionA; anion = ionB; }
    else if (ionB.charge > 0 && ionA.charge < 0) { cation = ionB; anion = ionA; }
    else return null;
    const cCharge = Math.abs(cation.charge);
    const aCharge = Math.abs(anion.charge);
    const g = gcd(cCharge, aCharge);
    const cationSubscript = aCharge / g;
    const anionSubscript = cCharge / g;
    const cationRoot = cation.root || cation.symbol.replace(/[⁺⁻²³⁴⁵⁶⁷⁸⁹⁰]/g, '');
    const anionRoot = anion.root || anion.symbol.replace(/[⁺⁻²³⁴⁵⁶⁷⁸⁹⁰]/g, '');
    let formula = cationRoot;
    if (cationSubscript > 1) formula += subscriptNumber(cationSubscript);
    let anionPart = anionRoot;
    if (anionSubscript > 1) {
        if (anionRoot.length > 1 || /[A-Z][a-z]/.test(anionRoot)) anionPart = '(' + anionRoot + ')' + subscriptNumber(anionSubscript);
        else anionPart += subscriptNumber(anionSubscript);
    }
    formula += anionPart;
    let name = cation.name + ' ' + anion.name.toLowerCase();
    // Determine if product is aqueous (soluble ionic compound)
    const isAqueous = checkSolubility(cationRoot, anionRoot);
    let balanced = '';
    if (cationSubscript > 1) balanced += cationSubscript;
    balanced += cation.symbol + ' + ';
    if (anionSubscript > 1) balanced += anionSubscript;
    balanced += anion.symbol + ' → ' + formula;
    return {
        products: [ { symbol: formula, name, formula, type: 'ionic', balanced, isAqueous } ],
        type: 'ionic'
    };
}

// ============================================
// NEUTRAL REACTION (used by old map)
// ============================================
function react(elementA, elementB, qtyA) {
    const key1 = elementA.symbol + '+' + elementB.symbol;
    const key2 = elementB.symbol + '+' + elementA.symbol;
    const reaction = reactionMap[key1] || reactionMap[key2];
    if (reaction) {
        const qtyB = elementQuantities.get(elementB.atomicNumber) || 1;
        const minQty = Math.min(qtyA || 1, qtyB);
        return { products: [ { ...reaction, quantity: minQty } ], type: reaction.type };
    }
    return null;
}

// ============================================
// UPDATE CARD SIZE
// ============================================
function updateCardSize() {
    const hCard = document.querySelector('.element-card[data-symbol="H"]');
    if (hCard) cardSize = hCard.offsetWidth;
    document.querySelectorAll('.product-card').forEach(card => {
        card.style.width = cardSize + 'px';
        card.style.height = cardSize + 'px';
    });
    document.querySelectorAll('.palette-card').forEach(card => {
        card.style.width = cardSize + 'px';
        card.style.height = cardSize + 'px';
    });
}

// ============================================
// BUILD POLYATOMIC ION PALETTE
// ============================================
function buildIonPalette() {
    const grid = document.getElementById('palette-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const titleDiv = document.createElement('div');
    titleDiv.className = 'palette-title';
    titleDiv.textContent = '⚛️ Common Ions (drag me)';
    titleDiv.style.gridColumn = '1 / span 4';
    titleDiv.style.gridRow = '1';
    grid.appendChild(titleDiv);
    paletteIons.forEach((ion, index) => {
        const card = document.createElement('div');
        card.className = 'palette-card';
        card.textContent = ion.symbol;
        card.title = ion.name + ' (' + (ion.charge > 0 ? '+' : '') + ion.charge + ')';
        card.dataset.symbol = ion.symbol;
        card.dataset.charge = ion.charge;
        card.dataset.name = ion.name;
        card.dataset.root = ion.root;
        if (!paletteQuantities.has(ion.symbol)) paletteQuantities.set(ion.symbol, 1);
        const qty = paletteQuantities.get(ion.symbol);
        card.dataset.quantity = qty;
        const badge = document.createElement('span');
        badge.className = 'quantity-badge';
        badge.textContent = qty > 1 ? qty : '';
        card.appendChild(badge);
        card.style.gridColumn = (5 + index).toString();
        card.style.gridRow = '1';
        card.draggable = true;
        card.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('application/json', JSON.stringify({ symbol: ion.symbol, charge: ion.charge, name: ion.name, quantity: paletteQuantities.get(ion.symbol) || 1 }));
            e.dataTransfer.effectAllowed = 'move';
        });
        card.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            let qty = paletteQuantities.get(ion.symbol) || 1;
            qty += 1;
            paletteQuantities.set(ion.symbol, qty);
            card.dataset.quantity = qty;
            const badge = card.querySelector('.quantity-badge');
            if (badge) badge.textContent = qty;
        });
        card.addEventListener('dragover', (e) => { e.preventDefault(); });
        card.addEventListener('drop', (e) => {
            e.preventDefault();
            const rawData = e.dataTransfer.getData('application/json');
            if (!rawData) return;
            const dragData = JSON.parse(rawData);
            handleReaction(dragData, e, { symbol: ion.symbol, charge: ion.charge, name: ion.name, root: ion.root });
        });
        grid.appendChild(card);
    });
}

// ============================================
// CREATE PRODUCT CARD (with grip, info button)
// ============================================
function createProductCard(product, initialX, initialY) {
    const card = document.createElement('div');
    card.className = 'product-card';
    const isAqueous = product.isAqueous === true;
    const state = getProductState(product, currentTemperature, isAqueous);
    card.innerHTML = `<span style="font-size: 0.9rem; font-weight: bold;">${product.symbol}<span class="product-state">(${state})</span></span>`;
    card.title = product.name;
    card.dataset.symbol = product.symbol;
    card.dataset.name = product.name;
    card.dataset.formula = product.formula;
    card.dataset.quantity = product.quantity || 1;
    card.dataset.balanced = product.balanced || '';
    card.dataset.category = classifyCompound({ name: product.name, formula: product.formula });
    card.dataset.reactionType = product.reactionType || '';
    card.dataset.product = JSON.stringify(product);  // store original product object with isAqueous
    card.style.width = cardSize + 'px';
    card.style.height = cardSize + 'px';
    if (product.quantity > 1) {
        const badge = document.createElement('span');
        badge.className = 'quantity-badge';
        badge.textContent = product.quantity;
        card.appendChild(badge);
    }
    // grip handle
    const grip = document.createElement('div');
    grip.className = 'grip-handle';
    grip.title = 'Drag to move';
    card.appendChild(grip);
    let dragState = { isDragging: false, startX: 0, startY: 0, left: 0, top: 0 };
    grip.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        dragState.isDragging = true;
        dragState.startX = e.clientX;
        dragState.startY = e.clientY;
        dragState.left = card.offsetLeft;
        dragState.top = card.offsetTop;
        card.style.cursor = 'grabbing';
        e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => {
        if (!dragState.isDragging) return;
        const dx = e.clientX - dragState.startX;
        const dy = e.clientY - dragState.startY;
        card.style.left = (dragState.left + dx) + 'px';
        card.style.top = (dragState.top + dy) + 'px';
    });
    window.addEventListener('mouseup', () => {
        if (dragState.isDragging) { dragState.isDragging = false; card.style.cursor = ''; }
    });
    const wrapper = document.querySelector('.table-relative-wrapper');
    card.style.left = initialX + 'px';
    card.style.top = initialY + 'px';
    wrapper.appendChild(card);
    // Info button (ⓘ) top-right
    const infoBtn = document.createElement('span');
    infoBtn.className = 'info-btn';
    infoBtn.textContent = 'ⓘ';
    infoBtn.title = 'Product details';
    infoBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showProductDetail(card);
    });
    card.appendChild(infoBtn);
    // Quantity right-click
    card.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        let qty = parseInt(card.dataset.quantity) || 1;
        qty += 1;
        card.dataset.quantity = qty;
        let badge = card.querySelector('.quantity-badge');
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'quantity-badge';
            card.appendChild(badge);
        }
        badge.textContent = qty;
    });
    // Draggable
    card.draggable = true;
    card.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('application/json', JSON.stringify({
            symbol: product.symbol,
            name: product.name,
            formula: product.formula,
            quantity: product.quantity || 1,
            balanced: product.balanced || '',
            category: card.dataset.category
        }));
        e.dataTransfer.effectAllowed = 'move';
    });
    card.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
    card.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const rawData = e.dataTransfer.getData('application/json');
        if (!rawData) return;
        const dragData = JSON.parse(rawData);
        handleReaction(dragData, e, card);
    });
    return card;
}

// ============================================
// SHOW PRODUCT DETAIL POP‑UP
// ============================================
function showProductDetail(card) {
    const popup = document.getElementById('product-popup');
    if (!popup) return;
    const symbol = card.dataset.symbol;
    const name = card.dataset.name;
    const formula = card.dataset.formula;
    const mass = calculateMolecularMass(formula);
    const product = JSON.parse(card.dataset.product || '{}');
    const isAqueous = product.isAqueous === true;
    const state = getProductState(product, currentTemperature, isAqueous);
    const reactionType = card.dataset.reactionType || '—';
    // Description from compounds.json
    const compound = compoundsData.find(c => c.formula === formula);
    const description = compound?.description || 'No description available.';
    document.getElementById('product-popup-symbol').textContent = symbol;
    document.getElementById('product-popup-name').textContent = name;
    document.getElementById('product-popup-formula').textContent = formula;
    document.getElementById('product-popup-mass').textContent = mass + ' u';
    document.getElementById('product-popup-state').textContent = `(${state})`;
    document.getElementById('product-popup-type').textContent = reactionType;
    document.getElementById('product-popup-description').textContent = description;
    popup.style.display = 'flex';
}

// ============================================
// REACTION LOG FUNCTIONS
// ============================================
function logReaction(product, type, a, b) {
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';
    const conditions = [];
    conditions.push(`${currentTemperature} °C`);
    conditions.push(`${currentPressure} kPa`);
    if (currentCatalyst !== 'none') conditions.push(`catalyst: ${currentCatalyst}`);
    const conditionStr = conditions.join(', ');
    const balanced = product.balanced || `${a?.symbol || a?.root} + ${b?.symbol || b?.root} → ${product.symbol}`;
    logEntry.innerHTML = `<strong>${balanced}</strong><br><small>Type: ${type} | ${conditionStr}</small>`;
    document.getElementById('log-entries').appendChild(logEntry);
    reactionLogEntries.push(logEntry.textContent);
}
function logNoReaction(a, b) {
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';
    logEntry.style.borderLeftColor = '#ff6666';
    const symA = a?.symbol || a?.root || '?';
    const symB = b?.symbol || b?.root || '?';
    logEntry.innerHTML = `<strong>${symA} + ${symB} → ❌ No reaction</strong>`;
    document.getElementById('log-entries').appendChild(logEntry);
    reactionLogEntries.push(logEntry.textContent);
}

// ============================================
// POSITION OVERLAY CONTROLS
// ============================================
function positionOverlayControls() {
    const hCard = document.querySelector('.element-card[data-symbol="H"]');
    const heCard = document.querySelector('.element-card[data-symbol="He"]');
    const tempOverlay = document.querySelector('.temp-overlay');
    const pressureOverlay = document.querySelector('.pressure-overlay');
    const catalystOverlay = document.querySelector('.catalyst-overlay');
    if (!hCard || !heCard || !tempOverlay || !pressureOverlay || !catalystOverlay) return;
    const container = document.querySelector('.table-relative-wrapper');
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const hRect = hCard.getBoundingClientRect();
    const heRect = heCard.getBoundingClientRect();
    const TEMP_W = 400, PRESSURE_W = 400, CATALYST_W = 300, GAP = 10;
    const tempLeft = hRect.right - containerRect.left + GAP;
    tempOverlay.style.left = tempLeft + 'px';
    tempOverlay.style.right = 'auto';
    tempOverlay.style.top = (hRect.top - containerRect.top) + 'px';
    const catalystRightFromLeft = heRect.left - containerRect.left - GAP;
    const catalystLeft = catalystRightFromLeft - CATALYST_W;
    catalystOverlay.style.left = (catalystLeft > tempLeft ? catalystLeft : tempLeft + TEMP_W + GAP) + 'px';
    catalystOverlay.style.right = 'auto';
    catalystOverlay.style.top = (heRect.top - containerRect.top) + 'px';
    const tempRight = tempLeft + TEMP_W;
    const availableMiddle = catalystLeft - tempRight;
    let pressureLeft = availableMiddle >= PRESSURE_W ? tempRight + (availableMiddle - PRESSURE_W) / 2 : tempRight + GAP;
    pressureOverlay.style.left = pressureLeft + 'px';
    pressureOverlay.style.right = 'auto';
    pressureOverlay.style.top = (hRect.top - containerRect.top) + 'px';
}

// ============================================
// ROUTER
// ============================================
function router() {
    const hash = window.location.hash.slice(1);
    if (hash.startsWith('element/')) {
        const atomicNumber = parseInt(hash.split('/')[1]);
        if (!isNaN(atomicNumber)) showElementDetail(atomicNumber);
        else showTableView();
    } else showTableView();
}
function showTableView() {
    tableViewContainer.style.display = 'block';
    detailView.style.display = 'none';
    document.getElementById('reaction-log').style.display = 'block';
    document.getElementById('ion-palette').style.display = 'block';
    window.location.hash = '';
}
function showDetailView() {
    tableViewContainer.style.display = 'none';
    detailView.style.display = 'block';
    document.getElementById('reaction-log').style.display = 'none';
    document.getElementById('ion-palette').style.display = 'none';
}

// ============================================
// POPULATE DETAIL VIEW
// ============================================
function showElementDetail(atomicNumber) {
    const element = elementsData.find(el => el.atomicNumber === atomicNumber);
    if (!element) { showTableView(); return; }
    document.getElementById('detail-symbol').textContent = element.symbol;
    document.getElementById('detail-name').textContent = element.name;
    document.getElementById('detail-atomic-number').textContent = element.atomicNumber;
    document.getElementById('detail-atomic-mass').textContent = element.atomicMass.toFixed(3) + ' u';
    document.getElementById('detail-group').textContent = element.groupDisplay || element.groupNumber;
    document.getElementById('detail-period').textContent = element.period;
    document.getElementById('detail-block').textContent = element.block;
    document.getElementById('detail-electron-config').textContent = element.electronConfig;
    document.getElementById('detail-category').textContent = element.category;
    const descElement = document.getElementById('detail-description');
    descElement.textContent = element.description && element.description.trim() !== '' ? element.description : 'Description will be added soon.';
    const imgElement = document.getElementById('detail-image');
    const noImageMsg = document.getElementById('no-image-message');
    if (element.imageURL && element.imageURL.trim() !== '') {
        imgElement.src = element.imageURL;
        imgElement.style.display = 'block';
        noImageMsg.style.display = 'none';
    } else {
        imgElement.style.display = 'none';
        noImageMsg.style.display = 'block';
    }
    function safeDisplay(value, unit = '') {
        if (value === null || value === undefined) return '—';
        return value + unit;
    }
    document.getElementById('detail-melting-point').textContent = safeDisplay(element.meltingPoint, ' °C');
    document.getElementById('detail-boiling-point').textContent = safeDisplay(element.boilingPoint, ' °C');
    document.getElementById('detail-electronegativity').textContent = (element.electronegativity !== null && element.electronegativity !== undefined) ? element.electronegativity : '—';
    const oxStates = element.oxidationStates || [];
    document.getElementById('detail-oxidation-states').textContent = oxStates.length > 0 ? oxStates.map(s => (s > 0 ? '+' : '') + s).join(', ') : '—';
    const ions = element.commonIons || [];
    document.getElementById('detail-ions').textContent = ions.length > 0 ? ions.map(ion => ion.symbol).join(', ') : 'none';
    showDetailView();
    window.location.hash = `element/${atomicNumber}`;
}

// ============================================
// SHOW ION DETAIL POP‑UP
// ============================================
function showIonDetail(ionSymbol) {
    const popup = document.getElementById('ion-popup');
    if (!popup) { alert('Pop‑up HTML missing.'); return; }
    const setText = (id, text) => { const elem = document.getElementById(id); if (elem) elem.textContent = text || '—'; };
    const ion = ionData.find(i => i.symbol === ionSymbol);
    if (!ion) {
        setText('ion-popup-symbol', ionSymbol);
        setText('ion-popup-name', 'No test data available');
        setText('ion-popup-colour', '—');
        setText('ion-popup-flame', '—');
        setText('ion-popup-hydroxide', '—');
        setText('ion-popup-ammonia', '—');
        setText('ion-popup-anion', '—');
        popup.style.display = 'flex';
        return;
    }
    setText('ion-popup-symbol', ion.symbol);
    setText('ion-popup-name', ion.name);
    setText('ion-popup-colour', ion.colour);
    setText('ion-popup-flame', ion.tests?.flame);
    setText('ion-popup-hydroxide', ion.tests?.hydroxide);
    setText('ion-popup-ammonia', ion.tests?.ammonia);
    const anionElem = document.getElementById('ion-popup-anion');
    if (anionElem) {
        if (ion.tests?.anionTests?.length > 0) anionElem.innerHTML = ion.tests.anionTests.map(test => `${test.reagent}: ${test.observation}`).join('<br>');
        else anionElem.textContent = '—';
    }
    popup.style.display = 'flex';
}

// ============================================
// EVENT LISTENERS FOR CONTROLS
// ============================================
const tempSlider = document.getElementById('temp-slider');
const tempDisplay = document.getElementById('temp-display');
if (tempSlider) {
    tempSlider.addEventListener('input', (e) => {
        currentTemperature = parseInt(e.target.value);
        tempDisplay.textContent = currentTemperature + '°C';
        updateAllStateSymbols();
        updateAllProductStates();
    });
}
const pressureSlider = document.getElementById('pressure-slider');
const pressureDisplay = document.getElementById('pressure-display');
if (pressureSlider) {
    pressureSlider.addEventListener('input', (e) => {
        currentPressure = parseInt(e.target.value);
        pressureDisplay.textContent = currentPressure + ' kPa';
    });
}
const atomBtn = document.getElementById('mode-atom');
const ionBtn = document.getElementById('mode-ion');
if (atomBtn && ionBtn) {
    atomBtn.addEventListener('click', () => {
        currentMode = 'atom';
        atomBtn.classList.add('active');
        ionBtn.classList.remove('active');
        document.body.classList.remove('ion-mode');
        updateAllStateSymbols();
    });
    ionBtn.addEventListener('click', () => {
        currentMode = 'ion';
        ionBtn.classList.add('active');
        atomBtn.classList.remove('active');
        document.body.classList.add('ion-mode');
        elementsData.forEach(el => { if (el.commonIons && el.commonIons.length > 0) ionIndexMap.set(el.atomicNumber, 0); });
        updateAllStateSymbols();
    });
}
const clearBtn = document.getElementById('clear-all');
if (clearBtn) {
    clearBtn.addEventListener('click', () => {
        currentTemperature = 25;
        if (tempSlider) tempSlider.value = 25;
        if (tempDisplay) tempDisplay.textContent = '25°C';
        currentPressure = 101;
        if (pressureSlider) pressureSlider.value = 101;
        if (pressureDisplay) pressureDisplay.textContent = '101 kPa';
        currentCatalyst = 'none';
        const catalystSelect = document.getElementById('catalyst-select');
        if (catalystSelect) catalystSelect.value = 'none';
        elementQuantities.clear();
        ionIndexMap.clear();
        paletteQuantities.clear();
        const wrapper = document.querySelector('.table-relative-wrapper');
        if (wrapper) wrapper.querySelectorAll('.product-card').forEach(c => c.remove());
        reactionLogEntries = [];
        const logContainer = document.getElementById('log-entries');
        if (logContainer) logContainer.innerHTML = '';
        renderPeriodicTable(elementsData);
        buildIonPalette();
        updateCardSize();
        positionOverlayControls();
    });
}
const catalystSelect = document.getElementById('catalyst-select');
if (catalystSelect) catalystSelect.addEventListener('change', (e) => { currentCatalyst = e.target.value; });
const backBtn = document.getElementById('back-to-table');
if (backBtn) backBtn.addEventListener('click', () => { window.location.hash = ''; });
// Close pop‑ups
document.addEventListener('click', (e) => {
    if (e.target.id === 'ion-popup-close') {
        const popup = document.getElementById('ion-popup');
        if (popup) popup.style.display = 'none';
    }
    if (e.target.id === 'product-popup-close') {
        const popup = document.getElementById('product-popup');
        if (popup) popup.style.display = 'none';
    }
});

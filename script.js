console.log('🚀 SparkChemWeb script v6.2 – ion log + no multiply');

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

// IGCSE Solubility Rules (fallback)
const solubilityRules = {
    alwaysSoluble: ['Na', 'K', 'NH4', 'NO3'],
    halides: { soluble: true, exceptions: ['Ag', 'Pb'] },
    sulfates: { soluble: true, exceptions: ['Ca', 'Ba', 'Pb'] },
    carbonates: { soluble: false },
    hydroxides: { soluble: false, exceptions: ['Na', 'K', 'Ca', 'NH4'] }
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
// OLD REACTION MAP (element+element only)
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
// COMPOUND CLASSIFICATION (water first, then other checks)
// ============================================
function classifyCompound(compound) {
    if (!compound) return null;
    const name = (compound.name || '').toLowerCase();
    const formulaLower = (compound.formula || compound.symbol || '').toLowerCase();
    if (name === 'water' || formulaLower === 'h2o' || formulaLower === 'h₂o') return 'water';
    if (/^(h₂|n₂|o₂|f₂|cl₂|br₂|i₂)$/.test(formulaLower) || name.includes('molecule')) {
        const elemSymbol = formulaLower.charAt(0).toUpperCase();
        if (['F','Cl','Br','I'].includes(elemSymbol)) return 'halogen';
        if (['H','N','O'].includes(elemSymbol)) return 'gas';
        return 'gas';
    }
    if (/^h[^2o]/.test(formulaLower) || name.includes('acid')) return 'acid';
    if (name.endsWith('hydroxide') || /oh/i.test(formulaLower)) return 'base';
    if (name.includes('carbonate') || /co3/i.test(formulaLower)) return 'carbonate';
    const rawFormula = compound.formula || compound.symbol || '';
    if (name.endsWith('oxide') || /^[A-Z][a-z]?[₀₁₂₃₄₅₆₇₈₉]*O[₀₁₂₃₄₅₆₇₈₉]*$/.test(rawFormula)) return 'oxide';
    return 'salt';
}

// ============================================
// getReactantCategory
// ============================================
function getReactantCategory(reactant) {
    if (!reactant) return null;
    if (reactant.atomicNumber) {
        const cat = reactant.category || '';
        if (/metal/.test(cat)) return 'metal';
        if (cat === 'halogen') return 'halogen';
        if (/nonmetal/.test(cat)) return 'nonmetal';
        if (cat === 'noble gas') return 'noble gas';
        if (cat === 'metalloid') return 'metalloid';
        return 'element';
    }
    return classifyCompound(reactant);
}

// ============================================
// REACTION PATTERNS (all order‑independent)
// ============================================
const reactionPatterns = [
    // 1. Acid + Base
    {
        reactantTypes: ['acid', 'base'],
        description: 'Neutralisation',
        generateProducts: (reactantA, reactantB) => {
            const catA = getReactantCategory(reactantA);
            const catB = getReactantCategory(reactantB);
            const acid = catA === 'acid' ? reactantA : reactantB;
            const base = catA === 'base' ? reactantA : reactantB;
            const acidAnion = getAnionFromAcid(acid);
            const baseCation = getCationFromBase(base);
            const saltFormula = buildIonicFormula(baseCation, acidAnion);
            const saltName = buildSaltName(baseCation, acidAnion);
            const saltSolubility = checkSolubility(baseCation.root, acidAnion.root, saltFormula);
            const balanced = `${acid.formula || acid.symbol} + ${base.formula || base.symbol} → ${saltFormula} + H₂O`;
            return [
                { symbol: saltFormula, name: saltName, formula: saltFormula, type: 'salt', isAqueous: saltSolubility, balanced },
                { symbol: 'H₂O', name: 'Water', formula: 'H₂O', type: 'water' }
            ];
        }
    },
    // 2. Metal + Acid
    {
        reactantTypes: ['metal', 'acid'],
        description: 'Metal + Acid',
        generateProducts: (reactantA, reactantB) => {
            const catA = getReactantCategory(reactantA);
            const catB = getReactantCategory(reactantB);
            const metal = catA === 'metal' ? reactantA : reactantB;
            const acid  = catA === 'acid'  ? reactantA : reactantB;
            const acidAnion = getAnionFromAcid(acid);
            const metalCation = {
                symbol: metal.symbol + (metal.oxidationStates ? superscriptNumber(Math.abs(metal.oxidationStates[0])) : '⁺'),
                charge: metal.oxidationStates ? Math.abs(metal.oxidationStates[0]) : 1,
                root: metal.symbol,
                name: metal.name
            };
            const saltFormula = buildIonicFormula(metalCation, acidAnion);
            const saltSolubility = checkSolubility(metalCation.root, acidAnion.root, saltFormula);
            const coeff = metalCation.charge / Math.abs(acidAnion.charge);
            const acidCoeff = (coeff > 1 ? coeff : '');
            const balanced = `${metal.symbol} + ${acidCoeff}${acid.formula || acid.symbol} → ${saltFormula} + H₂`;
            return [
                { symbol: saltFormula, name: buildSaltName(metalCation, acidAnion), formula: saltFormula, type: 'salt', isAqueous: saltSolubility, balanced },
                { symbol: 'H₂', name: 'Hydrogen', formula: 'H₂', type: 'gas' }
            ];
        }
    },
    // 3. Metal Oxide + Acid
    {
        reactantTypes: ['oxide', 'acid'],
        description: 'Metal Oxide + Acid',
        generateProducts: (reactantA, reactantB) => {
            const catA = getReactantCategory(reactantA);
            const catB = getReactantCategory(reactantB);
            const oxide = catA === 'oxide' ? reactantA : reactantB;
            const acid  = catA === 'acid'  ? reactantA : reactantB;
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
            const saltSolubility = checkSolubility(metalCation.root, acidAnion.root, saltFormula);
            const coeff = metalCation.charge / Math.abs(acidAnion.charge);
            const acidCoeff = (coeff > 1 ? coeff : '');
            const balanced = `${oxide.formula || oxide.symbol} + ${acidCoeff}${acid.formula || acid.symbol} → ${saltFormula} + H₂O`;
            return [
                { symbol: saltFormula, name: buildSaltName(metalCation, acidAnion), formula: saltFormula, type: 'salt', isAqueous: saltSolubility, balanced },
                { symbol: 'H₂O', name: 'Water', formula: 'H₂O', type: 'water' }
            ];
        }
    },
    // 4. Carbonate + Acid
    {
        reactantTypes: ['carbonate', 'acid'],
        description: 'Carbonate + Acid',
        generateProducts: (reactantA, reactantB) => {
            const catA = getReactantCategory(reactantA);
            const catB = getReactantCategory(reactantB);
            const carbonate = catA === 'carbonate' ? reactantA : reactantB;
            const acid      = catA === 'acid'      ? reactantA : reactantB;
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
            const saltSolubility = checkSolubility(metalCation.root, acidAnion.root, saltFormula);
            const coeff = 2 / Math.abs(acidAnion.charge);
            const acidCoeff = (coeff > 1 ? coeff : '');
            const balanced = `${carbonate.formula || carbonate.symbol} + ${acidCoeff}${acid.formula || acid.symbol} → ${saltFormula} + H₂O + CO₂`;
            return [
                { symbol: saltFormula, name: buildSaltName(metalCation, acidAnion), formula: saltFormula, type: 'salt', isAqueous: saltSolubility, balanced },
                { symbol: 'H₂O', name: 'Water', formula: 'H₂O', type: 'water' },
                { symbol: 'CO₂', name: 'Carbon dioxide', formula: 'CO₂', type: 'gas' }
            ];
        }
    },
    // 5. Metal + Water
    {
        reactantTypes: ['metal', 'water'],
        description: 'Metal + Water',
        generateProducts: (reactantA, reactantB) => {
            const catA = getReactantCategory(reactantA);
            const catB = getReactantCategory(reactantB);
            const metal = catA === 'metal' ? reactantA : reactantB;
            const water = catA === 'water' ? reactantA : reactantB;
            const reactiveMetals = ['K', 'Na', 'Ca', 'Mg', 'Al', 'Zn', 'Fe'];
            if (!reactiveMetals.includes(metal.symbol)) return null;
            if (currentTemperature >= 100) {
                const charge = metal.oxidationStates ? Math.abs(metal.oxidationStates[0]) : 1;
                const oxideFormula = buildIonicFormula(
                    { root: metal.symbol, charge, name: metal.name },
                    { root: 'O', charge: -2, name: 'Oxide', symbol: 'O²⁻' }
                );
                const balanced = `${metal.symbol} + H₂O → ${oxideFormula} + H₂`;
                return [
                    { symbol: oxideFormula, name: metal.name + ' oxide', formula: oxideFormula, type: 'oxide', balanced },
                    { symbol: 'H₂', name: 'Hydrogen', formula: 'H₂', type: 'gas' }
                ];
            } else {
                const charge = metal.oxidationStates ? Math.abs(metal.oxidationStates[0]) : 1;
                const hydroxideFormula = buildIonicFormula(
                    { root: metal.symbol, charge, name: metal.name },
                    { root: 'OH', charge: -1, name: 'Hydroxide', symbol: 'OH⁻' }
                );
                const hydroxideSolubility = checkSolubility(metal.symbol, 'OH', hydroxideFormula);
                const balanced = `${metal.symbol} + 2H₂O → ${hydroxideFormula} + H₂`;
                return [
                    { symbol: hydroxideFormula, name: metal.name + ' hydroxide', formula: hydroxideFormula, type: 'base', isAqueous: hydroxideSolubility, balanced },
                    { symbol: 'H₂', name: 'Hydrogen', formula: 'H₂', type: 'gas' }
                ];
            }
        }
    },
    // 6. Displacement (Metal + Salt)
    {
        reactantTypes: ['metal', 'salt'],
        description: 'Displacement',
        generateProducts: (reactantA, reactantB) => {
            const catA = getReactantCategory(reactantA);
            const catB = getReactantCategory(reactantB);
            const metal = catA === 'metal' ? reactantA : reactantB;
            const salt  = catA === 'salt'  ? reactantA : reactantB;
            const reactivity = ['K','Na','Ca','Mg','Al','Zn','Fe','Pb','Cu','Ag','Au'];
            if (!reactivity.includes(metal.symbol)) return null;
            const saltCation = getCationFromFormula(salt.formula);
            if (!saltCation) return null;
            const saltMetal = elementsData.find(el => el.symbol === saltCation);
            if (!saltMetal || !reactivity.includes(saltMetal.symbol)) return null;
            if (reactivity.indexOf(metal.symbol) >= reactivity.indexOf(saltMetal.symbol)) return null;
            const anion = getAnionFromFormula(salt.formula);
            const anionObj = getAnionFromAcid({ formula: 'H' + anion });
            const newSaltFormula = buildIonicFormula(
                { root: metal.symbol, charge: metal.oxidationStates ? Math.abs(metal.oxidationStates[0]) : 1, name: metal.name },
                anionObj
            );
            const newSaltSolubility = checkSolubility(metal.symbol, anionObj.root, newSaltFormula);
            const balanced = `${metal.symbol} + ${salt.formula || salt.symbol} → ${newSaltFormula} + ${saltMetal.symbol}`;
            return [
                { symbol: newSaltFormula, name: buildSaltName({ name: metal.name, root: metal.symbol }, anionObj), formula: newSaltFormula, type: 'salt', isAqueous: newSaltSolubility, balanced },
                { symbol: saltMetal.symbol, name: saltMetal.name, formula: saltMetal.symbol, type: 'metal' }
            ];
        }
    },
    // 7. Halogen Displacement
    {
        reactantTypes: ['halogen', 'salt'],
        description: 'Halogen Displacement',
        generateProducts: (reactantA, reactantB) => {
            const catA = getReactantCategory(reactantA);
            const catB = getReactantCategory(reactantB);
            const halogenReactant = catA === 'halogen' ? reactantA : reactantB;
            const saltReactant    = catA === 'salt'    ? reactantA : reactantB;
            if (halogenReactant.category !== 'halogen' || saltReactant.category !== 'salt') return null;
            const halogenReactivity = ['F','Cl','Br','I'];
            const halSymbol = (halogenReactant.symbol || '').replace(/[₂₃₄₅₆₇₈₉]/g, '');
            const saltHalogen = (getAnionFromFormula(saltReactant.formula) || '').replace(/[₂₃₄₅₆₇₈₉]/g, '');
            if (!saltHalogen || !halogenReactivity.includes(halSymbol) || !halogenReactivity.includes(saltHalogen)) return null;
            if (halogenReactivity.indexOf(halSymbol) >= halogenReactivity.indexOf(saltHalogen)) return null;
            const saltCation = getCationFromFormula(saltReactant.formula);
            const newSaltFormula = buildIonicFormula(
                { root: saltCation, charge: 1, name: saltCation },
                { root: halSymbol, charge: -1, name: halSymbol + 'ide', symbol: halSymbol + '⁻' }
            );
            const newSaltSolubility = checkSolubility(saltCation, halSymbol, newSaltFormula);
            const balanced = `${halSymbol}₂ + 2${saltReactant.formula || saltReactant.symbol} → 2${newSaltFormula} + ${saltHalogen}₂`;
            return [
                { symbol: newSaltFormula, name: saltCation + ' ' + halSymbol + 'ide', formula: newSaltFormula, type: 'salt', isAqueous: newSaltSolubility, balanced },
                { symbol: saltHalogen + '₂', name: saltHalogen, formula: saltHalogen + '₂', type: 'gas' }
            ];
        }
    },
    // 8. Precipitation
    {
        reactantTypes: ['salt', 'salt'],
        description: 'Precipitation',
        generateProducts: (saltA, saltB) => {
            const cationA = getCationFromFormula(saltA.formula);
            const anionA = getAnionFromFormula(saltA.formula);
            const cationB = getCationFromFormula(saltB.formula);
            const anionB = getAnionFromFormula(saltB.formula);
            if (!cationA || !anionA || !cationB || !anionB) return null;
            if ((cationA === cationB && anionA === anionB) || (cationA === cationB && anionB === anionA)) return null;
            const anionBObj = getAnionFromAcid({ formula: 'H' + anionB });
            const anionAObj = getAnionFromAcid({ formula: 'H' + anionA });
            const product1Formula = buildIonicFormula({ root: cationA, charge: 1, name: cationA }, anionBObj);
            const product2Formula = buildIonicFormula({ root: cationB, charge: 1, name: cationB }, anionAObj);
            const orig1 = saltA.formula;
            const orig2 = saltB.formula;
            if ((product1Formula === orig1 && product2Formula === orig2) || (product1Formula === orig2 && product2Formula === orig1)) return null;
            const sol1 = checkSolubility(cationA, anionB, product1Formula);
            const sol2 = checkSolubility(cationB, anionA, product2Formula);
            const balanced = `${saltA.formula || saltA.symbol} + ${saltB.formula || saltB.symbol} → ${product1Formula} + ${product2Formula}`;
            return [
                { symbol: product1Formula, name: cationA + ' ' + anionB + 'ide', formula: product1Formula, type: 'salt', isAqueous: sol1, balanced },
                { symbol: product2Formula, name: cationB + ' ' + anionA + 'ide', formula: product2Formula, type: 'salt', isAqueous: sol2 }
            ];
        }
    },
    // 9. Thermal Decomposition
    {
        reactantTypes: ['carbonate', null],
        description: 'Thermal Decomposition',
        singleReactant: true,
        generateProducts: (carbonate) => {
            if (carbonate.category !== 'carbonate') return null;
            const metalName = carbonate.name.replace(' carbonate', '').replace('(II)', '').replace('(III)', '').trim();
            const metalElement = elementsData.find(el => el.name.toLowerCase() === metalName.toLowerCase());
            if (!metalElement) return null;
            const oxideFormula = buildIonicFormula(
                { root: metalElement.symbol, charge: metalElement.oxidationStates ? Math.abs(metalElement.oxidationStates[0]) : 2, name: metalElement.name },
                { root: 'O', charge: -2, name: 'Oxide', symbol: 'O²⁻' }
            );
            const balanced = `${carbonate.symbol || carbonate.formula} → ${oxideFormula} + CO₂`;
            return [
                { symbol: oxideFormula, name: metalName + ' oxide', formula: oxideFormula, type: 'oxide', balanced },
                { symbol: 'CO₂', name: 'Carbon dioxide', formula: 'CO₂', type: 'gas' }
            ];
        }
    }
];

// ============================================
// HELPER FUNCTIONS
// ============================================
function getAnionFromAcid(acid) {
    const formula = acid.formula || acid.symbol || '';
    const withoutH = formula.replace(/^h/i, '');
    const decoded = decodeSubscript(withoutH);
    const rootDecoded = decoded.replace(/[₀₁₂₃₄₅₆₇₈₉]/g, '');
    const chargeMap = { 'Cl': -1, 'F': -1, 'Br': -1, 'I': -1, 'NO3': -1, 'SO4': -2, 'CO3': -2, 'PO4': -3 };
    const charge = chargeMap[rootDecoded] || -1;
    const originalRoot = withoutH.replace(/[⁺⁻²³⁴⁵⁶⁷⁸⁹⁰]/g, '');
    return {
        symbol: originalRoot + (charge === -1 ? '⁻' : charge === -2 ? '²⁻' : '³⁻'),
        charge,
        root: originalRoot,
        name: rootDecoded + (charge === -1 ? 'ide' : 'ate')
    };
}
function getCationFromBase(base) {
    const formula = base.formula || base.symbol || '';
    const ohMatch = formula.match(/\(OH\)[₀₁₂₃₄₅₆₇₈₉]*|OH[₀₁₂₃₄₅₆₇₈₉]*/i);
    let ohCount = 1;
    if (ohMatch) {
        const ohPart = ohMatch[0];
        const subMatch = ohPart.match(/[₀₁₂₃₄₅₆₇₈₉]+/);
        if (subMatch) {
            const decoded = decodeSubscript(subMatch[0]);
            ohCount = parseInt(decoded) || 1;
        }
    }
    const charge = ohCount;
    const cationRoot = formula.replace(/\(OH\)[₀₁₂₃₄₅₆₇₈₉]*|OH[₀₁₂₃₄₅₆₇₈₉]*/i, '').replace(/[₀₁₂₃₄₅₆₇₈₉]/g, '');
    const element = elementsData.find(el => el.symbol.toLowerCase() === cationRoot.toLowerCase());
    if (element) {
        return {
            symbol: element.symbol + superscriptNumber(charge) + '⁺',
            charge,
            root: element.symbol,
            name: element.name
        };
    }
    return { symbol: cationRoot + superscriptNumber(charge) + '⁺', charge, root: cationRoot, name: cationRoot };
}
function buildIonicFormula(cation, anion) {
    const cCharge = Math.abs(cation.charge);
    const aCharge = Math.abs(anion.charge);
    const g = gcd(cCharge, aCharge);
    const cSub = aCharge / g;
    const aSub = cCharge / g;
    let cationPart = cation.root;
    if (cSub > 1) cationPart += subscriptNumber(cSub);
    let anionPart = anion.root;
    if (aSub > 1) {
        const cleanRoot = anion.root.replace(/[₀₁₂₃₄₅₆₇₈₉]/g, '');
        if (!/^[A-Z][a-z]?$/.test(cleanRoot)) {
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
// STATE DETERMINATION (JSON‑powered solubility)
// ============================================
function getProductState(product, temp, isAqueous = false) {
    if (isAqueous) {
        const formula = product.formula || product.symbol || '';
        if (formula === 'H₂O') return temp < 0 ? 's' : temp >= 100 ? 'g' : 'l';
        return 'aq';
    }
    const formula = product.formula || product.symbol || '';
    const props = compoundsData.find(c => c.formula === formula);
    if (props && props.meltingPoint !== undefined && props.boilingPoint !== undefined && props.boilingPoint !== null) {
        if (temp < props.meltingPoint) return 's';
        if (temp < props.boilingPoint) return 'l';
        return 'g';
    }
    if (product.meltingPoint !== undefined && product.boilingPoint !== undefined && product.boilingPoint !== null) {
        if (temp < product.meltingPoint) return 's';
        if (temp >= product.meltingPoint && temp < product.boilingPoint) return 'l';
        return 'g';
    }
    const cation = getCationFromFormula(formula);
    const anion = getAnionFromFormula(formula);
    if (cation && anion) return checkSolubility(cation, anion, formula) ? 'aq' : 's';
    if (product.type === 'gas') return 'g';
    if (product.type === 'water') return temp < 0 ? 's' : temp >= 100 ? 'g' : 'l';
    return 's';
}
function getCationFromFormula(formula) {
    const m = formula.match(/^([A-Z][a-z]?)/);
    return m ? m[1] : null;
}
function getAnionFromFormula(formula) {
    const decoded = decodeSubscript(formula);
    const cationMatch = decoded.match(/^[A-Z][a-z]?\d*/);
    if (!cationMatch) return null;
    const anionPart = decoded.slice(cationMatch[0].length);
    return anionPart.replace(/[()\d]/g, '');
}
function checkSolubility(cation, anion, formula = null) {
    if (formula) {
        const compound = compoundsData.find(c => c.formula === formula);
        if (compound && compound.soluble !== undefined) return compound.soluble;
    }
    const decodedCation = decodeSubscript(cation).replace(/[⁺⁻²³⁴⁵⁶⁷⁸⁹⁰₀₁₂₃₄₅₆₇₈₉]/g, '');
    const decodedAnion  = decodeSubscript(anion).replace(/[⁺⁻²³⁴⁵⁶⁷⁸⁹⁰₀₁₂₃₄₅₆₇₈₉]/g, '');
    if (solubilityRules.alwaysSoluble.includes(decodedCation) || solubilityRules.alwaysSoluble.includes(decodedAnion)) return true;
    if (decodedAnion === 'Cl' || decodedAnion === 'Br' || decodedAnion === 'I') return !solubilityRules.halides.exceptions.includes(decodedCation);
    if (decodedAnion === 'SO4') return !solubilityRules.sulfates.exceptions.includes(decodedCation);
    if (decodedAnion === 'CO3') return false;
    if (decodedAnion === 'OH') return solubilityRules.hydroxides.exceptions && solubilityRules.hydroxides.exceptions.includes(decodedCation);
    return true;
}
function updateAllProductStates() {
    document.querySelectorAll('.product-card').forEach(card => {
        const product = JSON.parse(card.dataset.product || '{}');
        const state = getProductState(product, currentTemperature, product.isAqueous === true);
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
// PRODUCT COLOUR CLASS
// ============================================
function getProductClass(product) {
    const formula = product.formula || product.symbol || '';
    if (formula === 'H₂O') return 'prod-water';
    if (product.type === 'gas') return 'prod-gas';
    const category = classifyCompound({ name: product.name, formula: formula });
    if (category === 'oxide') return 'prod-oxide';
    const comp = compoundsData.find(c => c.formula === formula);
    if (comp && comp.boilingPoint !== null && comp.boilingPoint < 25) return 'prod-molecular';
    if (product.type === 'salt' || product.type === 'base' || product.type === 'carbonate' || product.type === 'ionic') return 'prod-ionic';
    return 'prod-ionic';
}

// ============================================
// DRAG HOVER HIGHLIGHT HELPERS
// ============================================
function addDragHoverHandlers(el) {
    el.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        el.classList.add('drag-hover');
    });
    el.addEventListener('dragleave', () => {
        el.classList.remove('drag-hover');
    });
    el.addEventListener('drop', () => {
        el.classList.remove('drag-hover');
    });
}

// ============================================
// FETCH & SETUP
// ============================================
fetch('data/elements.json')
    .then(response => { if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`); return response.json(); })
    .then(data => { elementsData = data; return fetch('data/ion.json'); })
    .then(response => { if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`); return response.json(); })
    .then(ionJson => { ionData = ionJson; return fetch('data/compounds.json'); })
    .then(response => { if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`); return response.json(); })
    .then(compoundsJson => {
        compoundsData = compoundsJson;
        renderPeriodicTable(elementsData);
        buildIonPalette();
        updateCardSize();
        window.addEventListener('hashchange', router);
        router();
        positionOverlayControls();
        window.addEventListener('resize', () => { positionOverlayControls(); updateCardSize(); });

        // Start tutorial only after rendering is complete
        if (!localStorage.getItem('sparkchemweb-tutorial-seen')) {
            setTimeout(startTutorial, 300);
        }
    })
    .catch(error => {
        console.error('Error loading data:', error);
        document.getElementById('periodic-table').innerHTML = '<p style="color: red;">Failed to load data. Check console.</p>';
    });

// ============================================
// HELPER: Determine state based on temperature (for elements)
// ============================================
function getState(element, temp) {
    const mp = element.meltingPoint, bp = element.boilingPoint;
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
        addDragHoverHandlers(card);
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
        // ---------- Block context menu ----------
        card.addEventListener('contextmenu', (e) => e.preventDefault());
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
        productA = {
            symbol: dragData.symbol, name: dragData.name, formula: dragData.formula,
            balanced: dragData.balanced || '', quantity: dragData.quantity || 1,
            category: dragData.category || classifyCompound({ name: dragData.name, formula: dragData.formula })
        };
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
        productB = {
            symbol: targetElementOrIon.dataset.symbol, name: targetElementOrIon.dataset.name,
            formula: targetElementOrIon.dataset.formula, balanced: targetElementOrIon.dataset.balanced || '',
            quantity: parseInt(targetElementOrIon.dataset.quantity) || 1,
            category: targetElementOrIon.dataset.category || classifyCompound({ name: targetElementOrIon.dataset.name, formula: targetElementOrIon.dataset.formula })
        };
    }

    const normalizeSymbol = (sym) => sym.replace(/[₂₃₄₅₆₇₈₉]/g, '');
    let result = null;

    // Diatomic combination – only allowed in atom mode
    if (currentMode !== 'ion' && reactantA && reactantB && reactantA.atomicNumber && reactantB.atomicNumber && reactantA.symbol === reactantB.symbol) {
        const diatomicList = ['H', 'N', 'O', 'F', 'Cl', 'Br', 'I'];
        if (diatomicList.includes(reactantA.symbol)) {
            const diatomicSymbol = reactantA.symbol + '₂';
            const compound = compoundsData.find(c => c.formula === diatomicSymbol);
            result = {
                products: [{ symbol: diatomicSymbol, name: compound?.name || reactantA.name + ' molecule', formula: diatomicSymbol, type: 'gas', balanced: `2${reactantA.symbol} → ${diatomicSymbol}`, isAqueous: false }],
                type: 'direct combination'
            };
        }
    }

    // Self‑drop for single‑reactant patterns
    if (!result && targetElementOrIon && targetElementOrIon.dataset && dragData.symbol === targetElementOrIon.dataset.symbol &&
        dragData.formula === targetElementOrIon.dataset.formula) {
        const singlePattern = reactionPatterns.find(p => p.singleReactant && p.reactantTypes[0] === (productA?.category || classifyCompound(productA)));
        if (singlePattern && currentTemperature > 200) {
            const products = singlePattern.generateProducts(productA);
            if (products) {
                result = {
                    products: products.map(p => ({ ...p, quantity: 1 })),
                    type: singlePattern.description,
                    isDecomposition: true
                };
            }
        }
    }

    if (!result) {
        if (ionA && ionB) {
            result = reactIons(ionA, ionB);
        } else if ((reactantA || productA) && (reactantB || productB)) {
            const symA = reactantA ? normalizeSymbol(reactantA.symbol) : normalizeSymbol(productA.symbol);
            const symB = reactantB ? normalizeSymbol(reactantB.symbol) : normalizeSymbol(productB.symbol);
            const key1 = symA + '+' + symB, key2 = symB + '+' + symA;
            const reaction = reactionMap[key1] || reactionMap[key2];
            if (reaction) {
                result = { products: [{ ...reaction, quantity: 1 }], type: reaction.type };
            } else {
                const catA = getReactantCategory(reactantA || productA);
                const catB = getReactantCategory(reactantB || productB);
                if (catA && catB) {
                    let pattern = reactionPatterns.find(p =>
                        (p.reactantTypes[0] === catA && p.reactantTypes[1] === catB) ||
                        (p.reactantTypes[0] === catB && p.reactantTypes[1] === catA)
                    );
                    if (!pattern && ((catA === 'metal' && catB === 'water') || (catB === 'metal' && catA === 'water'))) {
                        pattern = reactionPatterns.find(p => p.reactantTypes[0] === 'metal' && p.reactantTypes[1] === 'water');
                    }
                    if (pattern) {
                        const objA = reactantA || { name: productA.name, formula: productA.formula, category: productA.category, symbol: productA.symbol, oxidationStates: [] };
                        const objB = reactantB || { name: productB.name, formula: productB.formula, category: productB.category, symbol: productB.symbol, oxidationStates: [] };
                        if (catA === 'metal' && !objA.symbol && productA) { const c = getCationFromFormula(productA.formula); if (c) objA.symbol = c; }
                        if (catB === 'metal' && !objB.symbol && productB) { const c = getCationFromFormula(productB.formula); if (c) objB.symbol = c; }
                        const products = pattern.generateProducts(objA, objB);
                        if (products) {
                            result = { products: products.map(p => ({ ...p, quantity: 1 })), type: pattern.description };
                            if (window.__tutorialCheckNeutralisation && pattern.description === 'Neutralisation') {
                                const acidFormula = (reactantA || productA).formula || (reactantA || productA).symbol;
                                const baseFormula = (reactantB || productB).formula || (reactantB || productB).symbol;
                                if ((acidFormula === 'HCl' && baseFormula === 'NaOH') || (acidFormula === 'NaOH' && baseFormula === 'HCl')) {
                                    window.__tutorialCheckNeutralisation();
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if (result) {
        const wrapper = document.querySelector('.table-relative-wrapper');
        const rect = wrapper.getBoundingClientRect();
        result.products.forEach(prod => {
            prod.reactionType = result.type;
            const x = event.clientX - rect.left - 40 + Math.random() * 20;
            const y = event.clientY - rect.top - 40 + Math.random() * 20;
            createProductCard(prod, x, y);
        });
        if (result.isDecomposition) {
            logReaction(result.products[0], result.type, productA, null);
        } else {
            const aStr = reactantA || ionA || productA;
            const bStr = reactantB || ionB || productB;
            logReaction(result.products[0], result.type, aStr, bStr);
        }
    } else {
        // Show ion symbols when possible for better no-reaction logs
        const aSym = ionA ? ionA.symbol : (reactantA ? reactantA.symbol : (productA ? productA.symbol : '?'));
        const bSym = ionB ? ionB.symbol : (reactantB ? reactantB.symbol : (productB ? productB.symbol : '?'));
        logNoReaction({ symbol: aSym }, { symbol: bSym });
    }
}

// ============================================
// ION REACTION ENGINE (with proper naming)
// ============================================
function getAnionNameFromElement(symbol) {
    const nameMap = {
        'F': 'fluoride', 'Cl': 'chloride', 'Br': 'bromide', 'I': 'iodide',
        'O': 'oxide', 'S': 'sulfide', 'N': 'nitride', 'P': 'phosphide',
        'C': 'carbide', 'H': 'hydride'
    };
    return nameMap[symbol] || (symbol + 'ide');
}
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
        const cleanRoot = anion.root.replace(/[₀₁₂₃₄₅₆₇₈₉]/g, '');
        if (!/^[A-Z][a-z]?$/.test(cleanRoot)) {
            anionPart = '(' + anion.root + ')' + subscriptNumber(anionSubscript);
        } else {
            anionPart += subscriptNumber(anionSubscript);
        }
    }
    formula += anionPart;
    let anionName = anion.name;
    if (anion.root && anion.root.length <= 2 && /^[A-Z][a-z]?$/.test(anionRoot)) {
        anionName = getAnionNameFromElement(anionRoot);
    } else if (anionName === anionRoot) {
        anionName = anionRoot;
    }
    let name = cation.name + ' ' + anionName.toLowerCase();
    if (formula === 'HOH') { formula = 'H₂O'; name = 'Water'; }
    const isAqueous = checkSolubility(cationRoot, anionRoot, formula);
    let balanced = '';
    if (cationSubscript > 1) balanced += cationSubscript;
    balanced += cation.symbol + ' + ';
    if (anionSubscript > 1) balanced += anionSubscript;
    balanced += anion.symbol + ' → ' + formula;
    return { products: [{ symbol: formula, name, formula, type: 'ionic', balanced, isAqueous }], type: 'ionic' };
}

// ============================================
// UPDATE CARD SIZE
// ============================================
function updateCardSize() {
    const hCard = document.querySelector('.element-card[data-symbol="H"]');
    if (hCard) cardSize = hCard.offsetWidth;
    document.querySelectorAll('.product-card').forEach(card => { card.style.width = cardSize + 'px'; card.style.height = cardSize + 'px'; });
    document.querySelectorAll('.palette-card').forEach(card => { card.style.width = cardSize + 'px'; card.style.height = cardSize + 'px'; });
}

// ============================================
// BUILD POLYATOMIC ION PALETTE (flex layout, no title)
// ============================================
function buildIonPalette() {
    const grid = document.getElementById('palette-grid');
    if (!grid) return;
    grid.innerHTML = '';

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

        card.style.width = cardSize + 'px';
        card.style.height = cardSize + 'px';

        card.draggable = true;
        addDragHoverHandlers(card);
        card.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('application/json', JSON.stringify({
                symbol: ion.symbol,
                charge: ion.charge,
                name: ion.name,
                quantity: paletteQuantities.get(ion.symbol) || 1
            }));
            e.dataTransfer.effectAllowed = 'move';
        });
        card.addEventListener('dragover', (e) => { e.preventDefault(); });
        card.addEventListener('drop', (e) => {
            e.preventDefault();
            const rawData = e.dataTransfer.getData('application/json');
            if (!rawData) return;
            const dragData = JSON.parse(rawData);
            handleReaction(dragData, e, {
                symbol: ion.symbol,
                charge: ion.charge,
                name: ion.name,
                root: ion.root
            });
        });
        // Block context menu
        card.addEventListener('contextmenu', (e) => e.preventDefault());
        grid.appendChild(card);
    });
}

// ============================================
// CREATE PRODUCT CARD (with colour class and touch grip support)
// ============================================
function createProductCard(product, initialX, initialY) {
    const card = document.createElement('div');
    card.className = 'product-card';
    const colourClass = getProductClass(product);
    card.classList.add(colourClass);

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
    card.dataset.product = JSON.stringify(product);
    card.style.width = cardSize + 'px';
    card.style.height = cardSize + 'px';
    if (product.quantity > 1) {
        const badge = document.createElement('span');
        badge.className = 'quantity-badge';
        badge.textContent = product.quantity;
        card.appendChild(badge);
    }
    const grip = document.createElement('div');
    grip.className = 'grip-handle';
    grip.title = 'Drag to move';
    card.appendChild(grip);
    let dragState = { isDragging: false, startX: 0, startY: 0, left: 0, top: 0 };

    // ---- MOUSE grip handlers ----
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

    // ---- TOUCH grip handlers ----
    grip.addEventListener('touchstart', (e) => {
        e.stopPropagation();
        const touch = e.changedTouches[0];
        dragState.isDragging = true;
        dragState.startX = touch.clientX;
        dragState.startY = touch.clientY;
        dragState.left = card.offsetLeft;
        dragState.top = card.offsetTop;
        card.style.cursor = 'grabbing';
        e.preventDefault();
    }, { passive: false });
    grip.addEventListener('touchmove', (e) => {
        if (!dragState.isDragging) return;
        e.preventDefault();
        const touch = e.changedTouches[0];
        const dx = touch.clientX - dragState.startX;
        const dy = touch.clientY - dragState.startY;
        card.style.left = (dragState.left + dx) + 'px';
        card.style.top = (dragState.top + dy) + 'px';
    }, { passive: false });
    grip.addEventListener('touchend', () => {
        dragState.isDragging = false;
        card.style.cursor = '';
    });

    // ---- Append card to wrapper ----
    const wrapper = document.querySelector('.table-relative-wrapper');
    card.style.left = initialX + 'px';
    card.style.top = initialY + 'px';
    wrapper.appendChild(card);

    // ---- Info button ----
    const infoBtn = document.createElement('span');
    infoBtn.className = 'info-btn';
    infoBtn.textContent = 'ⓘ';
    infoBtn.title = 'Product details';
    infoBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showProductDetail(card);
    });
    card.appendChild(infoBtn);

    // ---- Drag‑to‑react (card itself) ----
    card.draggable = true;
    addDragHoverHandlers(card);
    card.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('application/json', JSON.stringify({
            symbol: product.symbol, name: product.name, formula: product.formula,
            quantity: product.quantity || 1, balanced: product.balanced || '', category: card.dataset.category
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

    // Block context menu
    card.addEventListener('contextmenu', (e) => e.preventDefault());

    return card;
}

// ============================================
// SHOW PRODUCT DETAIL POP‑UP  (with tutorial hook)
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

    if (window.__tutorialCheckProductInfo) {
        window.__tutorialCheckProductInfo();
    }
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
    let balanced;
    if (b === null) {
        balanced = product.balanced || `${a.symbol || a.formula} → ${product.symbol}`;
    } else {
        balanced = product.balanced || `${a?.symbol || a?.root} + ${b?.symbol || b?.root} → ${product.symbol}`;
    }
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
// POSITION OVERLAY CONTROLS – unified wrapper
// ============================================
function positionOverlayControls() {
    const hCard = document.querySelector('.element-card[data-symbol="H"]');
    const heCard = document.querySelector('.element-card[data-symbol="He"]');
    const overlay = document.getElementById('conditions-overlay');
    if (!hCard || !heCard || !overlay) return;

    const container = document.querySelector('.table-relative-wrapper');
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const hRect = hCard.getBoundingClientRect();
    const heRect = heCard.getBoundingClientRect();

    const GAP = 10;
    const left = hRect.right - containerRect.left + GAP;
    const right = heRect.left - containerRect.left - GAP;

    overlay.style.left = left + 'px';
    overlay.style.right = (containerRect.width - right) + 'px';
    overlay.style.top = (hRect.top - containerRect.top) + 'px';
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
    window.location.hash = '';
}
function showDetailView() {
    tableViewContainer.style.display = 'none';
    detailView.style.display = 'block';
    const logOverlay = document.getElementById('log-overlay');
    const ionsOverlay = document.getElementById('ions-overlay');
    if (logOverlay) logOverlay.style.display = 'none';
    if (ionsOverlay) ionsOverlay.style.display = 'none';
    document.querySelectorAll('#toggle-log, #toggle-ions').forEach(btn => btn.classList.remove('active'));
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

        // Hide overlays and reset their toggle buttons
        const logOverlay = document.getElementById('log-overlay');
        const ionsOverlay = document.getElementById('ions-overlay');
        if (logOverlay) logOverlay.style.display = 'none';
        if (ionsOverlay) ionsOverlay.style.display = 'none';
        document.querySelectorAll('#toggle-log, #toggle-ions').forEach(btn => btn.classList.remove('active'));
    });
}
const catalystSelect = document.getElementById('catalyst-select');
if (catalystSelect) catalystSelect.addEventListener('change', (e) => { currentCatalyst = e.target.value; });
const backBtn = document.getElementById('back-to-table');
if (backBtn) backBtn.addEventListener('click', () => { window.location.hash = ''; });

// ============================================
// OVERLAY TOGGLE (Log & Ions)
// ============================================
const logOverlay = document.getElementById('log-overlay');
const ionsOverlay = document.getElementById('ions-overlay');
const toggleLogBtn = document.getElementById('toggle-log');
const toggleIonsBtn = document.getElementById('toggle-ions');

function toggleOverlay(overlay, btn) {
    if (overlay.style.display === 'none' || overlay.style.display === '') {
        overlay.style.display = 'block';
        if (btn) btn.classList.add('active');
    } else {
        overlay.style.display = 'none';
        if (btn) btn.classList.remove('active');
    }
}

if (toggleLogBtn) toggleLogBtn.addEventListener('click', () => toggleOverlay(logOverlay, toggleLogBtn));
if (toggleIonsBtn) toggleIonsBtn.addEventListener('click', () => toggleOverlay(ionsOverlay, toggleIonsBtn));

document.querySelectorAll('.overlay-close').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const overlayId = e.target.getAttribute('data-overlay');
        const overlay = document.getElementById(overlayId);
        if (overlay) {
            overlay.style.display = 'none';
            if (overlayId === 'log-overlay' && toggleLogBtn) toggleLogBtn.classList.remove('active');
            if (overlayId === 'ions-overlay' && toggleIonsBtn) toggleIonsBtn.classList.remove('active');
        }
    });
});

// Close pop‑ups (with tutorial hooks)
document.addEventListener('click', (e) => {
    if (e.target.id === 'product-popup-close') {
        const popup = document.getElementById('product-popup');
        if (popup) {
            popup.style.display = 'none';
            if (window.__tutorialCheckProductInfoClosed) {
                window.__tutorialCheckProductInfoClosed();
            }
        }
    }
    if (e.target.classList.contains('product-popup')) {
        const popup = document.getElementById('product-popup');
        if (popup) {
            popup.style.display = 'none';
            if (window.__tutorialCheckProductInfoClosed) {
                window.__tutorialCheckProductInfoClosed();
            }
        }
    }
    if (e.target.id === 'ion-popup-close') {
        const popup = document.getElementById('ion-popup');
        if (popup) popup.style.display = 'none';
    }
});

// ============================================
// INTERACTIVE TUTORIAL  (v5.2)
// ============================================
const tutorialOverlay = document.getElementById('tutorial-overlay');
const tutorialTitle = document.getElementById('tutorial-title');
const tutorialDesc = document.getElementById('tutorial-description');
const tutorialNextBtn = document.getElementById('tutorial-next');
const tutorialSkipBtn = document.getElementById('tutorial-skip');
const helpBtn = document.getElementById('help-btn');

let tutorialActive = false;
let currentTutorialStep = 0;
let tutorialListeners = [];

const tutorialSteps = [
    {   // step 0
        title: 'Step 1: View an element’s details',
        description: 'Click on the element <b>Hydrogen (H)</b> to see its properties.',
        highlightSelector: '.element-card[data-symbol="H"]',
        autoAdvance: true,
        advanceOn: 'hash-element-1'
    },
    {   // step 1
        title: 'Step 2: Go back to the table',
        description: 'Click the <b>← Back to Table</b> button to return to the main view.',
        highlightSelector: '#back-to-table',
        autoAdvance: true,
        advanceOn: 'back-to-table'
    },
    {   // step 2
        title: 'Step 3: Make water!',
        description: 'Drag <b>Hydrogen (H)</b> onto <b>Oxygen (O)</b> to form water (H₂O).',
        highlightSelector: '.element-card[data-symbol="H"], .element-card[data-symbol="O"]',
        autoAdvance: true,
        advanceOn: 'water-created'
    },
    {   // step 3
        title: 'Step 4: Move the product card',
        description: 'Grab the small handle (top‑left corner of the H₂O card) and drag it to reposition the molecule. (Click Next when you’ve tried it.)',
        highlightSelector: '.product-card[data-symbol="H₂O"] .grip-handle',
        autoAdvance: false
    },
    {   // step 4
        title: 'Step 5: Product info',
        description: 'Click the <b>ⓘ</b> button on the H₂O card to see detailed information about water.',
        highlightSelector: '.product-card[data-symbol="H₂O"] .info-btn',
        autoAdvance: true,
        advanceOn: 'product-info-opened'
    },
    {   // step 5 – close info popup
        title: 'Step 6: Close the info popup',
        description: 'Click the <b>✕</b> button (or outside the popup) to close the product info.',
        highlightSelector: '#product-popup-close',
        autoAdvance: true,
        advanceOn: 'product-info-closed'
    },
    {   // step 6
        title: 'Step 7: Control the conditions',
        description: 'Use the <b>Temperature</b> and <b>Pressure</b> sliders and the <b>Catalyst</b> dropdown to change reaction conditions. (Click Next to continue.)',
        highlightSelector: '#conditions-overlay',
        autoAdvance: false
    },
    {   // step 7
        title: 'Step 8: Switch to ion mode',
        description: 'Click the <b>Ion</b> button (top left) to work with charged ions.',
        highlightSelector: '#mode-ion',
        autoAdvance: true,
        advanceOn: 'ion-mode'
    },
    {   // step 8 – form HCl from H⁺ + Cl⁻
        title: 'Step 9: Form HCl',
        description: 'Click <b>H</b> to cycle to H⁺, click <b>Cl</b> to Cl⁻, then drag one onto the other to form HCl.',
        highlightSelector: '.element-card[data-symbol="H"], .element-card[data-symbol="Cl"]',
        autoAdvance: true,
        advanceOn: 'HCl-created'
    },
    {   // step 9 – open Common Ions palette
        title: 'Step 10: Open the Common Ions palette',
        description: 'Click the <b>⚛️ Ions</b> button to open the polyatomic ion palette. (Click Next when ready.)',
        highlightSelector: '#toggle-ions',
        autoAdvance: false
    },
    {   // step 10 – form NaOH from Na⁺ + OH⁻
        title: 'Step 11: Make NaOH',
        description: 'Drag <b>Na⁺</b> (click Na if needed) onto <b>OH⁻</b> from the palette to form NaOH.',
        highlightSelector: '.element-card[data-symbol="Na"], .palette-card[data-symbol="OH⁻"]',
        autoAdvance: true,
        advanceOn: 'NaOH-created'
    },
    {   // step 11 – combine HCl + NaOH
        title: 'Step 12: Neutralise!',
        description: 'Drag the <b>HCl</b> card onto the <b>NaOH</b> card (by their body, not the grip handle) to see them react.',
        highlightSelector: '.product-card[data-symbol="HCl"], .product-card[data-symbol="NaOH"]',
        autoAdvance: true,
        advanceOn: 'neutralisation'
    },
    {   // step 12 – open Reaction Log
        title: 'Step 13: View the Reaction Log',
        description: 'Click the <b>📋 Log</b> button to see the balanced equation and conditions. (Click Next when done.)',
        highlightSelector: '#toggle-log',
        autoAdvance: false
    },
    {   // step 13 – clear all
        title: 'Step 14: Clear the table',
        description: 'Click <b>Clear All</b> to reset everything.',
        highlightSelector: '#clear-all',
        autoAdvance: true,
        advanceOn: 'clear-all'
    }
];

function highlightElements(selector) {
    if (!selector) return;
    const elements = document.querySelectorAll(selector);
    elements.forEach(el => el.classList.add('tutorial-highlight'));
    if (elements.length > 0) {
        elements[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function removeAllHighlights() {
    document.querySelectorAll('.tutorial-highlight').forEach(el => el.classList.remove('tutorial-highlight'));
}

function cleanupListeners() {
    tutorialListeners.forEach(fn => fn());
    tutorialListeners = [];
}

function setTutorialStep(stepIndex) {
    if (stepIndex >= tutorialSteps.length) {
        endTutorial();
        return;
    }
    currentTutorialStep = stepIndex;
    const step = tutorialSteps[stepIndex];
    tutorialTitle.textContent = step.title;
    tutorialDesc.innerHTML = step.description;
    tutorialNextBtn.style.display = step.autoAdvance ? 'none' : 'inline-block';

    removeAllHighlights();
    highlightElements(step.highlightSelector);

    cleanupListeners();

    if (step.autoAdvance) {
        if (step.advanceOn === 'hash-element-1') {
            const handler = () => {
                if (window.location.hash === '#element/1') {
                    nextStep();
                }
            };
            window.addEventListener('hashchange', handler);
            tutorialListeners.push(() => window.removeEventListener('hashchange', handler));
        }
        else if (step.advanceOn === 'back-to-table') {
            const backBtn = document.getElementById('back-to-table');
            const handler = () => {
                setTimeout(nextStep, 100);
            };
            if (backBtn) {
                backBtn.addEventListener('click', handler);
                tutorialListeners.push(() => backBtn.removeEventListener('click', handler));
            }
        }
        else if (step.advanceOn === 'water-created') {
            window.__tutorialCheckWater = (productSymbol) => {
                if (productSymbol === 'H₂O' && currentTutorialStep === 2) {
                    nextStep();
                }
            };
            tutorialListeners.push(() => { delete window.__tutorialCheckWater; });
        }
        else if (step.advanceOn === 'product-info-opened') {
            window.__tutorialCheckProductInfo = () => {
                if (currentTutorialStep === 4) {
                    nextStep();
                }
            };
            tutorialListeners.push(() => { delete window.__tutorialCheckProductInfo; });
        }
        else if (step.advanceOn === 'product-info-closed') {
            window.__tutorialCheckProductInfoClosed = () => {
                if (currentTutorialStep === 5) {
                    nextStep();
                }
            };
            tutorialListeners.push(() => { delete window.__tutorialCheckProductInfoClosed; });
        }
        else if (step.advanceOn === 'ion-mode') {
            const handler = () => {
                if (currentMode === 'ion') {
                    nextStep();
                }
            };
            const ionBtn = document.getElementById('mode-ion');
            if (ionBtn) {
                ionBtn.addEventListener('click', handler);
                tutorialListeners.push(() => ionBtn.removeEventListener('click', handler));
            }
            if (currentMode === 'ion') {
                nextStep();
            }
        }
        else if (step.advanceOn === 'HCl-created') {
            window.__tutorialCheckHCl = (productSymbol) => {
                if (productSymbol === 'HCl' && currentTutorialStep === 8) {
                    nextStep();
                }
            };
            tutorialListeners.push(() => { delete window.__tutorialCheckHCl; });
        }
        else if (step.advanceOn === 'NaOH-created') {
            window.__tutorialCheckNaOH = (productSymbol) => {
                if (productSymbol === 'NaOH' && currentTutorialStep === 10) {
                    nextStep();
                }
            };
            tutorialListeners.push(() => { delete window.__tutorialCheckNaOH; });
        }
        else if (step.advanceOn === 'neutralisation') {
            window.__tutorialCheckNeutralisation = () => {
                if (currentTutorialStep === 11) {
                    nextStep();
                }
            };
            tutorialListeners.push(() => { delete window.__tutorialCheckNeutralisation; });
        }
        else if (step.advanceOn === 'clear-all') {
            const clearBtn = document.getElementById('clear-all');
            const handler = () => {
                nextStep();
            };
            if (clearBtn) {
                clearBtn.addEventListener('click', handler);
                tutorialListeners.push(() => clearBtn.removeEventListener('click', handler));
            }
        }
    }
}

function nextStep() {
    cleanupListeners();
    removeAllHighlights();
    setTutorialStep(currentTutorialStep + 1);
}

function startTutorial() {
    if (tutorialActive) return;
    tutorialActive = true;
    tutorialOverlay.style.display = 'flex';
    void tutorialOverlay.offsetWidth;
    tutorialOverlay.classList.add('show');
    setTutorialStep(0);
}

function endTutorial() {
    tutorialActive = false;
    cleanupListeners();
    removeAllHighlights();
    tutorialOverlay.classList.remove('show');
    setTimeout(() => {
        tutorialOverlay.style.display = 'none';
    }, 300);
    localStorage.setItem('sparkchemweb-tutorial-seen', 'true');
}

if (helpBtn) {
    helpBtn.addEventListener('click', startTutorial);
}

if (tutorialNextBtn) {
    tutorialNextBtn.addEventListener('click', nextStep);
}

if (tutorialSkipBtn) {
    tutorialSkipBtn.addEventListener('click', endTutorial);
}

// Auto‑start tutorial is now inside the fetch chain (after render)

// Monkey‑patch createProductCard to detect specific products for tutorial
const originalCreateProductCard = createProductCard;
createProductCard = function(product, initialX, initialY) {
    const card = originalCreateProductCard(product, initialX, initialY);
    if (window.__tutorialCheckWater && product.symbol === 'H₂O') {
        window.__tutorialCheckWater(product.symbol);
    }
    if (window.__tutorialCheckHCl && (product.symbol === 'HCl' || product.formula === 'HCl')) {
        window.__tutorialCheckHCl(product.symbol);
    }
    if (window.__tutorialCheckNaOH && (product.symbol === 'NaOH' || product.formula === 'NaOH')) {
        window.__tutorialCheckNaOH(product.symbol);
    }
    return card;
};

// ============================================
// TOUCH DRAG‑AND‑DROP SUPPORT (tap‑friendly, no self‑drop on tap)
// ============================================
let touchDragData = null;
let touchGhost = null;
let touchStartX = 0, touchStartY = 0;
let touchStarted = false;        // true once we pass the move threshold
const DRAG_THRESHOLD = 5;        // px – finger must move this far to start a drag

function enableTouchDrag() {
    document.addEventListener('touchstart', onTouchStart, { passive: false });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);
    document.addEventListener('touchcancel', onTouchEnd);
}

function onTouchStart(e) {
    const touch = e.changedTouches[0];
    const target = document.elementFromPoint(touch.clientX, touch.clientY);

    // Don't interfere with info‑button taps
    if (target?.closest('.info-btn')) return;

    const draggable = target?.closest('[draggable="true"]');
    if (!draggable) return;

    // Store starting position – we haven't started a real drag yet
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    touchStarted = false;
    touchDragData = null;   // not dragging until threshold is passed

    // Pre‑build the data that would be used if a drag actually happens
    if (draggable.classList.contains('element-card')) {
        const atomicNumber = parseInt(draggable.dataset.atomicNumber);
        const element = elementsData.find(el => el.atomicNumber === atomicNumber);
        if (!element) return;
        const ionIdx = ionIndexMap.get(atomicNumber) || 0;
        const qty = elementQuantities.get(atomicNumber) || 1;
        touchDragData = { atomicNumber, ionIndex: ionIdx, quantity: qty, sourceEl: draggable };
    } else if (draggable.classList.contains('palette-card')) {
        touchDragData = {
            symbol: draggable.dataset.symbol,
            charge: parseInt(draggable.dataset.charge),
            name: draggable.dataset.name,
            quantity: paletteQuantities.get(draggable.dataset.symbol) || 1,
            sourceEl: draggable
        };
    } else if (draggable.classList.contains('product-card')) {
        touchDragData = {
            symbol: draggable.dataset.symbol,
            name: draggable.dataset.name,
            formula: draggable.dataset.formula,
            quantity: parseInt(draggable.dataset.quantity) || 1,
            balanced: draggable.dataset.balanced || '',
            category: draggable.dataset.category || classifyCompound({ name: draggable.dataset.name, formula: draggable.dataset.formula }),
            sourceEl: draggable
        };
    } else {
        return;
    }
}

function onTouchMove(e) {
    if (!touchDragData) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;
    const dist = Math.sqrt(dx*dx + dy*dy);

    // Start dragging only after moving past the threshold
    if (!touchStarted && dist >= DRAG_THRESHOLD) {
        touchStarted = true;
        // Create visual ghost
        const source = touchDragData.sourceEl;
        touchGhost = source.cloneNode(true);
        touchGhost.style.position = 'fixed';
        touchGhost.style.zIndex = '9999';
        touchGhost.style.pointerEvents = 'none';
        touchGhost.style.opacity = '0.8';
        touchGhost.style.width = source.offsetWidth + 'px';
        touchGhost.style.height = source.offsetHeight + 'px';
        document.body.appendChild(touchGhost);
        // Now prevent scrolling
        e.preventDefault();
    }

    if (touchStarted) {
        e.preventDefault();   // keep preventing once drag has started
        moveGhost(touch.clientX, touch.clientY);

        // Highlight drop target
        document.querySelectorAll('.drag-hover').forEach(el => el.classList.remove('drag-hover'));
        const elemBelow = document.elementFromPoint(touch.clientX, touch.clientY);
        if (elemBelow && elemBelow.closest('[draggable="true"]') && elemBelow.closest('[draggable="true"]') !== touchGhost) {
            const target = elemBelow.closest('[draggable="true"]');
            target.classList.add('drag-hover');
        }
    }
}

function onTouchEnd(e) {
    if (!touchDragData) return;

    if (touchStarted) {
        // A real drag ended – perform drop logic
        const touch = e.changedTouches[0];
        const elemBelow = document.elementFromPoint(touch.clientX, touch.clientY);
        const target = elemBelow?.closest('[draggable="true"]');

        if (target) {
            if (target.classList.contains('element-card')) {
                const atomicNumber = parseInt(target.dataset.atomicNumber);
                const element = elementsData.find(el => el.atomicNumber === atomicNumber);
                if (element) {
                    handleReaction(touchDragData, { clientX: touch.clientX, clientY: touch.clientY }, element);
                }
            } else if (target.classList.contains('palette-card')) {
                const ion = {
                    symbol: target.dataset.symbol,
                    charge: parseInt(target.dataset.charge),
                    name: target.dataset.name,
                    root: target.dataset.root
                };
                handleReaction(touchDragData, { clientX: touch.clientX, clientY: touch.clientY }, ion);
            } else if (target.classList.contains('product-card')) {
                handleReaction(touchDragData, { clientX: touch.clientX, clientY: touch.clientY }, target);
            }
        }

        // Clean up ghost
        if (touchGhost) {
            touchGhost.remove();
            touchGhost = null;
        }
        document.querySelectorAll('.drag-hover').forEach(el => el.classList.remove('drag-hover'));
    }
    // If !touchStarted, it was a tap – the native click event will handle it automatically

    // Reset everything
    touchDragData = null;
    touchStarted = false;
    touchGhost = null;
}
console.log('🚀 SparkChemWeb script v6.2 – ion log + no multiply');

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

// IGCSE Solubility Rules (fallback)
const solubilityRules = {
    alwaysSoluble: ['Na', 'K', 'NH4', 'NO3'],
    halides: { soluble: true, exceptions: ['Ag', 'Pb'] },
    sulfates: { soluble: true, exceptions: ['Ca', 'Ba', 'Pb'] },
    carbonates: { soluble: false },
    hydroxides: { soluble: false, exceptions: ['Na', 'K', 'Ca', 'NH4'] }
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
// OLD REACTION MAP (element+element only)
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
// COMPOUND CLASSIFICATION (water first, then other checks)
// ============================================
function classifyCompound(compound) {
    if (!compound) return null;
    const name = (compound.name || '').toLowerCase();
    const formulaLower = (compound.formula || compound.symbol || '').toLowerCase();
    if (name === 'water' || formulaLower === 'h2o' || formulaLower === 'h₂o') return 'water';
    if (/^(h₂|n₂|o₂|f₂|cl₂|br₂|i₂)$/.test(formulaLower) || name.includes('molecule')) {
        const elemSymbol = formulaLower.charAt(0).toUpperCase();
        if (['F','Cl','Br','I'].includes(elemSymbol)) return 'halogen';
        if (['H','N','O'].includes(elemSymbol)) return 'gas';
        return 'gas';
    }
    if (/^h[^2o]/.test(formulaLower) || name.includes('acid')) return 'acid';
    if (name.endsWith('hydroxide') || /oh/i.test(formulaLower)) return 'base';
    if (name.includes('carbonate') || /co3/i.test(formulaLower)) return 'carbonate';
    const rawFormula = compound.formula || compound.symbol || '';
    if (name.endsWith('oxide') || /^[A-Z][a-z]?[₀₁₂₃₄₅₆₇₈₉]*O[₀₁₂₃₄₅₆₇₈₉]*$/.test(rawFormula)) return 'oxide';
    return 'salt';
}

// ============================================
// getReactantCategory
// ============================================
function getReactantCategory(reactant) {
    if (!reactant) return null;
    if (reactant.atomicNumber) {
        const cat = reactant.category || '';
        if (/metal/.test(cat)) return 'metal';
        if (cat === 'halogen') return 'halogen';
        if (/nonmetal/.test(cat)) return 'nonmetal';
        if (cat === 'noble gas') return 'noble gas';
        if (cat === 'metalloid') return 'metalloid';
        return 'element';
    }
    return classifyCompound(reactant);
}

// ============================================
// REACTION PATTERNS (all order‑independent)
// ============================================
const reactionPatterns = [
    // 1. Acid + Base
    {
        reactantTypes: ['acid', 'base'],
        description: 'Neutralisation',
        generateProducts: (reactantA, reactantB) => {
            const catA = getReactantCategory(reactantA);
            const catB = getReactantCategory(reactantB);
            const acid = catA === 'acid' ? reactantA : reactantB;
            const base = catA === 'base' ? reactantA : reactantB;
            const acidAnion = getAnionFromAcid(acid);
            const baseCation = getCationFromBase(base);
            const saltFormula = buildIonicFormula(baseCation, acidAnion);
            const saltName = buildSaltName(baseCation, acidAnion);
            const saltSolubility = checkSolubility(baseCation.root, acidAnion.root, saltFormula);
            const balanced = `${acid.formula || acid.symbol} + ${base.formula || base.symbol} → ${saltFormula} + H₂O`;
            return [
                { symbol: saltFormula, name: saltName, formula: saltFormula, type: 'salt', isAqueous: saltSolubility, balanced },
                { symbol: 'H₂O', name: 'Water', formula: 'H₂O', type: 'water' }
            ];
        }
    },
    // 2. Metal + Acid
    {
        reactantTypes: ['metal', 'acid'],
        description: 'Metal + Acid',
        generateProducts: (reactantA, reactantB) => {
            const catA = getReactantCategory(reactantA);
            const catB = getReactantCategory(reactantB);
            const metal = catA === 'metal' ? reactantA : reactantB;
            const acid  = catA === 'acid'  ? reactantA : reactantB;
            const acidAnion = getAnionFromAcid(acid);
            const metalCation = {
                symbol: metal.symbol + (metal.oxidationStates ? superscriptNumber(Math.abs(metal.oxidationStates[0])) : '⁺'),
                charge: metal.oxidationStates ? Math.abs(metal.oxidationStates[0]) : 1,
                root: metal.symbol,
                name: metal.name
            };
            const saltFormula = buildIonicFormula(metalCation, acidAnion);
            const saltSolubility = checkSolubility(metalCation.root, acidAnion.root, saltFormula);
            const coeff = metalCation.charge / Math.abs(acidAnion.charge);
            const acidCoeff = (coeff > 1 ? coeff : '');
            const balanced = `${metal.symbol} + ${acidCoeff}${acid.formula || acid.symbol} → ${saltFormula} + H₂`;
            return [
                { symbol: saltFormula, name: buildSaltName(metalCation, acidAnion), formula: saltFormula, type: 'salt', isAqueous: saltSolubility, balanced },
                { symbol: 'H₂', name: 'Hydrogen', formula: 'H₂', type: 'gas' }
            ];
        }
    },
    // 3. Metal Oxide + Acid
    {
        reactantTypes: ['oxide', 'acid'],
        description: 'Metal Oxide + Acid',
        generateProducts: (reactantA, reactantB) => {
            const catA = getReactantCategory(reactantA);
            const catB = getReactantCategory(reactantB);
            const oxide = catA === 'oxide' ? reactantA : reactantB;
            const acid  = catA === 'acid'  ? reactantA : reactantB;
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
            const saltSolubility = checkSolubility(metalCation.root, acidAnion.root, saltFormula);
            const coeff = metalCation.charge / Math.abs(acidAnion.charge);
            const acidCoeff = (coeff > 1 ? coeff : '');
            const balanced = `${oxide.formula || oxide.symbol} + ${acidCoeff}${acid.formula || acid.symbol} → ${saltFormula} + H₂O`;
            return [
                { symbol: saltFormula, name: buildSaltName(metalCation, acidAnion), formula: saltFormula, type: 'salt', isAqueous: saltSolubility, balanced },
                { symbol: 'H₂O', name: 'Water', formula: 'H₂O', type: 'water' }
            ];
        }
    },
    // 4. Carbonate + Acid
    {
        reactantTypes: ['carbonate', 'acid'],
        description: 'Carbonate + Acid',
        generateProducts: (reactantA, reactantB) => {
            const catA = getReactantCategory(reactantA);
            const catB = getReactantCategory(reactantB);
            const carbonate = catA === 'carbonate' ? reactantA : reactantB;
            const acid      = catA === 'acid'      ? reactantA : reactantB;
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
            const saltSolubility = checkSolubility(metalCation.root, acidAnion.root, saltFormula);
            const coeff = 2 / Math.abs(acidAnion.charge);
            const acidCoeff = (coeff > 1 ? coeff : '');
            const balanced = `${carbonate.formula || carbonate.symbol} + ${acidCoeff}${acid.formula || acid.symbol} → ${saltFormula} + H₂O + CO₂`;
            return [
                { symbol: saltFormula, name: buildSaltName(metalCation, acidAnion), formula: saltFormula, type: 'salt', isAqueous: saltSolubility, balanced },
                { symbol: 'H₂O', name: 'Water', formula: 'H₂O', type: 'water' },
                { symbol: 'CO₂', name: 'Carbon dioxide', formula: 'CO₂', type: 'gas' }
            ];
        }
    },
    // 5. Metal + Water
    {
        reactantTypes: ['metal', 'water'],
        description: 'Metal + Water',
        generateProducts: (reactantA, reactantB) => {
            const catA = getReactantCategory(reactantA);
            const catB = getReactantCategory(reactantB);
            const metal = catA === 'metal' ? reactantA : reactantB;
            const water = catA === 'water' ? reactantA : reactantB;
            const reactiveMetals = ['K', 'Na', 'Ca', 'Mg', 'Al', 'Zn', 'Fe'];
            if (!reactiveMetals.includes(metal.symbol)) return null;
            if (currentTemperature >= 100) {
                const charge = metal.oxidationStates ? Math.abs(metal.oxidationStates[0]) : 1;
                const oxideFormula = buildIonicFormula(
                    { root: metal.symbol, charge, name: metal.name },
                    { root: 'O', charge: -2, name: 'Oxide', symbol: 'O²⁻' }
                );
                const balanced = `${metal.symbol} + H₂O → ${oxideFormula} + H₂`;
                return [
                    { symbol: oxideFormula, name: metal.name + ' oxide', formula: oxideFormula, type: 'oxide', balanced },
                    { symbol: 'H₂', name: 'Hydrogen', formula: 'H₂', type: 'gas' }
                ];
            } else {
                const charge = metal.oxidationStates ? Math.abs(metal.oxidationStates[0]) : 1;
                const hydroxideFormula = buildIonicFormula(
                    { root: metal.symbol, charge, name: metal.name },
                    { root: 'OH', charge: -1, name: 'Hydroxide', symbol: 'OH⁻' }
                );
                const hydroxideSolubility = checkSolubility(metal.symbol, 'OH', hydroxideFormula);
                const balanced = `${metal.symbol} + 2H₂O → ${hydroxideFormula} + H₂`;
                return [
                    { symbol: hydroxideFormula, name: metal.name + ' hydroxide', formula: hydroxideFormula, type: 'base', isAqueous: hydroxideSolubility, balanced },
                    { symbol: 'H₂', name: 'Hydrogen', formula: 'H₂', type: 'gas' }
                ];
            }
        }
    },
    // 6. Displacement (Metal + Salt)
    {
        reactantTypes: ['metal', 'salt'],
        description: 'Displacement',
        generateProducts: (reactantA, reactantB) => {
            const catA = getReactantCategory(reactantA);
            const catB = getReactantCategory(reactantB);
            const metal = catA === 'metal' ? reactantA : reactantB;
            const salt  = catA === 'salt'  ? reactantA : reactantB;
            const reactivity = ['K','Na','Ca','Mg','Al','Zn','Fe','Pb','Cu','Ag','Au'];
            if (!reactivity.includes(metal.symbol)) return null;
            const saltCation = getCationFromFormula(salt.formula);
            if (!saltCation) return null;
            const saltMetal = elementsData.find(el => el.symbol === saltCation);
            if (!saltMetal || !reactivity.includes(saltMetal.symbol)) return null;
            if (reactivity.indexOf(metal.symbol) >= reactivity.indexOf(saltMetal.symbol)) return null;
            const anion = getAnionFromFormula(salt.formula);
            const anionObj = getAnionFromAcid({ formula: 'H' + anion });
            const newSaltFormula = buildIonicFormula(
                { root: metal.symbol, charge: metal.oxidationStates ? Math.abs(metal.oxidationStates[0]) : 1, name: metal.name },
                anionObj
            );
            const newSaltSolubility = checkSolubility(metal.symbol, anionObj.root, newSaltFormula);
            const balanced = `${metal.symbol} + ${salt.formula || salt.symbol} → ${newSaltFormula} + ${saltMetal.symbol}`;
            return [
                { symbol: newSaltFormula, name: buildSaltName({ name: metal.name, root: metal.symbol }, anionObj), formula: newSaltFormula, type: 'salt', isAqueous: newSaltSolubility, balanced },
                { symbol: saltMetal.symbol, name: saltMetal.name, formula: saltMetal.symbol, type: 'metal' }
            ];
        }
    },
    // 7. Halogen Displacement
    {
        reactantTypes: ['halogen', 'salt'],
        description: 'Halogen Displacement',
        generateProducts: (reactantA, reactantB) => {
            const catA = getReactantCategory(reactantA);
            const catB = getReactantCategory(reactantB);
            const halogenReactant = catA === 'halogen' ? reactantA : reactantB;
            const saltReactant    = catA === 'salt'    ? reactantA : reactantB;
            if (halogenReactant.category !== 'halogen' || saltReactant.category !== 'salt') return null;
            const halogenReactivity = ['F','Cl','Br','I'];
            const halSymbol = (halogenReactant.symbol || '').replace(/[₂₃₄₅₆₇₈₉]/g, '');
            const saltHalogen = (getAnionFromFormula(saltReactant.formula) || '').replace(/[₂₃₄₅₆₇₈₉]/g, '');
            if (!saltHalogen || !halogenReactivity.includes(halSymbol) || !halogenReactivity.includes(saltHalogen)) return null;
            if (halogenReactivity.indexOf(halSymbol) >= halogenReactivity.indexOf(saltHalogen)) return null;
            const saltCation = getCationFromFormula(saltReactant.formula);
            const newSaltFormula = buildIonicFormula(
                { root: saltCation, charge: 1, name: saltCation },
                { root: halSymbol, charge: -1, name: halSymbol + 'ide', symbol: halSymbol + '⁻' }
            );
            const newSaltSolubility = checkSolubility(saltCation, halSymbol, newSaltFormula);
            const balanced = `${halSymbol}₂ + 2${saltReactant.formula || saltReactant.symbol} → 2${newSaltFormula} + ${saltHalogen}₂`;
            return [
                { symbol: newSaltFormula, name: saltCation + ' ' + halSymbol + 'ide', formula: newSaltFormula, type: 'salt', isAqueous: newSaltSolubility, balanced },
                { symbol: saltHalogen + '₂', name: saltHalogen, formula: saltHalogen + '₂', type: 'gas' }
            ];
        }
    },
    // 8. Precipitation
    {
        reactantTypes: ['salt', 'salt'],
        description: 'Precipitation',
        generateProducts: (saltA, saltB) => {
            const cationA = getCationFromFormula(saltA.formula);
            const anionA = getAnionFromFormula(saltA.formula);
            const cationB = getCationFromFormula(saltB.formula);
            const anionB = getAnionFromFormula(saltB.formula);
            if (!cationA || !anionA || !cationB || !anionB) return null;
            if ((cationA === cationB && anionA === anionB) || (cationA === cationB && anionB === anionA)) return null;
            const anionBObj = getAnionFromAcid({ formula: 'H' + anionB });
            const anionAObj = getAnionFromAcid({ formula: 'H' + anionA });
            const product1Formula = buildIonicFormula({ root: cationA, charge: 1, name: cationA }, anionBObj);
            const product2Formula = buildIonicFormula({ root: cationB, charge: 1, name: cationB }, anionAObj);
            const orig1 = saltA.formula;
            const orig2 = saltB.formula;
            if ((product1Formula === orig1 && product2Formula === orig2) || (product1Formula === orig2 && product2Formula === orig1)) return null;
            const sol1 = checkSolubility(cationA, anionB, product1Formula);
            const sol2 = checkSolubility(cationB, anionA, product2Formula);
            const balanced = `${saltA.formula || saltA.symbol} + ${saltB.formula || saltB.symbol} → ${product1Formula} + ${product2Formula}`;
            return [
                { symbol: product1Formula, name: cationA + ' ' + anionB + 'ide', formula: product1Formula, type: 'salt', isAqueous: sol1, balanced },
                { symbol: product2Formula, name: cationB + ' ' + anionA + 'ide', formula: product2Formula, type: 'salt', isAqueous: sol2 }
            ];
        }
    },
    // 9. Thermal Decomposition
    {
        reactantTypes: ['carbonate', null],
        description: 'Thermal Decomposition',
        singleReactant: true,
        generateProducts: (carbonate) => {
            if (carbonate.category !== 'carbonate') return null;
            const metalName = carbonate.name.replace(' carbonate', '').replace('(II)', '').replace('(III)', '').trim();
            const metalElement = elementsData.find(el => el.name.toLowerCase() === metalName.toLowerCase());
            if (!metalElement) return null;
            const oxideFormula = buildIonicFormula(
                { root: metalElement.symbol, charge: metalElement.oxidationStates ? Math.abs(metalElement.oxidationStates[0]) : 2, name: metalElement.name },
                { root: 'O', charge: -2, name: 'Oxide', symbol: 'O²⁻' }
            );
            const balanced = `${carbonate.symbol || carbonate.formula} → ${oxideFormula} + CO₂`;
            return [
                { symbol: oxideFormula, name: metalName + ' oxide', formula: oxideFormula, type: 'oxide', balanced },
                { symbol: 'CO₂', name: 'Carbon dioxide', formula: 'CO₂', type: 'gas' }
            ];
        }
    }
];

// ============================================
// HELPER FUNCTIONS
// ============================================
function getAnionFromAcid(acid) {
    const formula = acid.formula || acid.symbol || '';
    const withoutH = formula.replace(/^h/i, '');
    const decoded = decodeSubscript(withoutH);
    const rootDecoded = decoded.replace(/[₀₁₂₃₄₅₆₇₈₉]/g, '');
    const chargeMap = { 'Cl': -1, 'F': -1, 'Br': -1, 'I': -1, 'NO3': -1, 'SO4': -2, 'CO3': -2, 'PO4': -3 };
    const charge = chargeMap[rootDecoded] || -1;
    const originalRoot = withoutH.replace(/[⁺⁻²³⁴⁵⁶⁷⁸⁹⁰]/g, '');
    return {
        symbol: originalRoot + (charge === -1 ? '⁻' : charge === -2 ? '²⁻' : '³⁻'),
        charge,
        root: originalRoot,
        name: rootDecoded + (charge === -1 ? 'ide' : 'ate')
    };
}
function getCationFromBase(base) {
    const formula = base.formula || base.symbol || '';
    const ohMatch = formula.match(/\(OH\)[₀₁₂₃₄₅₆₇₈₉]*|OH[₀₁₂₃₄₅₆₇₈₉]*/i);
    let ohCount = 1;
    if (ohMatch) {
        const ohPart = ohMatch[0];
        const subMatch = ohPart.match(/[₀₁₂₃₄₅₆₇₈₉]+/);
        if (subMatch) {
            const decoded = decodeSubscript(subMatch[0]);
            ohCount = parseInt(decoded) || 1;
        }
    }
    const charge = ohCount;
    const cationRoot = formula.replace(/\(OH\)[₀₁₂₃₄₅₆₇₈₉]*|OH[₀₁₂₃₄₅₆₇₈₉]*/i, '').replace(/[₀₁₂₃₄₅₆₇₈₉]/g, '');
    const element = elementsData.find(el => el.symbol.toLowerCase() === cationRoot.toLowerCase());
    if (element) {
        return {
            symbol: element.symbol + superscriptNumber(charge) + '⁺',
            charge,
            root: element.symbol,
            name: element.name
        };
    }
    return { symbol: cationRoot + superscriptNumber(charge) + '⁺', charge, root: cationRoot, name: cationRoot };
}
function buildIonicFormula(cation, anion) {
    const cCharge = Math.abs(cation.charge);
    const aCharge = Math.abs(anion.charge);
    const g = gcd(cCharge, aCharge);
    const cSub = aCharge / g;
    const aSub = cCharge / g;
    let cationPart = cation.root;
    if (cSub > 1) cationPart += subscriptNumber(cSub);
    let anionPart = anion.root;
    if (aSub > 1) {
        const cleanRoot = anion.root.replace(/[₀₁₂₃₄₅₆₇₈₉]/g, '');
        if (!/^[A-Z][a-z]?$/.test(cleanRoot)) {
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
// STATE DETERMINATION (JSON‑powered solubility)
// ============================================
function getProductState(product, temp, isAqueous = false) {
    if (isAqueous) {
        const formula = product.formula || product.symbol || '';
        if (formula === 'H₂O') return temp < 0 ? 's' : temp >= 100 ? 'g' : 'l';
        return 'aq';
    }
    const formula = product.formula || product.symbol || '';
    const props = compoundsData.find(c => c.formula === formula);
    if (props && props.meltingPoint !== undefined && props.boilingPoint !== undefined && props.boilingPoint !== null) {
        if (temp < props.meltingPoint) return 's';
        if (temp < props.boilingPoint) return 'l';
        return 'g';
    }
    if (product.meltingPoint !== undefined && product.boilingPoint !== undefined && product.boilingPoint !== null) {
        if (temp < product.meltingPoint) return 's';
        if (temp >= product.meltingPoint && temp < product.boilingPoint) return 'l';
        return 'g';
    }
    const cation = getCationFromFormula(formula);
    const anion = getAnionFromFormula(formula);
    if (cation && anion) return checkSolubility(cation, anion, formula) ? 'aq' : 's';
    if (product.type === 'gas') return 'g';
    if (product.type === 'water') return temp < 0 ? 's' : temp >= 100 ? 'g' : 'l';
    return 's';
}
function getCationFromFormula(formula) {
    const m = formula.match(/^([A-Z][a-z]?)/);
    return m ? m[1] : null;
}
function getAnionFromFormula(formula) {
    const decoded = decodeSubscript(formula);
    const cationMatch = decoded.match(/^[A-Z][a-z]?\d*/);
    if (!cationMatch) return null;
    const anionPart = decoded.slice(cationMatch[0].length);
    return anionPart.replace(/[()\d]/g, '');
}
function checkSolubility(cation, anion, formula = null) {
    if (formula) {
        const compound = compoundsData.find(c => c.formula === formula);
        if (compound && compound.soluble !== undefined) return compound.soluble;
    }
    const decodedCation = decodeSubscript(cation).replace(/[⁺⁻²³⁴⁵⁶⁷⁸⁹⁰₀₁₂₃₄₅₆₇₈₉]/g, '');
    const decodedAnion  = decodeSubscript(anion).replace(/[⁺⁻²³⁴⁵⁶⁷⁸⁹⁰₀₁₂₃₄₅₆₇₈₉]/g, '');
    if (solubilityRules.alwaysSoluble.includes(decodedCation) || solubilityRules.alwaysSoluble.includes(decodedAnion)) return true;
    if (decodedAnion === 'Cl' || decodedAnion === 'Br' || decodedAnion === 'I') return !solubilityRules.halides.exceptions.includes(decodedCation);
    if (decodedAnion === 'SO4') return !solubilityRules.sulfates.exceptions.includes(decodedCation);
    if (decodedAnion === 'CO3') return false;
    if (decodedAnion === 'OH') return solubilityRules.hydroxides.exceptions && solubilityRules.hydroxides.exceptions.includes(decodedCation);
    return true;
}
function updateAllProductStates() {
    document.querySelectorAll('.product-card').forEach(card => {
        const product = JSON.parse(card.dataset.product || '{}');
        const state = getProductState(product, currentTemperature, product.isAqueous === true);
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
// PRODUCT COLOUR CLASS
// ============================================
function getProductClass(product) {
    const formula = product.formula || product.symbol || '';
    if (formula === 'H₂O') return 'prod-water';
    if (product.type === 'gas') return 'prod-gas';
    const category = classifyCompound({ name: product.name, formula: formula });
    if (category === 'oxide') return 'prod-oxide';
    const comp = compoundsData.find(c => c.formula === formula);
    if (comp && comp.boilingPoint !== null && comp.boilingPoint < 25) return 'prod-molecular';
    if (product.type === 'salt' || product.type === 'base' || product.type === 'carbonate' || product.type === 'ionic') return 'prod-ionic';
    return 'prod-ionic';
}

// ============================================
// DRAG HOVER HIGHLIGHT HELPERS
// ============================================
function addDragHoverHandlers(el) {
    el.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        el.classList.add('drag-hover');
    });
    el.addEventListener('dragleave', () => {
        el.classList.remove('drag-hover');
    });
    el.addEventListener('drop', () => {
        el.classList.remove('drag-hover');
    });
}

// ============================================
// FETCH & SETUP
// ============================================
fetch('data/elements.json')
    .then(response => { if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`); return response.json(); })
    .then(data => { elementsData = data; return fetch('data/ion.json'); })
    .then(response => { if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`); return response.json(); })
    .then(ionJson => { ionData = ionJson; return fetch('data/compounds.json'); })
    .then(response => { if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`); return response.json(); })
    .then(compoundsJson => {
        compoundsData = compoundsJson;
        renderPeriodicTable(elementsData);
        buildIonPalette();
        updateCardSize();
        window.addEventListener('hashchange', router);
        router();
        positionOverlayControls();
        window.addEventListener('resize', () => { positionOverlayControls(); updateCardSize(); });

        // Start tutorial only after rendering is complete
        if (!localStorage.getItem('sparkchemweb-tutorial-seen')) {
            setTimeout(startTutorial, 300);
        }
    })
    .catch(error => {
        console.error('Error loading data:', error);
        document.getElementById('periodic-table').innerHTML = '<p style="color: red;">Failed to load data. Check console.</p>';
    });

// ============================================
// HELPER: Determine state based on temperature (for elements)
// ============================================
function getState(element, temp) {
    const mp = element.meltingPoint, bp = element.boilingPoint;
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
        addDragHoverHandlers(card);
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
        // ---------- Block context menu ----------
        card.addEventListener('contextmenu', (e) => e.preventDefault());
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
        productA = {
            symbol: dragData.symbol, name: dragData.name, formula: dragData.formula,
            balanced: dragData.balanced || '', quantity: dragData.quantity || 1,
            category: dragData.category || classifyCompound({ name: dragData.name, formula: dragData.formula })
        };
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
        productB = {
            symbol: targetElementOrIon.dataset.symbol, name: targetElementOrIon.dataset.name,
            formula: targetElementOrIon.dataset.formula, balanced: targetElementOrIon.dataset.balanced || '',
            quantity: parseInt(targetElementOrIon.dataset.quantity) || 1,
            category: targetElementOrIon.dataset.category || classifyCompound({ name: targetElementOrIon.dataset.name, formula: targetElementOrIon.dataset.formula })
        };
    }

    const normalizeSymbol = (sym) => sym.replace(/[₂₃₄₅₆₇₈₉]/g, '');
    let result = null;

    // Diatomic combination – only allowed in atom mode
    if (currentMode !== 'ion' && reactantA && reactantB && reactantA.atomicNumber && reactantB.atomicNumber && reactantA.symbol === reactantB.symbol) {
        const diatomicList = ['H', 'N', 'O', 'F', 'Cl', 'Br', 'I'];
        if (diatomicList.includes(reactantA.symbol)) {
            const diatomicSymbol = reactantA.symbol + '₂';
            const compound = compoundsData.find(c => c.formula === diatomicSymbol);
            result = {
                products: [{ symbol: diatomicSymbol, name: compound?.name || reactantA.name + ' molecule', formula: diatomicSymbol, type: 'gas', balanced: `2${reactantA.symbol} → ${diatomicSymbol}`, isAqueous: false }],
                type: 'direct combination'
            };
        }
    }

    // Self‑drop for single‑reactant patterns
    if (!result && targetElementOrIon && targetElementOrIon.dataset && dragData.symbol === targetElementOrIon.dataset.symbol &&
        dragData.formula === targetElementOrIon.dataset.formula) {
        const singlePattern = reactionPatterns.find(p => p.singleReactant && p.reactantTypes[0] === (productA?.category || classifyCompound(productA)));
        if (singlePattern && currentTemperature > 200) {
            const products = singlePattern.generateProducts(productA);
            if (products) {
                result = {
                    products: products.map(p => ({ ...p, quantity: 1 })),
                    type: singlePattern.description,
                    isDecomposition: true
                };
            }
        }
    }

    if (!result) {
        if (ionA && ionB) {
            result = reactIons(ionA, ionB);
        } else if ((reactantA || productA) && (reactantB || productB)) {
            const symA = reactantA ? normalizeSymbol(reactantA.symbol) : normalizeSymbol(productA.symbol);
            const symB = reactantB ? normalizeSymbol(reactantB.symbol) : normalizeSymbol(productB.symbol);
            const key1 = symA + '+' + symB, key2 = symB + '+' + symA;
            const reaction = reactionMap[key1] || reactionMap[key2];
            if (reaction) {
                result = { products: [{ ...reaction, quantity: 1 }], type: reaction.type };
            } else {
                const catA = getReactantCategory(reactantA || productA);
                const catB = getReactantCategory(reactantB || productB);
                if (catA && catB) {
                    let pattern = reactionPatterns.find(p =>
                        (p.reactantTypes[0] === catA && p.reactantTypes[1] === catB) ||
                        (p.reactantTypes[0] === catB && p.reactantTypes[1] === catA)
                    );
                    if (!pattern && ((catA === 'metal' && catB === 'water') || (catB === 'metal' && catA === 'water'))) {
                        pattern = reactionPatterns.find(p => p.reactantTypes[0] === 'metal' && p.reactantTypes[1] === 'water');
                    }
                    if (pattern) {
                        const objA = reactantA || { name: productA.name, formula: productA.formula, category: productA.category, symbol: productA.symbol, oxidationStates: [] };
                        const objB = reactantB || { name: productB.name, formula: productB.formula, category: productB.category, symbol: productB.symbol, oxidationStates: [] };
                        if (catA === 'metal' && !objA.symbol && productA) { const c = getCationFromFormula(productA.formula); if (c) objA.symbol = c; }
                        if (catB === 'metal' && !objB.symbol && productB) { const c = getCationFromFormula(productB.formula); if (c) objB.symbol = c; }
                        const products = pattern.generateProducts(objA, objB);
                        if (products) {
                            result = { products: products.map(p => ({ ...p, quantity: 1 })), type: pattern.description };
                            if (window.__tutorialCheckNeutralisation && pattern.description === 'Neutralisation') {
                                const acidFormula = (reactantA || productA).formula || (reactantA || productA).symbol;
                                const baseFormula = (reactantB || productB).formula || (reactantB || productB).symbol;
                                if ((acidFormula === 'HCl' && baseFormula === 'NaOH') || (acidFormula === 'NaOH' && baseFormula === 'HCl')) {
                                    window.__tutorialCheckNeutralisation();
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if (result) {
        const wrapper = document.querySelector('.table-relative-wrapper');
        const rect = wrapper.getBoundingClientRect();
        result.products.forEach(prod => {
            prod.reactionType = result.type;
            const x = event.clientX - rect.left - 40 + Math.random() * 20;
            const y = event.clientY - rect.top - 40 + Math.random() * 20;
            createProductCard(prod, x, y);
        });
        if (result.isDecomposition) {
            logReaction(result.products[0], result.type, productA, null);
        } else {
            const aStr = reactantA || ionA || productA;
            const bStr = reactantB || ionB || productB;
            logReaction(result.products[0], result.type, aStr, bStr);
        }
    } else {
        // Show ion symbols when possible for better no-reaction logs
        const aSym = ionA ? ionA.symbol : (reactantA ? reactantA.symbol : (productA ? productA.symbol : '?'));
        const bSym = ionB ? ionB.symbol : (reactantB ? reactantB.symbol : (productB ? productB.symbol : '?'));
        logNoReaction({ symbol: aSym }, { symbol: bSym });
    }
}

// ============================================
// ION REACTION ENGINE (with proper naming)
// ============================================
function getAnionNameFromElement(symbol) {
    const nameMap = {
        'F': 'fluoride', 'Cl': 'chloride', 'Br': 'bromide', 'I': 'iodide',
        'O': 'oxide', 'S': 'sulfide', 'N': 'nitride', 'P': 'phosphide',
        'C': 'carbide', 'H': 'hydride'
    };
    return nameMap[symbol] || (symbol + 'ide');
}
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
        const cleanRoot = anion.root.replace(/[₀₁₂₃₄₅₆₇₈₉]/g, '');
        if (!/^[A-Z][a-z]?$/.test(cleanRoot)) {
            anionPart = '(' + anion.root + ')' + subscriptNumber(anionSubscript);
        } else {
            anionPart += subscriptNumber(anionSubscript);
        }
    }
    formula += anionPart;
    let anionName = anion.name;
    if (anion.root && anion.root.length <= 2 && /^[A-Z][a-z]?$/.test(anionRoot)) {
        anionName = getAnionNameFromElement(anionRoot);
    } else if (anionName === anionRoot) {
        anionName = anionRoot;
    }
    let name = cation.name + ' ' + anionName.toLowerCase();
    if (formula === 'HOH') { formula = 'H₂O'; name = 'Water'; }
    const isAqueous = checkSolubility(cationRoot, anionRoot, formula);
    let balanced = '';
    if (cationSubscript > 1) balanced += cationSubscript;
    balanced += cation.symbol + ' + ';
    if (anionSubscript > 1) balanced += anionSubscript;
    balanced += anion.symbol + ' → ' + formula;
    return { products: [{ symbol: formula, name, formula, type: 'ionic', balanced, isAqueous }], type: 'ionic' };
}

// ============================================
// UPDATE CARD SIZE
// ============================================
function updateCardSize() {
    const hCard = document.querySelector('.element-card[data-symbol="H"]');
    if (hCard) cardSize = hCard.offsetWidth;
    document.querySelectorAll('.product-card').forEach(card => { card.style.width = cardSize + 'px'; card.style.height = cardSize + 'px'; });
    document.querySelectorAll('.palette-card').forEach(card => { card.style.width = cardSize + 'px'; card.style.height = cardSize + 'px'; });
}

// ============================================
// BUILD POLYATOMIC ION PALETTE (flex layout, no title)
// ============================================
function buildIonPalette() {
    const grid = document.getElementById('palette-grid');
    if (!grid) return;
    grid.innerHTML = '';

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

        card.style.width = cardSize + 'px';
        card.style.height = cardSize + 'px';

        card.draggable = true;
        addDragHoverHandlers(card);
        card.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('application/json', JSON.stringify({
                symbol: ion.symbol,
                charge: ion.charge,
                name: ion.name,
                quantity: paletteQuantities.get(ion.symbol) || 1
            }));
            e.dataTransfer.effectAllowed = 'move';
        });
        card.addEventListener('dragover', (e) => { e.preventDefault(); });
        card.addEventListener('drop', (e) => {
            e.preventDefault();
            const rawData = e.dataTransfer.getData('application/json');
            if (!rawData) return;
            const dragData = JSON.parse(rawData);
            handleReaction(dragData, e, {
                symbol: ion.symbol,
                charge: ion.charge,
                name: ion.name,
                root: ion.root
            });
        });
        // Block context menu
        card.addEventListener('contextmenu', (e) => e.preventDefault());
        grid.appendChild(card);
    });
}

// ============================================
// CREATE PRODUCT CARD (with colour class and touch grip support)
// ============================================
function createProductCard(product, initialX, initialY) {
    const card = document.createElement('div');
    card.className = 'product-card';
    const colourClass = getProductClass(product);
    card.classList.add(colourClass);

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
    card.dataset.product = JSON.stringify(product);
    card.style.width = cardSize + 'px';
    card.style.height = cardSize + 'px';
    if (product.quantity > 1) {
        const badge = document.createElement('span');
        badge.className = 'quantity-badge';
        badge.textContent = product.quantity;
        card.appendChild(badge);
    }
    const grip = document.createElement('div');
    grip.className = 'grip-handle';
    grip.title = 'Drag to move';
    card.appendChild(grip);
    let dragState = { isDragging: false, startX: 0, startY: 0, left: 0, top: 0 };

    // ---- MOUSE grip handlers ----
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

    // ---- TOUCH grip handlers ----
    grip.addEventListener('touchstart', (e) => {
        e.stopPropagation();
        const touch = e.changedTouches[0];
        dragState.isDragging = true;
        dragState.startX = touch.clientX;
        dragState.startY = touch.clientY;
        dragState.left = card.offsetLeft;
        dragState.top = card.offsetTop;
        card.style.cursor = 'grabbing';
        e.preventDefault();
    }, { passive: false });
    grip.addEventListener('touchmove', (e) => {
        if (!dragState.isDragging) return;
        e.preventDefault();
        const touch = e.changedTouches[0];
        const dx = touch.clientX - dragState.startX;
        const dy = touch.clientY - dragState.startY;
        card.style.left = (dragState.left + dx) + 'px';
        card.style.top = (dragState.top + dy) + 'px';
    }, { passive: false });
    grip.addEventListener('touchend', () => {
        dragState.isDragging = false;
        card.style.cursor = '';
    });

    // ---- Append card to wrapper ----
    const wrapper = document.querySelector('.table-relative-wrapper');
    card.style.left = initialX + 'px';
    card.style.top = initialY + 'px';
    wrapper.appendChild(card);

    // ---- Info button ----
    const infoBtn = document.createElement('span');
    infoBtn.className = 'info-btn';
    infoBtn.textContent = 'ⓘ';
    infoBtn.title = 'Product details';
    infoBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showProductDetail(card);
    });
    card.appendChild(infoBtn);

    // ---- Drag‑to‑react (card itself) ----
    card.draggable = true;
    addDragHoverHandlers(card);
    card.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('application/json', JSON.stringify({
            symbol: product.symbol, name: product.name, formula: product.formula,
            quantity: product.quantity || 1, balanced: product.balanced || '', category: card.dataset.category
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

    // Block context menu
    card.addEventListener('contextmenu', (e) => e.preventDefault());

    return card;
}

// ============================================
// SHOW PRODUCT DETAIL POP‑UP  (with tutorial hook)
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

    if (window.__tutorialCheckProductInfo) {
        window.__tutorialCheckProductInfo();
    }
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
    let balanced;
    if (b === null) {
        balanced = product.balanced || `${a.symbol || a.formula} → ${product.symbol}`;
    } else {
        balanced = product.balanced || `${a?.symbol || a?.root} + ${b?.symbol || b?.root} → ${product.symbol}`;
    }
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
// POSITION OVERLAY CONTROLS – unified wrapper
// ============================================
function positionOverlayControls() {
    const hCard = document.querySelector('.element-card[data-symbol="H"]');
    const heCard = document.querySelector('.element-card[data-symbol="He"]');
    const overlay = document.getElementById('conditions-overlay');
    if (!hCard || !heCard || !overlay) return;

    const container = document.querySelector('.table-relative-wrapper');
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const hRect = hCard.getBoundingClientRect();
    const heRect = heCard.getBoundingClientRect();

    const GAP = 10;
    const left = hRect.right - containerRect.left + GAP;
    const right = heRect.left - containerRect.left - GAP;

    overlay.style.left = left + 'px';
    overlay.style.right = (containerRect.width - right) + 'px';
    overlay.style.top = (hRect.top - containerRect.top) + 'px';
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
    window.location.hash = '';
}
function showDetailView() {
    tableViewContainer.style.display = 'none';
    detailView.style.display = 'block';
    const logOverlay = document.getElementById('log-overlay');
    const ionsOverlay = document.getElementById('ions-overlay');
    if (logOverlay) logOverlay.style.display = 'none';
    if (ionsOverlay) ionsOverlay.style.display = 'none';
    document.querySelectorAll('#toggle-log, #toggle-ions').forEach(btn => btn.classList.remove('active'));
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

        // Hide overlays and reset their toggle buttons
        const logOverlay = document.getElementById('log-overlay');
        const ionsOverlay = document.getElementById('ions-overlay');
        if (logOverlay) logOverlay.style.display = 'none';
        if (ionsOverlay) ionsOverlay.style.display = 'none';
        document.querySelectorAll('#toggle-log, #toggle-ions').forEach(btn => btn.classList.remove('active'));
    });
}
const catalystSelect = document.getElementById('catalyst-select');
if (catalystSelect) catalystSelect.addEventListener('change', (e) => { currentCatalyst = e.target.value; });
const backBtn = document.getElementById('back-to-table');
if (backBtn) backBtn.addEventListener('click', () => { window.location.hash = ''; });

// ============================================
// OVERLAY TOGGLE (Log & Ions)
// ============================================
const logOverlay = document.getElementById('log-overlay');
const ionsOverlay = document.getElementById('ions-overlay');
const toggleLogBtn = document.getElementById('toggle-log');
const toggleIonsBtn = document.getElementById('toggle-ions');

function toggleOverlay(overlay, btn) {
    if (overlay.style.display === 'none' || overlay.style.display === '') {
        overlay.style.display = 'block';
        if (btn) btn.classList.add('active');
    } else {
        overlay.style.display = 'none';
        if (btn) btn.classList.remove('active');
    }
}

if (toggleLogBtn) toggleLogBtn.addEventListener('click', () => toggleOverlay(logOverlay, toggleLogBtn));
if (toggleIonsBtn) toggleIonsBtn.addEventListener('click', () => toggleOverlay(ionsOverlay, toggleIonsBtn));

document.querySelectorAll('.overlay-close').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const overlayId = e.target.getAttribute('data-overlay');
        const overlay = document.getElementById(overlayId);
        if (overlay) {
            overlay.style.display = 'none';
            if (overlayId === 'log-overlay' && toggleLogBtn) toggleLogBtn.classList.remove('active');
            if (overlayId === 'ions-overlay' && toggleIonsBtn) toggleIonsBtn.classList.remove('active');
        }
    });
});

// Close pop‑ups (with tutorial hooks)
document.addEventListener('click', (e) => {
    if (e.target.id === 'product-popup-close') {
        const popup = document.getElementById('product-popup');
        if (popup) {
            popup.style.display = 'none';
            if (window.__tutorialCheckProductInfoClosed) {
                window.__tutorialCheckProductInfoClosed();
            }
        }
    }
    if (e.target.classList.contains('product-popup')) {
        const popup = document.getElementById('product-popup');
        if (popup) {
            popup.style.display = 'none';
            if (window.__tutorialCheckProductInfoClosed) {
                window.__tutorialCheckProductInfoClosed();
            }
        }
    }
    if (e.target.id === 'ion-popup-close') {
        const popup = document.getElementById('ion-popup');
        if (popup) popup.style.display = 'none';
    }
});

// ============================================
// INTERACTIVE TUTORIAL  (v5.2)
// ============================================
const tutorialOverlay = document.getElementById('tutorial-overlay');
const tutorialTitle = document.getElementById('tutorial-title');
const tutorialDesc = document.getElementById('tutorial-description');
const tutorialNextBtn = document.getElementById('tutorial-next');
const tutorialSkipBtn = document.getElementById('tutorial-skip');
const helpBtn = document.getElementById('help-btn');

let tutorialActive = false;
let currentTutorialStep = 0;
let tutorialListeners = [];

const tutorialSteps = [
    {   // step 0
        title: 'Step 1: View an element’s details',
        description: 'Click on the element <b>Hydrogen (H)</b> to see its properties.',
        highlightSelector: '.element-card[data-symbol="H"]',
        autoAdvance: true,
        advanceOn: 'hash-element-1'
    },
    {   // step 1
        title: 'Step 2: Go back to the table',
        description: 'Click the <b>← Back to Table</b> button to return to the main view.',
        highlightSelector: '#back-to-table',
        autoAdvance: true,
        advanceOn: 'back-to-table'
    },
    {   // step 2
        title: 'Step 3: Make water!',
        description: 'Drag <b>Hydrogen (H)</b> onto <b>Oxygen (O)</b> to form water (H₂O).',
        highlightSelector: '.element-card[data-symbol="H"], .element-card[data-symbol="O"]',
        autoAdvance: true,
        advanceOn: 'water-created'
    },
    {   // step 3
        title: 'Step 4: Move the product card',
        description: 'Grab the small handle (top‑left corner of the H₂O card) and drag it to reposition the molecule. (Click Next when you’ve tried it.)',
        highlightSelector: '.product-card[data-symbol="H₂O"] .grip-handle',
        autoAdvance: false
    },
    {   // step 4
        title: 'Step 5: Product info',
        description: 'Click the <b>ⓘ</b> button on the H₂O card to see detailed information about water.',
        highlightSelector: '.product-card[data-symbol="H₂O"] .info-btn',
        autoAdvance: true,
        advanceOn: 'product-info-opened'
    },
    {   // step 5 – close info popup
        title: 'Step 6: Close the info popup',
        description: 'Click the <b>✕</b> button (or outside the popup) to close the product info.',
        highlightSelector: '#product-popup-close',
        autoAdvance: true,
        advanceOn: 'product-info-closed'
    },
    {   // step 6
        title: 'Step 7: Control the conditions',
        description: 'Use the <b>Temperature</b> and <b>Pressure</b> sliders and the <b>Catalyst</b> dropdown to change reaction conditions. (Click Next to continue.)',
        highlightSelector: '#conditions-overlay',
        autoAdvance: false
    },
    {   // step 7
        title: 'Step 8: Switch to ion mode',
        description: 'Click the <b>Ion</b> button (top left) to work with charged ions.',
        highlightSelector: '#mode-ion',
        autoAdvance: true,
        advanceOn: 'ion-mode'
    },
    {   // step 8 – form HCl from H⁺ + Cl⁻
        title: 'Step 9: Form HCl',
        description: 'Click <b>H</b> to cycle to H⁺, click <b>Cl</b> to Cl⁻, then drag one onto the other to form HCl.',
        highlightSelector: '.element-card[data-symbol="H"], .element-card[data-symbol="Cl"]',
        autoAdvance: true,
        advanceOn: 'HCl-created'
    },
    {   // step 9 – open Common Ions palette
        title: 'Step 10: Open the Common Ions palette',
        description: 'Click the <b>⚛️ Ions</b> button to open the polyatomic ion palette. (Click Next when ready.)',
        highlightSelector: '#toggle-ions',
        autoAdvance: false
    },
    {   // step 10 – form NaOH from Na⁺ + OH⁻
        title: 'Step 11: Make NaOH',
        description: 'Drag <b>Na⁺</b> (click Na if needed) onto <b>OH⁻</b> from the palette to form NaOH.',
        highlightSelector: '.element-card[data-symbol="Na"], .palette-card[data-symbol="OH⁻"]',
        autoAdvance: true,
        advanceOn: 'NaOH-created'
    },
    {   // step 11 – combine HCl + NaOH
        title: 'Step 12: Neutralise!',
        description: 'Drag the <b>HCl</b> card onto the <b>NaOH</b> card (by their body, not the grip handle) to see them react.',
        highlightSelector: '.product-card[data-symbol="HCl"], .product-card[data-symbol="NaOH"]',
        autoAdvance: true,
        advanceOn: 'neutralisation'
    },
    {   // step 12 – open Reaction Log
        title: 'Step 13: View the Reaction Log',
        description: 'Click the <b>📋 Log</b> button to see the balanced equation and conditions. (Click Next when done.)',
        highlightSelector: '#toggle-log',
        autoAdvance: false
    },
    {   // step 13 – clear all
        title: 'Step 14: Clear the table',
        description: 'Click <b>Clear All</b> to reset everything.',
        highlightSelector: '#clear-all',
        autoAdvance: true,
        advanceOn: 'clear-all'
    }
];

function highlightElements(selector) {
    if (!selector) return;
    const elements = document.querySelectorAll(selector);
    elements.forEach(el => el.classList.add('tutorial-highlight'));
    if (elements.length > 0) {
        elements[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function removeAllHighlights() {
    document.querySelectorAll('.tutorial-highlight').forEach(el => el.classList.remove('tutorial-highlight'));
}

function cleanupListeners() {
    tutorialListeners.forEach(fn => fn());
    tutorialListeners = [];
}

function setTutorialStep(stepIndex) {
    if (stepIndex >= tutorialSteps.length) {
        endTutorial();
        return;
    }
    currentTutorialStep = stepIndex;
    const step = tutorialSteps[stepIndex];
    tutorialTitle.textContent = step.title;
    tutorialDesc.innerHTML = step.description;
    tutorialNextBtn.style.display = step.autoAdvance ? 'none' : 'inline-block';

    removeAllHighlights();
    highlightElements(step.highlightSelector);

    cleanupListeners();

    if (step.autoAdvance) {
        if (step.advanceOn === 'hash-element-1') {
            const handler = () => {
                if (window.location.hash === '#element/1') {
                    nextStep();
                }
            };
            window.addEventListener('hashchange', handler);
            tutorialListeners.push(() => window.removeEventListener('hashchange', handler));
        }
        else if (step.advanceOn === 'back-to-table') {
            const backBtn = document.getElementById('back-to-table');
            const handler = () => {
                setTimeout(nextStep, 100);
            };
            if (backBtn) {
                backBtn.addEventListener('click', handler);
                tutorialListeners.push(() => backBtn.removeEventListener('click', handler));
            }
        }
        else if (step.advanceOn === 'water-created') {
            window.__tutorialCheckWater = (productSymbol) => {
                if (productSymbol === 'H₂O' && currentTutorialStep === 2) {
                    nextStep();
                }
            };
            tutorialListeners.push(() => { delete window.__tutorialCheckWater; });
        }
        else if (step.advanceOn === 'product-info-opened') {
            window.__tutorialCheckProductInfo = () => {
                if (currentTutorialStep === 4) {
                    nextStep();
                }
            };
            tutorialListeners.push(() => { delete window.__tutorialCheckProductInfo; });
        }
        else if (step.advanceOn === 'product-info-closed') {
            window.__tutorialCheckProductInfoClosed = () => {
                if (currentTutorialStep === 5) {
                    nextStep();
                }
            };
            tutorialListeners.push(() => { delete window.__tutorialCheckProductInfoClosed; });
        }
        else if (step.advanceOn === 'ion-mode') {
            const handler = () => {
                if (currentMode === 'ion') {
                    nextStep();
                }
            };
            const ionBtn = document.getElementById('mode-ion');
            if (ionBtn) {
                ionBtn.addEventListener('click', handler);
                tutorialListeners.push(() => ionBtn.removeEventListener('click', handler));
            }
            if (currentMode === 'ion') {
                nextStep();
            }
        }
        else if (step.advanceOn === 'HCl-created') {
            window.__tutorialCheckHCl = (productSymbol) => {
                if (productSymbol === 'HCl' && currentTutorialStep === 8) {
                    nextStep();
                }
            };
            tutorialListeners.push(() => { delete window.__tutorialCheckHCl; });
        }
        else if (step.advanceOn === 'NaOH-created') {
            window.__tutorialCheckNaOH = (productSymbol) => {
                if (productSymbol === 'NaOH' && currentTutorialStep === 10) {
                    nextStep();
                }
            };
            tutorialListeners.push(() => { delete window.__tutorialCheckNaOH; });
        }
        else if (step.advanceOn === 'neutralisation') {
            window.__tutorialCheckNeutralisation = () => {
                if (currentTutorialStep === 11) {
                    nextStep();
                }
            };
            tutorialListeners.push(() => { delete window.__tutorialCheckNeutralisation; });
        }
        else if (step.advanceOn === 'clear-all') {
            const clearBtn = document.getElementById('clear-all');
            const handler = () => {
                nextStep();
            };
            if (clearBtn) {
                clearBtn.addEventListener('click', handler);
                tutorialListeners.push(() => clearBtn.removeEventListener('click', handler));
            }
        }
    }
}

function nextStep() {
    cleanupListeners();
    removeAllHighlights();
    setTutorialStep(currentTutorialStep + 1);
}

function startTutorial() {
    if (tutorialActive) return;
    tutorialActive = true;
    tutorialOverlay.style.display = 'flex';
    void tutorialOverlay.offsetWidth;
    tutorialOverlay.classList.add('show');
    setTutorialStep(0);
}

function endTutorial() {
    tutorialActive = false;
    cleanupListeners();
    removeAllHighlights();
    tutorialOverlay.classList.remove('show');
    setTimeout(() => {
        tutorialOverlay.style.display = 'none';
    }, 300);
    localStorage.setItem('sparkchemweb-tutorial-seen', 'true');
}

if (helpBtn) {
    helpBtn.addEventListener('click', startTutorial);
}

if (tutorialNextBtn) {
    tutorialNextBtn.addEventListener('click', nextStep);
}

if (tutorialSkipBtn) {
    tutorialSkipBtn.addEventListener('click', endTutorial);
}

// Auto‑start tutorial is now inside the fetch chain (after render)

// Monkey‑patch createProductCard to detect specific products for tutorial
const originalCreateProductCard = createProductCard;
createProductCard = function(product, initialX, initialY) {
    const card = originalCreateProductCard(product, initialX, initialY);
    if (window.__tutorialCheckWater && product.symbol === 'H₂O') {
        window.__tutorialCheckWater(product.symbol);
    }
    if (window.__tutorialCheckHCl && (product.symbol === 'HCl' || product.formula === 'HCl')) {
        window.__tutorialCheckHCl(product.symbol);
    }
    if (window.__tutorialCheckNaOH && (product.symbol === 'NaOH' || product.formula === 'NaOH')) {
        window.__tutorialCheckNaOH(product.symbol);
    }
    return card;
};

// ============================================
// TOUCH DRAG‑AND‑DROP SUPPORT (tap‑friendly, no self‑drop on tap)
// ============================================
let touchDragData = null;
let touchGhost = null;
let touchStartX = 0, touchStartY = 0;
let touchStarted = false;        // true once we pass the move threshold
const DRAG_THRESHOLD = 5;        // px – finger must move this far to start a drag

function enableTouchDrag() {
    document.addEventListener('touchstart', onTouchStart, { passive: false });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);
    document.addEventListener('touchcancel', onTouchEnd);
}

function onTouchStart(e) {
    const touch = e.changedTouches[0];
    const target = document.elementFromPoint(touch.clientX, touch.clientY);

    // Don't interfere with info‑button taps
    if (target?.closest('.info-btn')) return;

    const draggable = target?.closest('[draggable="true"]');
    if (!draggable) return;

    // Store starting position – we haven't started a real drag yet
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    touchStarted = false;
    touchDragData = null;   // not dragging until threshold is passed

    // Pre‑build the data that would be used if a drag actually happens
    if (draggable.classList.contains('element-card')) {
        const atomicNumber = parseInt(draggable.dataset.atomicNumber);
        const element = elementsData.find(el => el.atomicNumber === atomicNumber);
        if (!element) return;
        const ionIdx = ionIndexMap.get(atomicNumber) || 0;
        const qty = elementQuantities.get(atomicNumber) || 1;
        touchDragData = { atomicNumber, ionIndex: ionIdx, quantity: qty, sourceEl: draggable };
    } else if (draggable.classList.contains('palette-card')) {
        touchDragData = {
            symbol: draggable.dataset.symbol,
            charge: parseInt(draggable.dataset.charge),
            name: draggable.dataset.name,
            quantity: paletteQuantities.get(draggable.dataset.symbol) || 1,
            sourceEl: draggable
        };
    } else if (draggable.classList.contains('product-card')) {
        touchDragData = {
            symbol: draggable.dataset.symbol,
            name: draggable.dataset.name,
            formula: draggable.dataset.formula,
            quantity: parseInt(draggable.dataset.quantity) || 1,
            balanced: draggable.dataset.balanced || '',
            category: draggable.dataset.category || classifyCompound({ name: draggable.dataset.name, formula: draggable.dataset.formula }),
            sourceEl: draggable
        };
    } else {
        return;
    }
}

function onTouchMove(e) {
    if (!touchDragData) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;
    const dist = Math.sqrt(dx*dx + dy*dy);

    // Start dragging only after moving past the threshold
    if (!touchStarted && dist >= DRAG_THRESHOLD) {
        touchStarted = true;
        // Create visual ghost
        const source = touchDragData.sourceEl;
        touchGhost = source.cloneNode(true);
        touchGhost.style.position = 'fixed';
        touchGhost.style.zIndex = '9999';
        touchGhost.style.pointerEvents = 'none';
        touchGhost.style.opacity = '0.8';
        touchGhost.style.width = source.offsetWidth + 'px';
        touchGhost.style.height = source.offsetHeight + 'px';
        document.body.appendChild(touchGhost);
        // Now prevent scrolling
        e.preventDefault();
    }

    if (touchStarted) {
        e.preventDefault();   // keep preventing once drag has started
        moveGhost(touch.clientX, touch.clientY);

        // Highlight drop target
        document.querySelectorAll('.drag-hover').forEach(el => el.classList.remove('drag-hover'));
        const elemBelow = document.elementFromPoint(touch.clientX, touch.clientY);
        if (elemBelow && elemBelow.closest('[draggable="true"]') && elemBelow.closest('[draggable="true"]') !== touchGhost) {
            const target = elemBelow.closest('[draggable="true"]');
            target.classList.add('drag-hover');
        }
    }
}

function onTouchEnd(e) {
    if (!touchDragData) return;

    if (touchStarted) {
        // A real drag ended – perform drop logic
        const touch = e.changedTouches[0];
        const elemBelow = document.elementFromPoint(touch.clientX, touch.clientY);
        const target = elemBelow?.closest('[draggable="true"]');

        if (target) {
            if (target.classList.contains('element-card')) {
                const atomicNumber = parseInt(target.dataset.atomicNumber);
                const element = elementsData.find(el => el.atomicNumber === atomicNumber);
                if (element) {
                    handleReaction(touchDragData, { clientX: touch.clientX, clientY: touch.clientY }, element);
                }
            } else if (target.classList.contains('palette-card')) {
                const ion = {
                    symbol: target.dataset.symbol,
                    charge: parseInt(target.dataset.charge),
                    name: target.dataset.name,
                    root: target.dataset.root
                };
                handleReaction(touchDragData, { clientX: touch.clientX, clientY: touch.clientY }, ion);
            } else if (target.classList.contains('product-card')) {
                handleReaction(touchDragData, { clientX: touch.clientX, clientY: touch.clientY }, target);
            }
        }

        // Clean up ghost
        if (touchGhost) {
            touchGhost.remove();
            touchGhost = null;
        }
        document.querySelectorAll('.drag-hover').forEach(el => el.classList.remove('drag-hover'));
    }
    // If !touchStarted, it was a tap – the native click event will handle it automatically

    // Reset everything
    touchDragData = null;
    touchStarted = false;
    touchGhost = null;
}

function moveGhost(x, y) {
    if (!touchGhost) return;
    touchGhost.style.left = (x - touchGhost.offsetWidth / 2) + 'px';
    touchGhost.style.top = (y - touchGhost.offsetHeight / 2) + 'px';
}

// Enable touch support on touch‑capable devices
if ('ontouchstart' in window) {
    window.addEventListener('DOMContentLoaded', enableTouchDrag);
}

// Cleanup any lingering drag-hover highlights on mouse drag end
document.addEventListener('dragend', () => {
    document.querySelectorAll('.drag-hover').forEach(el => el.classList.remove('drag-hover'));
});
function moveGhost(x, y) {
    if (!touchGhost) return;
    touchGhost.style.left = (x - touchGhost.offsetWidth / 2) + 'px';
    touchGhost.style.top = (y - touchGhost.offsetHeight / 2) + 'px';
}

// Enable touch support on touch‑capable devices
if ('ontouchstart' in window) {
    window.addEventListener('DOMContentLoaded', enableTouchDrag);
}

// Cleanup any lingering drag-hover highlights on mouse drag end
document.addEventListener('dragend', () => {
    document.querySelectorAll('.drag-hover').forEach(el => el.classList.remove('drag-hover'));
});

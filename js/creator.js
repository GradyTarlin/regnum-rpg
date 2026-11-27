/**
 * Regnum RPG — Character Creator
 * js/creator.js
 *
 * Manages the 7-step character creation wizard and
 * the web-based character sheet with localStorage persistence.
 */

'use strict';

/* ============================================================
   CONSTANTS & CONFIG
   ============================================================ */
const SKILLS = [
  { id: 'shooting',    label: 'Shooting',    badgeClass: 'badge-shooting' },
  { id: 'fighting',    label: 'Fighting',    badgeClass: 'badge-fighting' },
  { id: 'athletics',   label: 'Athletics',   badgeClass: 'badge-athletics' },
  { id: 'piloting',    label: 'Piloting',    badgeClass: 'badge-piloting' },
  { id: 'engineering', label: 'Engineering', badgeClass: 'badge-engineering' },
  { id: 'charisma',    label: 'Charisma',    badgeClass: 'badge-charisma' },
  { id: 'stealth',     label: 'Stealth',     badgeClass: 'badge-stealth' },
  { id: 'instinct',    label: 'Instinct',    badgeClass: 'badge-instinct' },
];

const MAX_SKILL_BONUS  = 3;  // cap at level 1
const FREE_SKILL_POINTS = 3;
const STORAGE_KEY = 'regnum-characters';
const STORAGE_KEY_CURRENT = 'regnum-current-character';

const STEP_CONFIG = [
  { title: 'Choose Your Species',    subtitle: 'Your species determines your species feature and a bonus to one skill.' },
  { title: 'Choose Your Subspecies', subtitle: 'Your subspecies grants an additional species feature.' },
  { title: 'Choose Your Class',      subtitle: 'Your class grants +2 to one skill and +1 to another, plus a class ability.' },
  { title: 'Choose Starting Equipment', subtitle: 'Each class offers three equipment options. Choose one.' },
  { title: 'Choose a Tier 1 Feature',   subtitle: 'Select a tier 1 class feature to define your style.' },
  { title: 'Assign Skill Points',       subtitle: 'Spend your 3 free skill points. No skill may exceed +3 at level 1.' },
  { title: 'Your Character Sheet',      subtitle: 'Review your character, name them, and save for use at the table.' },
];

// Emoji icons for each species
const SPECIES_ICONS = {
  human:    '🧑',
  tomorran: '🌟',
  robot:    '🤖',
  banderog: '⚙️',
  chkaar:   '⚔️',
  altan:    '🦎',
  iirkol:   '🔮',
  kotta:    '🌿',
  lengwae:  '🎭',
};

// Class icons
const CLASS_ICONS = {
  catalyst:  '✨',
  heavy:     '🔥',
  hunter:    '🎯',
  mutant:    '🧬',
  pilot:     '🚀',
  tech:      '🔧',
  trader:    '💬',
};

/* ============================================================
   STATE
   ============================================================ */
const state = {
  currentStep: 0,
  speciesData: null,
  classesData: null,

  // Character selections
  selectedSpecies: null,
  selectedSubspecies: null,
  selectedClass: null,
  selectedEquipment: null,
  selectedFeature: null,
  humanBonusSkill: null,  // only for Human species

  // Skill assignments: free points per skill
  skillAssigned: {},      // { shooting: 0, fighting: 0, ... }
  freePointsUsed: 0,

  // Character sheet
  characterName: '',
  hp: [true, true, true], // 3 HP pips
  notes: '',
};

/* ============================================================
   DATA LOADING
   ============================================================ */
async function loadData() {
  try {
    const [speciesRes, classesRes] = await Promise.all([
      fetch('data/species.json'),
      fetch('data/classes.json'),
    ]);
    state.speciesData = await speciesRes.json();
    state.classesData = await classesRes.json();
    return true;
  } catch (err) {
    console.error('Failed to load game data:', err);
    return false;
  }
}

/* ============================================================
   STEP NAVIGATION
   ============================================================ */
function goToStep(newStep) {
  const totalSteps = STEP_CONFIG.length;
  if (newStep < 0 || newStep >= totalSteps) return;

  // Hide current, show new
  document.getElementById(`step-${state.currentStep}`).classList.add('hidden');
  document.getElementById(`step-${newStep}`).classList.remove('hidden');

  state.currentStep = newStep;

  updateStepIndicators();
  updateProgress();
  updateStepHeader();
  updateNavButtons();
  updateNavSummary();

  // If entering skills step, render it
  if (newStep === 5) renderSkillsStep();
  // If entering sheet step, render it
  if (newStep === 6) renderCharacterSheet();

  // Scroll to top of creator body
  document.getElementById('creator-header').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function updateStepIndicators() {
  STEP_CONFIG.forEach((_, i) => {
    const el = document.getElementById(`step-indicator-${i}`);
    if (!el) return;
    el.classList.remove('active', 'done');
    if (i < state.currentStep) {
      el.classList.add('done');
      el.querySelector('.step-dot').textContent = '✓';
    } else if (i === state.currentStep) {
      el.classList.add('active');
      el.querySelector('.step-dot').textContent = i + 1;
    } else {
      el.querySelector('.step-dot').textContent = i + 1;
    }

    // Step lines
    const line = document.getElementById(`step-line-${i}`);
    if (line) {
      line.classList.toggle('done', i < state.currentStep);
    }
  });
}

function updateProgress() {
  const pct = (state.currentStep / (STEP_CONFIG.length - 1)) * 100;
  const fill = document.getElementById('progress-fill');
  fill.style.width = `${pct}%`;
  fill.parentElement.setAttribute('aria-valuenow', Math.round(pct));
}

function updateStepHeader() {
  const cfg = STEP_CONFIG[state.currentStep];
  document.getElementById('step-title').textContent    = cfg.title;
  document.getElementById('step-subtitle').textContent = cfg.subtitle;
}

function updateNavButtons() {
  const btnPrev = document.getElementById('btn-prev');
  const btnNext = document.getElementById('btn-next');

  btnPrev.disabled = state.currentStep === 0;

  if (state.currentStep === STEP_CONFIG.length - 1) {
    btnNext.textContent = '✦ Done';
    btnNext.style.display = 'none';
  } else {
    btnNext.textContent = 'Continue →';
    btnNext.style.display = '';
  }

  // Validate current step to enable/disable next
  btnNext.disabled = !canProceed();
}

function canProceed() {
  switch (state.currentStep) {
    case 0: return !!state.selectedSpecies;
    case 1: return !!state.selectedSubspecies;
    case 2: return !!state.selectedClass;
    case 3: return !!state.selectedEquipment;
    case 4: return !!state.selectedFeature;
    case 5: {
      // Human must choose bonus skill
      if (state.selectedSpecies?.skillBonus?.skill === 'any' && !state.humanBonusSkill) return false;
      return state.freePointsUsed <= FREE_SKILL_POINTS; // can proceed even without spending all
    }
    case 6: return true;
    default: return false;
  }
}

function updateNavSummary() {
  const el = document.getElementById('creator-nav-summary');
  const parts = [];
  if (state.selectedSpecies)    parts.push(`<span class="summary-item">Species: <strong>${state.selectedSpecies.name}</strong></span>`);
  if (state.selectedSubspecies) parts.push(`<span class="summary-item">Subspecies: <strong>${state.selectedSubspecies.name}</strong></span>`);
  if (state.selectedClass)      parts.push(`<span class="summary-item">Class: <strong>${state.selectedClass.name}</strong></span>`);
  el.innerHTML = parts.join('<span class="sep">•</span>');
}

/* ============================================================
   STEP RENDERERS
   ============================================================ */

// ── STEP 0: Species ──────────────────────────────────────────
function renderSpeciesStep() {
  const grid = document.getElementById('species-grid');
  grid.innerHTML = '';

  state.speciesData.species.forEach(sp => {
    const icon = SPECIES_ICONS[sp.id] || '👾';
    const bonusText = sp.skillBonus.skill === 'any'
      ? '+1 Any Skill'
      : `+${sp.skillBonus.amount} ${capitalize(sp.skillBonus.skill)}`;
    const badgeClass = sp.skillBonus.skill === 'any' ? 'badge-gold' : `badge-${sp.skillBonus.skill}`;

    const card = createElement('div', 'species-card card-interactive', {
      role: 'option',
      'aria-label': sp.name,
      'aria-selected': 'false',
      tabindex: '0',
    });

    card.innerHTML = `
      <div class="card-icon">${icon}</div>
      <div class="card-name">${sp.name}</div>
      <p class="card-flavor">${sp.description}</p>
      <div class="card-badges">
        <span class="badge ${badgeClass}">${bonusText}</span>
      </div>
      <div class="card-feature-preview" style="margin-top:8px; padding-top:8px; border-top:1px solid var(--border); text-align:left;">
        <div class="text-xs" style="color:var(--gold); font-weight:600; margin-bottom:4px;">${sp.speciesFeature.name}</div>
        <p class="text-xs text-muted" style="line-height:1.5; margin:0;">${sp.speciesFeature.description}</p>
      </div>
    `;

    card.addEventListener('click', () => selectSpecies(sp, card));
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') selectSpecies(sp, card); });

    if (state.selectedSpecies?.id === sp.id) {
      card.classList.add('selected');
      card.setAttribute('aria-selected', 'true');
    }

    grid.appendChild(card);
  });
}

function selectSpecies(sp, card) {
  // Deselect all
  document.querySelectorAll('#species-grid .species-card').forEach(c => {
    c.classList.remove('selected');
    c.setAttribute('aria-selected', 'false');
  });

  state.selectedSpecies = sp;
  state.selectedSubspecies = null; // reset downstream
  state.humanBonusSkill = null;

  card.classList.add('selected');
  card.setAttribute('aria-selected', 'true');
  updateNavButtons();
  updateNavSummary();
}

// ── STEP 1: Subspecies ───────────────────────────────────────
function renderSubspeciesStep() {
  const infoEl = document.getElementById('subspecies-species-info');
  const grid   = document.getElementById('subspecies-grid');

  if (!state.selectedSpecies) return;
  const sp = state.selectedSpecies;

  // Show selected species info
  infoEl.innerHTML = `
    <span class="card-icon" style="font-size:1.5rem">${SPECIES_ICONS[sp.id] || '👾'}</span>
    <div>
      <div class="species-info-name">${sp.name} — ${sp.speciesFeature.name}</div>
      <p class="species-info-feature text-sm text-muted">${sp.speciesFeature.description}</p>
    </div>
  `;

  grid.innerHTML = '';
  sp.subspecies.forEach(sub => {
    const card = createElement('div', 'species-card card-interactive', {
      role: 'option',
      'aria-label': sub.name,
      'aria-selected': 'false',
      tabindex: '0',
    });

    const subFeat = sub.subspeciesFeature || sub.feature;
    card.innerHTML = `
      <div class="card-name">${sub.name}</div>
      ${sub.description ? `<p class="card-flavor">${sub.description}</p>` : ''}
      <div style="margin-top:8px; padding-top:8px; border-top:1px solid var(--border); text-align:left;">
        <div class="feature-name" style="font-size:0.8rem; color:var(--gold); font-weight:600; margin-bottom:4px;">${subFeat.name}</div>
        <p class="card-flavor" style="margin:0;">${subFeat.description}</p>
      </div>
    `;

    card.addEventListener('click', () => selectSubspecies(sub, card));
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') selectSubspecies(sub, card); });

    if (state.selectedSubspecies?.id === sub.id) {
      card.classList.add('selected');
      card.setAttribute('aria-selected', 'true');
    }

    grid.appendChild(card);
  });
}

function selectSubspecies(sub, card) {
  document.querySelectorAll('#subspecies-grid .species-card').forEach(c => {
    c.classList.remove('selected');
    c.setAttribute('aria-selected', 'false');
  });
  state.selectedSubspecies = sub;
  card.classList.add('selected');
  card.setAttribute('aria-selected', 'true');
  updateNavButtons();
  updateNavSummary();
}

// ── STEP 2: Class ────────────────────────────────────────────
function renderClassStep() {
  const grid = document.getElementById('class-grid');
  grid.innerHTML = '';

  state.classesData.classes.forEach(cls => {
    const icon = CLASS_ICONS[cls.id] || '⚡';

    const card = createElement('div', 'class-card card-interactive', {
      role: 'option',
      'aria-label': cls.name,
      'aria-selected': 'false',
      tabindex: '0',
    });

    const badgesHtml = cls.skillBonuses.map(b =>
      `<span class="badge badge-${b.skill}">+${b.amount} ${capitalize(b.skill)}</span>`
    ).join('');

    card.innerHTML = `
      <div class="card-icon">${icon}</div>
      <div class="card-name">${cls.name}</div>
      <p class="card-flavor">${cls.flavor}</p>
      <div class="card-badges">${badgesHtml}</div>
      <div class="card-feature-preview">
        <span class="text-xs text-muted">${cls.classAbility.name}</span>
      </div>
    `;

    card.addEventListener('click', () => selectClass(cls, card));
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') selectClass(cls, card); });

    if (state.selectedClass?.id === cls.id) {
      card.classList.add('selected');
      card.setAttribute('aria-selected', 'true');
    }

    grid.appendChild(card);
  });
}

function selectClass(cls, card) {
  document.querySelectorAll('#class-grid .class-card').forEach(c => {
    c.classList.remove('selected');
    c.setAttribute('aria-selected', 'false');
  });
  state.selectedClass = cls;
  state.selectedEquipment = null; // reset downstream
  state.selectedFeature = null;
  card.classList.add('selected');
  card.setAttribute('aria-selected', 'true');
  updateNavButtons();
  updateNavSummary();
}

// ── STEP 3: Equipment ────────────────────────────────────────
function renderEquipmentStep() {
  const container = document.getElementById('equipment-options');
  container.innerHTML = '';

  if (!state.selectedClass) return;

  state.selectedClass.startingEquipment.forEach(opt => {
    const el = createElement('div', 'equip-option', {
      role: 'radio',
      'aria-label': opt.label,
      'aria-checked': 'false',
      tabindex: '0',
    });

    const itemsHtml = opt.items.map(item =>
      `<div class="equip-item">${item}</div>`
    ).join('');

    el.innerHTML = `
      <div class="equip-option-radio"></div>
      <div class="equip-option-content">
        <div class="equip-option-label">${opt.label}</div>
        <div class="equip-option-items">${itemsHtml}</div>
      </div>
    `;

    el.addEventListener('click', () => selectEquipment(opt, el));
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') selectEquipment(opt, el); });

    if (state.selectedEquipment?.id === opt.id) {
      el.classList.add('selected');
      el.setAttribute('aria-checked', 'true');
    }

    container.appendChild(el);
  });
}

function selectEquipment(opt, el) {
  document.querySelectorAll('.equip-option').forEach(c => {
    c.classList.remove('selected');
    c.setAttribute('aria-checked', 'false');
  });
  state.selectedEquipment = opt;
  el.classList.add('selected');
  el.setAttribute('aria-checked', 'true');
  updateNavButtons();
}

// ── STEP 4: Tier 1 Feature ───────────────────────────────────
function renderFeatureStep() {
  const grid = document.getElementById('feature-grid');
  grid.innerHTML = '';

  if (!state.selectedClass) return;

  state.selectedClass.tier1Features.forEach(feat => {
    const card = createElement('div', 'feature-select-card', {
      role: 'option',
      'aria-label': feat.name,
      'aria-selected': 'false',
      tabindex: '0',
    });

    card.innerHTML = `
      <div class="feature-card-name">${feat.name}</div>
      <p class="feature-card-desc">${feat.description}</p>
    `;

    card.addEventListener('click', () => selectFeature(feat, card));
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') selectFeature(feat, card); });

    if (state.selectedFeature?.id === feat.id) {
      card.classList.add('selected');
      card.setAttribute('aria-selected', 'true');
    }

    grid.appendChild(card);
  });
}

function selectFeature(feat, card) {
  document.querySelectorAll('.feature-select-card').forEach(c => {
    c.classList.remove('selected');
    c.setAttribute('aria-selected', 'false');
  });
  state.selectedFeature = feat;
  card.classList.add('selected');
  card.setAttribute('aria-selected', 'true');
  updateNavButtons();
}

// ── STEP 5: Skills ───────────────────────────────────────────
function renderSkillsStep() {
  renderHumanBonusPanel();
  renderSkillRows();
}

function renderHumanBonusPanel() {
  const panel = document.getElementById('human-bonus-panel');
  const isHuman = state.selectedSpecies?.skillBonus?.skill === 'any';
  panel.style.display = isHuman ? '' : 'none';

  if (!isHuman) return;

  const grid = document.getElementById('human-bonus-grid');
  grid.innerHTML = '';

  SKILLS.forEach(sk => {
    const btn = createElement('button', 'human-bonus-btn', {
      'data-skill': sk.id,
      'aria-label': `Choose ${sk.label}`,
      'aria-pressed': state.humanBonusSkill === sk.id ? 'true' : 'false',
    });
    btn.textContent = sk.label;
    if (state.humanBonusSkill === sk.id) btn.classList.add('selected');

    btn.addEventListener('click', () => {
      state.humanBonusSkill = sk.id;
      document.querySelectorAll('.human-bonus-btn').forEach(b => {
        b.classList.remove('selected');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('selected');
      btn.setAttribute('aria-pressed', 'true');
      renderSkillRows();
      updateNavButtons();
    });

    grid.appendChild(btn);
  });
}

function getSkillBonuses() {
  // Returns { shooting: { species: 0, class: 0, free: 0, total: 0 }, ... }
  const bonuses = {};
  SKILLS.forEach(sk => {
    bonuses[sk.id] = { species: 0, class: 0, free: state.skillAssigned[sk.id] || 0 };
  });

  // Species bonus
  if (state.selectedSpecies) {
    const sb = state.selectedSpecies.skillBonus;
    if (sb.skill === 'any') {
      if (state.humanBonusSkill) {
        bonuses[state.humanBonusSkill].species += sb.amount;
      }
    } else {
      bonuses[sb.skill].species += sb.amount;
    }
  }

  // Class bonuses
  if (state.selectedClass) {
    state.selectedClass.skillBonuses.forEach(b => {
      bonuses[b.skill].class += b.amount;
    });
  }

  // Compute totals
  SKILLS.forEach(sk => {
    bonuses[sk.id].total = bonuses[sk.id].species + bonuses[sk.id].class + bonuses[sk.id].free;
  });

  return bonuses;
}

function renderSkillRows() {
  const list = document.getElementById('skills-list');
  list.innerHTML = '';

  const bonuses = getSkillBonuses();
  const freeUsed = SKILLS.reduce((acc, sk) => acc + (state.skillAssigned[sk.id] || 0), 0);
  state.freePointsUsed = freeUsed;

  const remaining = FREE_SKILL_POINTS - freeUsed;
  const remainingEl = document.getElementById('points-remaining');
  const remainingBox = document.getElementById('points-remaining-box');
  remainingEl.textContent = remaining;
  remainingBox.classList.toggle('zero', remaining === 0);

  SKILLS.forEach(sk => {
    const b = bonuses[sk.id];
    const total = b.total;
    const isMaxed = total >= MAX_SKILL_BONUS;
    const canAdd = remaining > 0 && !isMaxed;
    const canRemove = (state.skillAssigned[sk.id] || 0) > 0;

    const row = createElement('div', 'skill-assign-row');
    row.setAttribute('role', 'group');
    row.setAttribute('aria-label', sk.label);

    // Build pips: 3 total pips, colored by source
    let pipsHtml = '';
    let pipsRendered = 0;
    // Species pips
    for (let i = 0; i < b.species && pipsRendered < MAX_SKILL_BONUS; i++, pipsRendered++) {
      pipsHtml += `<div class="skill-assign-pip pip-species" title="Species bonus"></div>`;
    }
    // Class pips
    for (let i = 0; i < b.class && pipsRendered < MAX_SKILL_BONUS; i++, pipsRendered++) {
      pipsHtml += `<div class="skill-assign-pip pip-class" title="Class bonus"></div>`;
    }
    // Free pips
    for (let i = 0; i < b.free && pipsRendered < MAX_SKILL_BONUS; i++, pipsRendered++) {
      pipsHtml += `<div class="skill-assign-pip pip-free" title="Assigned point"></div>`;
    }
    // Empty pips
    while (pipsRendered < MAX_SKILL_BONUS) {
      pipsHtml += `<div class="skill-assign-pip" title="Empty slot"></div>`;
      pipsRendered++;
    }

    // Extra pips if above cap (can happen if species + class already exceeds... show warning)
    const totalBonusClass = `skill-assign-total${isMaxed ? ' maxed' : (total === 0 ? ' zero' : '')}`;

    row.innerHTML = `
      <div class="skill-assign-name">${sk.label}</div>
      <div class="skill-assign-pips">${pipsHtml}</div>
      <div class="${totalBonusClass}">${total >= 0 ? '+' : ''}${total}</div>
      <button class="skill-assign-btn btn-minus"
        aria-label="Remove point from ${sk.label}"
        ${canRemove ? '' : 'disabled'}
        data-skill="${sk.id}">−</button>
      <button class="skill-assign-btn btn-plus"
        aria-label="Add point to ${sk.label}"
        ${canAdd ? '' : 'disabled'}
        data-skill="${sk.id}">+</button>
    `;

    row.querySelector('.btn-minus').addEventListener('click', () => {
      if ((state.skillAssigned[sk.id] || 0) > 0) {
        state.skillAssigned[sk.id]--;
        renderSkillRows();
        updateNavButtons();
      }
    });

    row.querySelector('.btn-plus').addEventListener('click', () => {
      const curFree = SKILLS.reduce((a, s) => a + (state.skillAssigned[s.id] || 0), 0);
      const curTotal = bonuses[sk.id].total;
      if (curFree < FREE_SKILL_POINTS && curTotal < MAX_SKILL_BONUS) {
        state.skillAssigned[sk.id] = (state.skillAssigned[sk.id] || 0) + 1;
        renderSkillRows();
        updateNavButtons();
      }
    });

    list.appendChild(row);
  });
}

// ── STEP 6: Character Sheet ──────────────────────────────────
function renderCharacterSheet() {
  const bonuses = getSkillBonuses();

  // Name
  const nameInput = document.getElementById('char-name-input');
  if (nameInput.value) state.characterName = nameInput.value;
  document.getElementById('sheet-name').textContent = state.characterName || 'Unnamed Crew Member';

  // Identity tags
  const tagsEl = document.getElementById('sheet-identity-tags');
  const tags = [];
  if (state.selectedSpecies)    tags.push(`<span class="badge badge-gold">${state.selectedSpecies.name}</span>`);
  if (state.selectedSubspecies) tags.push(`<span class="badge badge-skill">${state.selectedSubspecies.name}</span>`);
  if (state.selectedClass)      tags.push(`<span class="badge badge-purple">${state.selectedClass.name}</span>`);
  tagsEl.innerHTML = tags.join('');

  // HP tracker
  renderHpTracker();

  // Skills
  renderSheetSkills(bonuses);

  // Equipment
  renderSheetEquipment();

  // Class ability
  renderSheetClassAbility();

  // Species features
  renderSheetSpeciesFeatures();

  // Tier 1 feature
  renderSheetTier1Feature();
}

function renderHpTracker() {
  const tracker = document.getElementById('hp-tracker');
  tracker.querySelectorAll('.hp-pip').forEach((pip, i) => {
    pip.classList.toggle('filled', state.hp[i]);
    pip.setAttribute('aria-pressed', state.hp[i] ? 'true' : 'false');
    pip.textContent = state.hp[i] ? '❤' : '🖤';

    // Remove old listener and add fresh one
    const newPip = pip.cloneNode(true);
    pip.parentNode.replaceChild(newPip, pip);
    newPip.addEventListener('click', () => {
      state.hp[i] = !state.hp[i];
      renderHpTracker();
    });
  });
}

function renderSheetSkills(bonuses) {
  const list = document.getElementById('sheet-skills-list');
  list.innerHTML = '';

  SKILLS.forEach(sk => {
    const b = bonuses[sk.id];
    const total = b.total;
    const isMaxed = total >= MAX_SKILL_BONUS;

    let pipsHtml = '';
    let pipsRendered = 0;
    for (let i = 0; i < b.species && pipsRendered < MAX_SKILL_BONUS; i++, pipsRendered++) {
      pipsHtml += `<div class="sheet-skill-pip pip-species"></div>`;
    }
    for (let i = 0; i < b.class && pipsRendered < MAX_SKILL_BONUS; i++, pipsRendered++) {
      pipsHtml += `<div class="sheet-skill-pip pip-class"></div>`;
    }
    for (let i = 0; i < b.free && pipsRendered < MAX_SKILL_BONUS; i++, pipsRendered++) {
      pipsHtml += `<div class="sheet-skill-pip pip-free"></div>`;
    }
    while (pipsRendered < MAX_SKILL_BONUS) {
      pipsHtml += `<div class="sheet-skill-pip"></div>`;
      pipsRendered++;
    }

    const bonusClass = `sheet-skill-bonus${isMaxed ? ' maxed' : (total === 0 ? ' zero' : '')}`;

    const row = createElement('div', 'sheet-skill-row');
    row.innerHTML = `
      <span class="sheet-skill-name">${sk.label}</span>
      <div class="sheet-skill-pips">${pipsHtml}</div>
      <span class="${bonusClass}">${total >= 0 ? '+' : ''}${total}</span>
    `;
    list.appendChild(row);
  });
}

function renderSheetEquipment() {
  const list = document.getElementById('sheet-equip-list');
  list.innerHTML = '';
  if (!state.selectedEquipment) return;

  state.selectedEquipment.items.forEach(item => {
    const li = createElement('li', 'sheet-equip-item');
    li.textContent = item;
    list.appendChild(li);
  });
}

function renderSheetClassAbility() {
  const el = document.getElementById('sheet-class-ability');
  if (!state.selectedClass) { el.innerHTML = ''; return; }
  const ab = state.selectedClass.classAbility;
  el.innerHTML = `
    <div class="sheet-feature-name">${ab.name}</div>
    <p class="sheet-feature-desc">${ab.description}</p>
  `;
}

function renderSheetSpeciesFeatures() {
  const el = document.getElementById('sheet-species-features');
  el.innerHTML = '';
  if (!state.selectedSpecies) return;

  const feats = [
    { label: state.selectedSpecies.name, feat: state.selectedSpecies.speciesFeature },
    state.selectedSubspecies ? { label: state.selectedSubspecies.name, feat: state.selectedSubspecies.subspeciesFeature || state.selectedSubspecies.feature } : null,
  ].filter(Boolean);

  feats.forEach(({ label, feat }) => {
    const div = createElement('div', 'sheet-feature');
    div.innerHTML = `
      <div class="sheet-feature-label">${label}</div>
      <div class="sheet-feature-name">${feat.name}</div>
      <p class="sheet-feature-desc">${feat.description}</p>
    `;
    el.appendChild(div);
  });
}

function renderSheetTier1Feature() {
  const el = document.getElementById('sheet-tier1-feature');
  if (!state.selectedFeature) { el.innerHTML = ''; return; }
  el.innerHTML = `
    <div class="sheet-feature-name">${state.selectedFeature.name}</div>
    <p class="sheet-feature-desc">${state.selectedFeature.description}</p>
  `;
}

/* ============================================================
   SAVE / LOAD CHARACTERS
   ============================================================ */
function buildCharacterObject() {
  const nameInput = document.getElementById('char-name-input');
  const notesEl   = document.getElementById('sheet-notes');

  return {
    id:               Date.now().toString(),
    name:             nameInput?.value || 'Unnamed Crew Member',
    notes:            notesEl?.value || '',
    hp:               [...state.hp],
    species:          state.selectedSpecies,
    subspecies:       state.selectedSubspecies,
    chosenClass:      state.selectedClass,
    equipment:        state.selectedEquipment,
    tier1Feature:     state.selectedFeature,
    skillAssigned:    { ...state.skillAssigned },
    humanBonusSkill:  state.humanBonusSkill,
    createdAt:        new Date().toISOString(),
  };
}

function saveCharacter() {
  const char = buildCharacterObject();
  const existing = getSavedCharacters();

  // If updating existing (by name match), replace; otherwise add
  const idx = existing.findIndex(c => c.name === char.name);
  if (idx >= 0) {
    existing[idx] = { ...existing[idx], ...char, id: existing[idx].id };
  } else {
    existing.push(char);
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  window.showToast?.(`"${char.name}" saved!`, 'success');
}

function getSavedCharacters() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch { return []; }
}

function loadCharacterIntoState(char) {
  state.selectedSpecies    = char.species;
  state.selectedSubspecies = char.subspecies;
  state.selectedClass      = char.chosenClass;
  state.selectedEquipment  = char.equipment;
  state.selectedFeature    = char.tier1Feature;
  state.skillAssigned      = { ...char.skillAssigned };
  state.humanBonusSkill    = char.humanBonusSkill;
  state.hp                 = char.hp ? [...char.hp] : [true, true, true];
  state.characterName      = char.name;

  // Go directly to sheet
  goToStep(6);

  const nameInput = document.getElementById('char-name-input');
  if (nameInput) nameInput.value = char.name;
  const notesEl = document.getElementById('sheet-notes');
  if (notesEl) notesEl.value = char.notes || '';

  window.showToast?.(`Loaded "${char.name}"`, 'success');
}

function deleteCharacter(id) {
  const chars = getSavedCharacters().filter(c => c.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(chars));
  renderLoadModal();
}

/* ============================================================
   LOAD MODAL
   ============================================================ */
function openLoadModal() {
  document.getElementById('load-modal').classList.remove('hidden');
  renderLoadModal();
}

function closeLoadModal() {
  document.getElementById('load-modal').classList.add('hidden');
}

function renderLoadModal() {
  const list   = document.getElementById('saved-characters-list');
  const empty  = document.getElementById('no-saved-characters');
  const chars  = getSavedCharacters();

  list.innerHTML = '';

  if (chars.length === 0) {
    empty.style.display = '';
    return;
  }

  empty.style.display = 'none';

  chars.forEach(char => {
    const item = createElement('div', 'saved-char-item');
    const meta = [
      char.species?.name,
      char.subspecies?.name,
      char.chosenClass?.name,
    ].filter(Boolean).join(' / ');

    item.innerHTML = `
      <div class="saved-char-info">
        <div class="saved-char-name">${char.name}</div>
        <div class="saved-char-meta text-muted">${meta}</div>
      </div>
      <div class="saved-char-actions">
        <button class="btn btn-primary btn-sm" data-load="${char.id}">Load</button>
        <button class="btn btn-danger btn-sm" data-delete="${char.id}">🗑</button>
      </div>
    `;

    item.querySelector('[data-load]').addEventListener('click', () => {
      loadCharacterIntoState(char);
      closeLoadModal();
    });

    item.querySelector('[data-delete]').addEventListener('click', () => {
      if (confirm(`Delete "${char.name}"?`)) deleteCharacter(char.id);
    });

    list.appendChild(item);
  });
}

/* ============================================================
   RESET / NEW CHARACTER
   ============================================================ */
function resetState() {
  state.currentStep      = 0;
  state.selectedSpecies  = null;
  state.selectedSubspecies = null;
  state.selectedClass    = null;
  state.selectedEquipment = null;
  state.selectedFeature  = null;
  state.humanBonusSkill  = null;
  state.skillAssigned    = {};
  state.freePointsUsed   = 0;
  state.characterName    = '';
  state.hp               = [true, true, true];
  state.notes            = '';
}

function startNewCharacter() {
  if (state.selectedSpecies && !confirm('Start a new character? Your current progress will be lost.')) return;
  resetState();
  renderSpeciesStep();
  goToStep(0);
  document.getElementById('char-name-input').value = '';
  document.getElementById('sheet-notes').value = '';
}

/* ============================================================
   UTILITY
   ============================================================ */
function createElement(tag, className, attrs = {}) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  return el;
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/* ============================================================
   INIT
   ============================================================ */
async function init() {
  const ok = await loadData();
  if (!ok) {
    document.getElementById('creator-body').innerHTML =
      '<div class="container"><div class="card" style="color:var(--danger)">Failed to load game data. Please refresh.</div></div>';
    return;
  }

  // Initialize skill assigned map
  SKILLS.forEach(sk => { state.skillAssigned[sk.id] = 0; });

  // Render first step
  renderSpeciesStep();
  renderClassStep();     // pre-render for speed
  updateStepIndicators();
  updateProgress();
  updateStepHeader();
  updateNavButtons();

  // ── Event Listeners ──────────────────────────────────────
  document.getElementById('btn-next').addEventListener('click', () => {
    if (!canProceed()) return;
    const nextStep = state.currentStep + 1;

    // Render next step's content
    switch (nextStep) {
      case 1: renderSubspeciesStep(); break;
      case 2: renderClassStep(); break;
      case 3: renderEquipmentStep(); break;
      case 4: renderFeatureStep(); break;
      case 5: break; // rendered on goToStep
      case 6: break; // rendered on goToStep
    }

    goToStep(nextStep);
  });

  document.getElementById('btn-prev').addEventListener('click', () => {
    goToStep(state.currentStep - 1);
  });

  document.getElementById('btn-load').addEventListener('click', openLoadModal);

  document.getElementById('btn-new').addEventListener('click', startNewCharacter);

  document.getElementById('load-modal-close').addEventListener('click', closeLoadModal);

  document.getElementById('load-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeLoadModal();
  });

  document.getElementById('btn-save-char').addEventListener('click', saveCharacter);

  document.getElementById('btn-edit-char').addEventListener('click', () => {
    goToStep(0);
    renderSpeciesStep();
  });

  document.getElementById('btn-new-char').addEventListener('click', startNewCharacter);

  // Name input syncs with sheet
  document.getElementById('char-name-input').addEventListener('input', (e) => {
    state.characterName = e.target.value;
    const nameEl = document.getElementById('sheet-name');
    if (nameEl) nameEl.textContent = e.target.value || 'Unnamed Crew Member';
  });

  // Notes auto-save to state
  document.getElementById('sheet-notes').addEventListener('input', (e) => {
    state.notes = e.target.value;
  });

  // Click outside selects on step indicators (allow clicking step dots for navigation)
  document.querySelectorAll('[data-step]').forEach(el => {
    el.addEventListener('click', () => {
      const targetStep = parseInt(el.dataset.step);
      if (targetStep < state.currentStep) {
        goToStep(targetStep);
        // Re-render step if needed
        switch (targetStep) {
          case 0: renderSpeciesStep(); break;
          case 1: renderSubspeciesStep(); break;
          case 2: renderClassStep(); break;
          case 3: renderEquipmentStep(); break;
          case 4: renderFeatureStep(); break;
        }
      }
    });
  });

  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !document.getElementById('load-modal').classList.contains('hidden')) {
      closeLoadModal();
    }
  });
}

// Boot!
document.addEventListener('DOMContentLoaded', init);

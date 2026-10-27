import { useState, useMemo } from 'react';

// =============================================================================
// FDI DENTAL DEFINITIONS & DEFAULT ANATOMY
// =============================================================================

const TOOTH_DEFAULTS = {
  // Maxillaire Droit (Quadrant 1 - Upper Right)
  18: { category: 'molar', roots: 3, name: 'Troisième molaire (Dent de sagesse) sup. droite' },
  17: { category: 'molar', roots: 3, name: 'Deuxième molaire sup. droite' },
  16: { category: 'molar', roots: 3, name: 'Première molaire sup. droite (Dent de 6 ans)' },
  15: { category: 'premolar', roots: 1, name: 'Deuxième prémolaire sup. droite' },
  14: { category: 'premolar', roots: 2, name: 'Première prémolaire sup. droite (Biradiculée)' },
  13: { category: 'canine', roots: 1, name: 'Canine sup. droite (Racine longue)' },
  12: { category: 'incisor', roots: 1, name: 'Incisive latérale sup. droite' },
  11: { category: 'incisor', roots: 1, name: 'Incisive centrale sup. droite' },

  // Maxillaire Gauche (Quadrant 2 - Upper Left)
  21: { category: 'incisor', roots: 1, name: 'Incisive centrale sup. gauche' },
  22: { category: 'incisor', roots: 1, name: 'Incisive latérale sup. gauche' },
  23: { category: 'canine', roots: 1, name: 'Canine sup. gauche (Racine longue)' },
  24: { category: 'premolar', roots: 2, name: 'Première prémolaire sup. gauche (Biradiculée)' },
  25: { category: 'premolar', roots: 1, name: 'Deuxième prémolaire sup. gauche' },
  26: { category: 'molar', roots: 3, name: 'Première molaire sup. gauche (Dent de 6 ans)' },
  27: { category: 'molar', roots: 3, name: 'Deuxième molaire sup. gauche' },
  28: { category: 'molar', roots: 3, name: 'Troisième molaire (Dent de sagesse) sup. gauche' },

  // Mandibule Gauche (Quadrant 3 - Lower Left)
  31: { category: 'incisor', roots: 1, name: 'Incisive centrale inf. gauche' },
  32: { category: 'incisor', roots: 1, name: 'Incisive latérale inf. gauche' },
  33: { category: 'canine', roots: 1, name: 'Canine inf. gauche (Racine longue)' },
  34: { category: 'premolar', roots: 1, name: 'Première prémolaire inf. gauche' },
  35: { category: 'premolar', roots: 1, name: 'Deuxième prémolaire inf. gauche' },
  36: { category: 'molar', roots: 2, name: 'Première molaire inf. gauche (2 racines)' },
  37: { category: 'molar', roots: 2, name: 'Deuxième molaire inf. gauche (2 racines)' },
  38: { category: 'molar', roots: 2, name: 'Troisième molaire (Dent de sagesse) inf. gauche' },

  // Mandibule Droite (Quadrant 4 - Lower Right)
  41: { category: 'incisor', roots: 1, name: 'Incisive centrale inf. droite' },
  42: { category: 'incisor', roots: 1, name: 'Incisive latérale inf. droite' },
  43: { category: 'canine', roots: 1, name: 'Canine inf. droite (Racine longue)' },
  44: { category: 'premolar', roots: 1, name: 'Première prémolaire inf. droite' },
  45: { category: 'premolar', roots: 1, name: 'Deuxième prémolaire inf. droite' },
  46: { category: 'molar', roots: 2, name: 'Première molaire inf. droite (2 racines)' },
  47: { category: 'molar', roots: 2, name: 'Deuxième molaire inf. droite (2 racines)' },
  48: { category: 'molar', roots: 2, name: 'Troisième molaire (Dent de sagesse) inf. droite' },

  // Primary / Deciduous Teeth (Dents Temporaires / Lactéales - 20 dents)
  55: { category: 'molar', roots: 3, name: 'Deuxième molaire temporaire sup. droite' },
  54: { category: 'molar', roots: 3, name: 'Première molaire temporaire sup. droite' },
  53: { category: 'canine', roots: 1, name: 'Canine temporaire sup. droite' },
  52: { category: 'incisor', roots: 1, name: 'Incisive latérale temporaire sup. droite' },
  51: { category: 'incisor', roots: 1, name: 'Incisive centrale temporaire sup. droite' },

  61: { category: 'incisor', roots: 1, name: 'Incisive centrale temporaire sup. gauche' },
  62: { category: 'incisor', roots: 1, name: 'Incisive latérale temporaire sup. gauche' },
  63: { category: 'canine', roots: 1, name: 'Canine temporaire sup. gauche' },
  64: { category: 'molar', roots: 3, name: 'Première molaire temporaire sup. gauche' },
  65: { category: 'molar', roots: 3, name: 'Deuxième molaire temporaire sup. gauche' },

  71: { category: 'incisor', roots: 1, name: 'Incisive centrale temporaire inf. gauche' },
  72: { category: 'incisor', roots: 1, name: 'Incisive latérale temporaire inf. gauche' },
  73: { category: 'canine', roots: 1, name: 'Canine temporaire inf. gauche' },
  74: { category: 'molar', roots: 2, name: 'Première molaire temporaire inf. gauche' },
  75: { category: 'molar', roots: 2, name: 'Deuxième molaire temporaire inf. gauche' },

  81: { category: 'incisor', roots: 1, name: 'Incisive centrale temporaire inf. droite' },
  82: { category: 'incisor', roots: 1, name: 'Incisive latérale temporaire inf. droite' },
  83: { category: 'canine', roots: 1, name: 'Canine temporaire inf. droite' },
  84: { category: 'molar', roots: 2, name: 'Première molaire temporaire inf. droite' },
  85: { category: 'molar', roots: 2, name: 'Deuxième molaire temporaire inf. droite' },
};

const TOOTH_NAMES = Object.fromEntries(
  Object.entries(TOOTH_DEFAULTS).map(([k, v]) => [k, v.name])
);

const CLINICAL_STATUSES = [
  { id: 'healthy', label: 'Saine', color: '#10b981', bg: '#ecfdf5', icon: '✓', desc: 'Émail sain' },
  { id: 'caries', label: 'Carie / Lésion', color: '#ef4444', bg: '#fef2f2', icon: '●', desc: 'Cavité à soigner' },
  { id: 'treated', label: 'Soignée / Obturée', color: '#3b82f6', bg: '#eff6ff', icon: '■', desc: 'Composite / Amalgame' },
  { id: 'devitalized', label: 'Dévitalisée (Endo)', color: '#9333ea', bg: '#f3e8ff', icon: '⚡', desc: 'Couronne violette / Endo' },
  { id: 'crown', label: 'Couronne / Prothèse', color: '#f59e0b', bg: '#fffbeb', icon: '👑', desc: 'Prothèse fixée' },
  { id: 'implant', label: 'Implant Titane', color: '#06b6d4', bg: '#ecfeff', icon: '🔩', desc: 'Vis implantaire' },
  { id: 'to_extract', label: 'À extraire', color: '#f97316', bg: '#fff7ed', icon: '⚠️', desc: 'Extraction indiquée' },
];

const PALETTE_TOOTH_TYPES = [
  { id: 'molar3', category: 'molar', roots: 3, label: 'Molaire (3 racines)', subtitle: 'Molaires sup. tri-furquées' },
  { id: 'molar2', category: 'molar', roots: 2, label: 'Molaire (2 racines)', subtitle: 'Molaires inf. bi-furquées' },
  { id: 'premolar', category: 'premolar', roots: 1, label: 'Prémolaire (1 racine)', subtitle: 'Bicuspide conique' },
  { id: 'canine', category: 'canine', roots: 1, label: 'Canine (Racine longue)', subtitle: 'Racine robuste' },
  { id: 'incisor', category: 'incisor', roots: 1, label: 'Incisive (1 racine)', subtitle: 'Bord tranchant' },
];

const DENTITION_FORMULAS = [
  {
    id: 'primary',
    label: '20 Dents (Enfant / Lactéale)',
    icon: '👶',
    badge: '20 dents',
    desc: 'Dentition temporaire (quadrants 51-55, 61-65, 71-75, 81-85). Recommandé pour les enfants de moins de 6 ans.',
  },
  {
    id: 'mixed',
    label: 'Mixte (Transition 6-12 ans)',
    icon: '🧒',
    badge: 'Transition',
    desc: 'Coexistence de dents lactéales et permanentes en phase de remplacement actif.',
  },
  {
    id: 'permanent28',
    label: '28 Dents (Jeune adulte)',
    icon: '🧑‍🦱',
    badge: '28 dents',
    desc: 'Arcade permanente complète sans les 4 dents de sagesse (18, 28, 38, 48 absentes).',
  },
  {
    id: 'permanent',
    label: '32 Dents (Adulte complète)',
    icon: '🧑',
    badge: '32 dents',
    desc: 'Formule permanente adulte intégrale incluant les 4 troisièmes molaires (sagesses).',
  },
  {
    id: 'edentulous',
    label: 'Édentement total (0 dent)',
    icon: '🦽',
    badge: '0 dent',
    desc: 'Arcade entièrement édentée pour planifier une prothèse amovible ou des implants All-on-4/6.',
  },
  {
    id: 'auto',
    label: 'Auto selon l\'âge',
    icon: '⚡',
    badge: 'Automatique',
    desc: 'Calcule et applique automatiquement la formule optimale selon la date de naissance enregistrée.',
  },
];

const PERMANENT_UPPER_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11];
const PERMANENT_UPPER_LEFT = [21, 22, 23, 24, 25, 26, 27, 28];
const PERMANENT_LOWER_RIGHT = [48, 47, 46, 45, 44, 43, 42, 41];
const PERMANENT_LOWER_LEFT = [31, 32, 33, 34, 35, 36, 37, 38];

const PRIMARY_UPPER_RIGHT = [55, 54, 53, 52, 51];
const PRIMARY_UPPER_LEFT = [61, 62, 63, 64, 65];
const PRIMARY_LOWER_RIGHT = [85, 84, 83, 82, 81];
const PRIMARY_LOWER_LEFT = [71, 72, 73, 74, 75];

function calculateAge(dobString) {
  if (!dobString) return null;
  const birth = new Date(dobString);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
    age--;
  }
  return age >= 0 ? age : null;
}

function getToothAnatomy(num, override = {}) {
  const def = TOOTH_DEFAULTS[num] || {
    category: num % 10 <= 2 ? 'incisor' : num % 10 === 3 ? 'canine' : num % 10 <= 5 ? 'premolar' : 'molar',
    roots: num % 10 >= 6 ? (num < 30 ? 3 : 2) : 1,
    name: `Dent #${num}`,
  };
  return {
    category: override.category || def.category,
    roots: override.roots !== undefined ? override.roots : def.roots,
    name: def.name,
  };
}

// =============================================================================
// REALISTIC ANATOMICAL TOOTH SVG COMPONENT
// =============================================================================

function RealisticToothSvg({
  num,
  status = 'healthy',
  category = 'molar',
  roots = 2,
  isUpper = false,
  isSelected = false,
  shelfTheme = 'teal',
}) {
  const rootIvory = '#ebdcba';
  const rootBorder = '#7a6b58';
  const canalStroke = status === 'devitalized' ? '#9333ea' : '#b8a892';

  let crownFill = '#ffffff';
  let crownStroke = '#334155';
  let crownHighlight = 'rgba(255,255,255,0.7)';

  if (status === 'caries') {
    crownFill = '#fee2e2';
    crownStroke = '#dc2626';
    crownHighlight = '#fca5a5';
  } else if (status === 'treated') {
    crownFill = '#dbeafe';
    crownStroke = '#2563eb';
    crownHighlight = '#93c5fd';
  } else if (status === 'devitalized') {
    crownFill = '#9333ea';
    crownStroke = '#581c87';
    crownHighlight = '#c084fc';
  } else if (status === 'crown') {
    crownFill = '#fef3c7';
    crownStroke = '#d97706';
    crownHighlight = '#fde68a';
  } else if (status === 'implant') {
    crownFill = '#ecfeff';
    crownStroke = '#0891b2';
    crownHighlight = '#a5f3fc';
  } else if (status === 'to_extract') {
    crownFill = '#ffedd5';
    crownStroke = '#ea580c';
    crownHighlight = '#fdba74';
  }

  const isDevitalized = status === 'devitalized';
  const isImplant = status === 'implant';

  // MANDIBULAR (LOWER ARCH)
  if (!isUpper) {
    return (
      <svg
        width="46"
        height="84"
        viewBox="0 0 48 84"
        style={{
          overflow: 'visible',
          filter: isSelected
            ? 'drop-shadow(0 0 6px rgba(59, 130, 246, 0.9))'
            : shelfTheme === 'teal'
            ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.35))'
            : 'drop-shadow(0 2px 3px rgba(0,0,0,0.12))',
        }}
      >
        {isImplant ? (
          <g>
            <path d="M 17 34 L 18 72 C 18 76, 30 76, 30 72 L 31 34 Z" fill="#94a3b8" stroke="#0891b2" strokeWidth="1.6" />
            {[40, 46, 52, 58, 64, 70].map((y) => (
              <line key={y} x1="15" y1={y} x2="33" y2={y} stroke="#0891b2" strokeWidth="1.5" strokeLinecap="round" />
            ))}
          </g>
        ) : roots === 3 ? (
          <g>
            <path
              d="M 7 34 C 5 48, 5 66, 11 79 C 13.5 80, 15 74, 17 62 C 18 52, 19 46, 20 46 C 21 52, 22 72, 24 81 C 26 72, 27 52, 28 46 C 29 46, 30 52, 31 62 C 33 74, 34.5 80, 37 79 C 43 66, 43 48, 41 34 C 30 36, 18 36, 7 34 Z"
              fill={rootIvory}
              stroke={rootBorder}
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <path d="M 12 38 C 10 50, 9 64, 12 76" stroke={canalStroke} strokeWidth="1.2" strokeLinecap="round" fill="none" />
            <path d="M 24 40 L 24 78" stroke={canalStroke} strokeWidth="1.2" strokeLinecap="round" fill="none" />
            <path d="M 36 38 C 38 50, 39 64, 36 76" stroke={canalStroke} strokeWidth="1.2" strokeLinecap="round" fill="none" />
          </g>
        ) : roots === 2 ? (
          <g>
            <path
              d="M 7 34 C 5 48, 5 66, 11 79 C 13.5 80, 16 79, 18 73 C 20.5 64, 22 52, 24 46 C 26 52, 27.5 64, 30 73 C 32 79, 34.5 80, 37 79 C 43 66, 43 48, 41 34 C 30 36, 18 36, 7 34 Z"
              fill={rootIvory}
              stroke={rootBorder}
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <path d="M 12 38 C 10 50, 9 64, 12 76" stroke={canalStroke} strokeWidth="1.3" strokeLinecap="round" fill="none" />
            <path d="M 36 38 C 38 50, 39 64, 36 76" stroke={canalStroke} strokeWidth="1.3" strokeLinecap="round" fill="none" />
          </g>
        ) : category === 'canine' ? (
          <g>
            <path
              d="M 12 34 C 11 48, 15 68, 24 82 C 33 68, 37 48, 36 34 C 29 36, 19 36, 12 34 Z"
              fill={rootIvory}
              stroke={rootBorder}
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <path d="M 24 38 L 24 78" stroke={canalStroke} strokeWidth="1.3" strokeLinecap="round" fill="none" />
          </g>
        ) : category === 'incisor' ? (
          <g>
            <path
              d="M 14 34 C 13 46, 17 64, 24 74 C 31 64, 35 46, 34 34 C 28 35.5, 20 35.5, 14 34 Z"
              fill={rootIvory}
              stroke={rootBorder}
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <path d="M 24 38 L 24 70" stroke={canalStroke} strokeWidth="1.2" strokeLinecap="round" fill="none" />
          </g>
        ) : (
          <g>
            <path
              d="M 11 34 C 10 46, 14 65, 24 76 C 34 65, 38 46, 37 34 C 29 36, 19 36, 11 34 Z"
              fill={rootIvory}
              stroke={rootBorder}
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <path d="M 24 38 L 24 72" stroke={canalStroke} strokeWidth="1.3" strokeLinecap="round" fill="none" />
          </g>
        )}

        {/* CROWN */}
        {category === 'molar' ? (
          <g>
            <path
              d="M 6 34 C 4 28, 4 16, 7 10 C 10 6, 15 6, 19 8.5 C 21.5 10, 26.5 10, 29 8.5 C 33 6, 38 6, 41 10 C 44 16, 44 28, 42 34 C 30 36, 18 36, 6 34 Z"
              fill={crownFill}
              stroke={crownStroke}
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <path
              d="M 11 16 Q 24 22 37 16 M 24 10 L 24 30"
              stroke={isDevitalized ? '#f3e8ff' : crownStroke}
              strokeWidth="1.2"
              strokeLinecap="round"
              fill="none"
              opacity={isDevitalized ? 0.6 : 0.4}
            />
          </g>
        ) : category === 'premolar' ? (
          <g>
            <path
              d="M 10 34 C 8 26, 8 16, 12 11 C 16 7, 20 7, 24 9 C 28 7, 32 7, 36 11 C 40 16, 40 26, 38 34 C 29 36, 19 36, 10 34 Z"
              fill={crownFill}
              stroke={crownStroke}
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <path
              d="M 15 18 Q 24 22 33 18 M 24 12 L 24 28"
              stroke={isDevitalized ? '#f3e8ff' : crownStroke}
              strokeWidth="1.2"
              strokeLinecap="round"
              fill="none"
              opacity={isDevitalized ? 0.6 : 0.4}
            />
          </g>
        ) : category === 'canine' ? (
          <g>
            <path
              d="M 11 34 C 9 26, 10 18, 14 12 C 18 8, 22 5, 24 5 C 26 5, 30 8, 34 12 C 38 18, 39 26, 37 34 C 29 36, 19 36, 11 34 Z"
              fill={crownFill}
              stroke={crownStroke}
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <path
              d="M 24 8 L 24 30"
              stroke={isDevitalized ? '#f3e8ff' : crownStroke}
              strokeWidth="1.2"
              strokeLinecap="round"
              fill="none"
              opacity={isDevitalized ? 0.6 : 0.4}
            />
          </g>
        ) : (
          <g>
            <path
              d="M 13 34 C 12 26, 12 16, 14 10 C 16 7, 19 7, 24 7 C 29 7, 32 7, 34 10 C 36 16, 36 26, 35 34 C 28 35.5, 20 35.5, 13 34 Z"
              fill={crownFill}
              stroke={crownStroke}
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <line
              x1="16"
              y1="11"
              x2="32"
              y2="11"
              stroke={isDevitalized ? '#f3e8ff' : crownStroke}
              strokeWidth="1.2"
              strokeLinecap="round"
              opacity={isDevitalized ? 0.6 : 0.4}
            />
          </g>
        )}

        {status === 'caries' && <circle cx="24" cy="20" r="3.5" fill="#991b1b" stroke="#7f1d1d" strokeWidth="1" />}
        {status === 'treated' && (
          <path d="M 18 18 Q 24 23 30 18 Q 27 26 24 26 Q 21 26 18 18 Z" fill="#60a5fa" stroke="#1d4ed8" strokeWidth="1" />
        )}
        {crownFill === '#ffffff' && (
          <path d="M 14 14 C 16 12, 20 11, 24 11" stroke={crownHighlight} strokeWidth="1.6" strokeLinecap="round" fill="none" />
        )}
      </svg>
    );
  }

  // MAXILLARY (UPPER ARCH)
  return (
    <svg
      width="46"
      height="84"
      viewBox="0 0 48 84"
      style={{
        overflow: 'visible',
        filter: isSelected
          ? 'drop-shadow(0 0 6px rgba(59, 130, 246, 0.9))'
          : shelfTheme === 'teal'
          ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.35))'
          : 'drop-shadow(0 2px 3px rgba(0,0,0,0.12))',
      }}
    >
      {isImplant ? (
        <g>
          <path d="M 17 50 L 18 12 C 18 8, 30 8, 30 12 L 31 50 Z" fill="#94a3b8" stroke="#0891b2" strokeWidth="1.6" />
          {[14, 20, 26, 32, 38, 44].map((y) => (
            <line key={y} x1="15" y1={y} x2="33" y2={y} stroke="#0891b2" strokeWidth="1.5" strokeLinecap="round" />
          ))}
        </g>
      ) : roots === 3 ? (
        <g>
          <path
            d="M 7 50 C 5 36, 5 18, 10 6 C 12.5 5, 14.5 7, 16 13 C 17.5 22, 18.5 32, 20 38 C 21 32, 22 18, 24 4 C 25 4, 26 4, 26 5 C 27 18, 28 32, 29 38 C 30.5 32, 31.5 22, 33 13 C 34.5 7, 36.5 5, 39 6 C 44 18, 44 36, 42 50 C 30 48, 18 48, 7 50 Z"
            fill={rootIvory}
            stroke={rootBorder}
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path d="M 12 46 C 10 34, 9 20, 11 8" stroke={canalStroke} strokeWidth="1.2" strokeLinecap="round" fill="none" />
          <path d="M 24 46 L 24 6" stroke={canalStroke} strokeWidth="1.2" strokeLinecap="round" fill="none" />
          <path d="M 36 46 C 38 34, 39 20, 37 8" stroke={canalStroke} strokeWidth="1.2" strokeLinecap="round" fill="none" />
        </g>
      ) : roots === 2 ? (
        <g>
          <path
            d="M 10 50 C 8 36, 9 20, 14 6 C 16.5 5, 18.5 7, 20.5 14 C 22.5 22, 23.5 32, 24 38 C 24.5 32, 25.5 22, 27.5 14 C 29.5 7, 31.5 5, 34 6 C 39 20, 40 36, 38 50 C 29 48, 19 48, 10 50 Z"
            fill={rootIvory}
            stroke={rootBorder}
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path d="M 15 46 L 15 8" stroke={canalStroke} strokeWidth="1.3" strokeLinecap="round" fill="none" />
          <path d="M 33 46 L 33 8" stroke={canalStroke} strokeWidth="1.3" strokeLinecap="round" fill="none" />
        </g>
      ) : category === 'canine' ? (
        <g>
          <path
            d="M 12 50 C 11 36, 15 16, 24 4 C 33 16, 37 36, 36 50 C 29 48, 19 48, 12 50 Z"
            fill={rootIvory}
            stroke={rootBorder}
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path d="M 24 46 L 24 6" stroke={canalStroke} strokeWidth="1.3" strokeLinecap="round" fill="none" />
        </g>
      ) : (
        <g>
          <path
            d="M 13 50 C 12 38, 16 20, 24 10 C 32 20, 36 38, 35 50 C 28 48.5, 20 48.5, 13 50 Z"
            fill={rootIvory}
            stroke={rootBorder}
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path d="M 24 46 L 24 12" stroke={canalStroke} strokeWidth="1.3" strokeLinecap="round" fill="none" />
        </g>
      )}

      {/* CROWN */}
      {category === 'molar' ? (
        <g>
          <path
            d="M 6 50 C 4 56, 4 68, 7 74 C 10 78, 15 78, 19 75.5 C 21.5 74, 26.5 74, 29 75.5 C 33 78, 38 78, 41 74 C 44 68, 44 56, 42 50 C 30 48, 18 48, 6 50 Z"
            fill={crownFill}
            stroke={crownStroke}
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path
            d="M 11 68 Q 24 62 37 68 M 24 74 L 24 54"
            stroke={isDevitalized ? '#f3e8ff' : crownStroke}
            strokeWidth="1.2"
            strokeLinecap="round"
            fill="none"
            opacity={isDevitalized ? 0.6 : 0.4}
          />
        </g>
      ) : category === 'premolar' ? (
        <g>
          <path
            d="M 10 50 C 8 58, 8 68, 12 73 C 16 77, 20 77, 24 75 C 28 77, 32 77, 36 73 C 40 68, 40 58, 38 50 C 29 48, 19 48, 10 50 Z"
            fill={crownFill}
            stroke={crownStroke}
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path
            d="M 15 66 Q 24 62 33 66 M 24 72 L 24 56"
            stroke={isDevitalized ? '#f3e8ff' : crownStroke}
            strokeWidth="1.2"
            strokeLinecap="round"
            fill="none"
            opacity={isDevitalized ? 0.6 : 0.4}
          />
        </g>
      ) : category === 'canine' ? (
        <g>
          <path
            d="M 11 50 C 9 58, 10 66, 14 72 C 18 76, 22 79, 24 79 C 26 79, 30 76, 34 72 C 38 66, 39 58, 37 50 C 29 48, 19 48, 11 50 Z"
            fill={crownFill}
            stroke={crownStroke}
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path
            d="M 24 76 L 24 54"
            stroke={isDevitalized ? '#f3e8ff' : crownStroke}
            strokeWidth="1.2"
            strokeLinecap="round"
            fill="none"
            opacity={isDevitalized ? 0.6 : 0.4}
          />
        </g>
      ) : (
        <g>
          <path
            d="M 9 50 C 8 58, 8 68, 10 74 C 12 77, 16 77, 24 77 C 32 77, 36 77, 38 74 C 40 68, 40 58, 39 50 C 30 48.5, 18 48.5, 9 50 Z"
            fill={crownFill}
            stroke={crownStroke}
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <line
            x1="12"
            y1="74"
            x2="36"
            y2="74"
            stroke={isDevitalized ? '#f3e8ff' : crownStroke}
            strokeWidth="1.2"
            strokeLinecap="round"
            opacity={isDevitalized ? 0.6 : 0.4}
          />
        </g>
      )}

      {status === 'caries' && <circle cx="24" cy="64" r="3.5" fill="#991b1b" stroke="#7f1d1d" strokeWidth="1" />}
      {status === 'treated' && (
        <path d="M 18 66 Q 24 61 30 66 Q 27 58 24 58 Q 21 58 18 66 Z" fill="#60a5fa" stroke="#1d4ed8" strokeWidth="1" />
      )}
    </svg>
  );
}

// =============================================================================
// EMPTY / REMOVED TOOTH DROP-ZONE SLOT
// =============================================================================

function EmptyToothSlot({
  num,
  isUpper,
  onDropTooth,
  onClickRestore,
  isDragTarget,
  isEditMode,
  shelfTheme = 'teal',
}) {
  const isTeal = shelfTheme === 'teal';

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDropTooth && onDropTooth(num, e);
      }}
      onClick={onClickRestore}
      style={{
        display: 'flex',
        flexDirection: isUpper ? 'column' : 'column-reverse',
        alignItems: 'center',
        justifyContent: 'center',
        width: '46px',
        minHeight: '110px',
        padding: '4px 2px',
        borderRadius: '8px',
        cursor: 'pointer',
        border: isDragTarget
          ? '2px dashed #38bdf8'
          : isEditMode
          ? '1.5px dashed #f59e0b'
          : isTeal
          ? '1.5px dashed rgba(255,255,255,0.35)'
          : '1.5px dashed #cbd5e1',
        background: isDragTarget
          ? 'rgba(56, 189, 248, 0.25)'
          : isEditMode
          ? 'rgba(245, 158, 11, 0.12)'
          : isTeal
          ? 'rgba(0,0,0,0.18)'
          : 'rgba(241, 245, 249, 0.6)',
        transition: 'all 0.15s ease',
        userSelect: 'none',
      }}
      title={`Emplacement #${num} vide / absent\n${isEditMode ? 'Cliquez ou glissez pour activer cette place' : 'Dent absente'}`}
    >
      <span
        style={{
          fontSize: '11px',
          fontWeight: 700,
          color: isTeal ? '#e2e8f0' : '#64748b',
          marginBottom: isUpper ? '4px' : '0',
          marginTop: isUpper ? '0' : '4px',
          background: isTeal ? 'rgba(0,0,0,0.3)' : '#e2e8f0',
          padding: '1px 6px',
          borderRadius: '4px',
        }}
      >
        #{num}
      </span>

      <div
        style={{
          width: '38px',
          height: '70px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '6px',
          border: '1px dotted rgba(148, 163, 184, 0.5)',
          color: isTeal ? 'rgba(255,255,255,0.7)' : '#94a3b8',
        }}
      >
        <span style={{ fontSize: '15px', lineHeight: 1 }}>{isEditMode ? '➕' : '✕'}</span>
        <span style={{ fontSize: '9px', fontWeight: 600, marginTop: '3px', textAlign: 'center' }}>
          {isDragTarget ? 'Déposer' : isEditMode ? 'Activer' : 'Absent'}
        </span>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN INTERACTIVE TOOTH CONTAINER (Present Tooth)
// =============================================================================

function InteractiveTooth({
  num,
  status = 'healthy',
  category = 'molar',
  roots = 2,
  isUpper = false,
  isSelected = false,
  isEditMode = false,
  onClick,
  onRemove,
  shelfTheme = 'teal',
}) {
  const [hovered, setHovered] = useState(false);
  const statusConfig = CLINICAL_STATUSES.find((s) => s.id === status) || CLINICAL_STATUSES[0];
  const isTeal = shelfTheme === 'teal';

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: isUpper ? 'column' : 'column-reverse',
        alignItems: 'center',
        cursor: 'pointer',
        padding: '3px 2px',
        borderRadius: '8px',
        position: 'relative',
        transition: 'transform 0.15s ease, background 0.15s ease',
        transform: isSelected ? 'scale(1.08)' : hovered ? 'scale(1.04)' : 'none',
        background: isSelected
          ? isTeal
            ? 'rgba(255,255,255,0.2)'
            : '#edf4fb'
          : hovered
          ? isTeal
            ? 'rgba(255,255,255,0.1)'
            : 'rgba(0,0,0,0.03)'
          : 'transparent',
        border: isSelected
          ? '2px solid #38bdf8'
          : isEditMode
          ? '1.5px dashed rgba(56, 189, 248, 0.4)'
          : '2px solid transparent',
        userSelect: 'none',
      }}
      title={`Dent #${num} — ${TOOTH_DEFAULTS[num]?.name || 'Dent'}\nStatut : ${statusConfig.label} (${roots} racine${roots > 1 ? 's' : ''})`}
    >
      {/* Quick remove button (Visible in Edit Mode or on hover in Edit Mode) */}
      {isEditMode && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove && onRemove(num);
          }}
          style={{
            position: 'absolute',
            top: isUpper ? '-6px' : 'auto',
            bottom: isUpper ? 'auto' : '-6px',
            right: '-4px',
            width: '18px',
            height: '18px',
            borderRadius: '50%',
            background: '#ef4444',
            color: '#fff',
            border: 'none',
            fontSize: '10px',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
            zIndex: 10,
          }}
          title="Retirer cette dent (Marquer cet emplacement comme absent)"
        >
          ✕
        </button>
      )}

      {/* FDI Number Badge */}
      <span
        style={{
          fontSize: '11px',
          fontWeight: 800,
          color: isTeal ? '#ffffff' : isSelected ? 'var(--blue)' : 'var(--navy)',
          marginBottom: isUpper ? '3px' : '0',
          marginTop: isUpper ? '0' : '3px',
          background: isTeal
            ? isSelected
              ? '#0284c7'
              : 'rgba(0, 0, 0, 0.45)'
            : isSelected
            ? '#dbeafe'
            : '#f1f5f9',
          padding: '1px 5px',
          borderRadius: '4px',
          letterSpacing: '0.3px',
        }}
      >
        {num}
      </span>

      {/* Realistic Anatomical Tooth */}
      <RealisticToothSvg
        num={num}
        status={status}
        category={category}
        roots={roots}
        isUpper={isUpper}
        isSelected={isSelected}
        shelfTheme={shelfTheme}
      />

      {/* Status indicator dot */}
      <span
        style={{
          width: '7px',
          height: '7px',
          borderRadius: '50%',
          backgroundColor: statusConfig.color,
          marginTop: isUpper ? '3px' : '0',
          marginBottom: isUpper ? '0' : '3px',
          border: '1px solid rgba(255,255,255,0.7)',
        }}
      />
    </div>
  );
}

// =============================================================================
// MAIN DENTAL CHART COMPONENT
// =============================================================================

export default function DentalChart({
  patient,
  chartData = {},
  onSaveChart,
  onOpenTreatmentWithTooth,
  treatments = [],
}) {
  // Compute patient age dynamically from patient.age OR patient.dateOfBirth
  const patientAge = useMemo(() => {
    if (patient?.age !== undefined && patient?.age !== null) return patient.age;
    return calculateAge(patient?.dateOfBirth);
  }, [patient]);

  // Automatic age-based dentition formula
  const autoFormula = useMemo(() => {
    if (patientAge !== null) {
      if (patientAge < 6) return 'primary'; // Deciduous / 20 teeth
      if (patientAge <= 12) return 'mixed'; // Mixed dentition
      if (patientAge < 18) return 'permanent28'; // Permanent 28 teeth (no wisdom)
      return 'permanent'; // Full adult 32 teeth
    }
    return 'permanent';
  }, [patientAge]);

  // Dentition mode from saved chart data or 'auto'
  const [dentitionMode, setDentitionMode] = useState(chartData.dentitionMode || 'auto');
  const activeMode = dentitionMode === 'auto' ? autoFormula : dentitionMode;

  // Edit Mode state (Controlled via dedicated button)
  const [isEditMode, setIsEditMode] = useState(false);

  // Teeth states map: { [toothNum]: { status: 'healthy', notes: '', roots?: 1|2|3, category?: string } }
  const teethStates = chartData.teethStates || {};

  // Custom excluded teeth (missing, agenesis, extractions)
  const excludedTeeth = chartData.excludedTeeth || [];

  // Supernumerary custom added teeth
  const customAddedTeeth = chartData.customAddedTeeth || [];

  // Shelf Theme: 'teal' (matching user image) or 'neutral'
  const [shelfTheme, setShelfTheme] = useState('teal');

  // Selected tooth for inspector drawer/modal
  const [selectedTooth, setSelectedTooth] = useState(null);
  const [toothNoteDraft, setToothNoteDraft] = useState('');

  // Drag and Drop state
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragOverSlot, setDragOverSlot] = useState(null);

  // New custom tooth place input
  const [newPlaceNum, setNewPlaceNum] = useState('');
  const [newPlaceRoots, setNewPlaceRoots] = useState(2);
  const [newPlaceArch, setNewPlaceArch] = useState('lower');

  // Helper getters
  const getStatus = (toothNum) => teethStates[toothNum]?.status || 'healthy';
  const getNotes = (toothNum) => teethStates[toothNum]?.notes || '';
  const getToothData = (toothNum) => {
    const override = teethStates[toothNum] || {};
    return getToothAnatomy(toothNum, override);
  };

  // Selection handler
  const handleToothClick = (toothNum) => {
    setSelectedTooth(toothNum);
    setToothNoteDraft(getNotes(toothNum));
  };

  // Save chart wrapper
  const triggerSave = (newTeethStates, newExcluded, newCustom, newMode = dentitionMode) => {
    onSaveChart &&
      onSaveChart({
        dentitionMode: newMode,
        teethStates: newTeethStates ?? teethStates,
        excludedTeeth: newExcluded ?? excludedTeeth,
        customAddedTeeth: newCustom ?? customAddedTeeth,
      });
  };

  // Status changer
  const handleSetStatus = (toothNum, newStatus) => {
    const updated = {
      ...teethStates,
      [toothNum]: {
        ...(teethStates[toothNum] || {}),
        status: newStatus,
      },
    };
    triggerSave(updated, excludedTeeth, customAddedTeeth);
  };

  // Root count changer (1, 2, or 3 roots)
  const handleSetRoots = (toothNum, rootsCount) => {
    const updated = {
      ...teethStates,
      [toothNum]: {
        ...(teethStates[toothNum] || {}),
        roots: rootsCount,
      },
    };
    triggerSave(updated, excludedTeeth, customAddedTeeth);
  };

  // Notes saver
  const handleSaveToothNotes = () => {
    if (!selectedTooth) return;
    const updated = {
      ...teethStates,
      [selectedTooth]: {
        ...(teethStates[selectedTooth] || {}),
        notes: toothNoteDraft.trim(),
      },
    };
    triggerSave(updated, excludedTeeth, customAddedTeeth);
  };

  // Exclude tooth place (Remove)
  const handleRemovePlace = (toothNum) => {
    if (!excludedTeeth.includes(toothNum)) {
      const nextExcluded = [...excludedTeeth, toothNum];
      triggerSave(teethStates, nextExcluded, customAddedTeeth);
    }
  };

  // Activate / restore tooth place
  const handleActivatePlace = (toothNum, customAnatomy = null) => {
    const nextExcluded = excludedTeeth.filter((t) => t !== toothNum);
    let nextStates = teethStates;
    if (customAnatomy) {
      nextStates = {
        ...teethStates,
        [toothNum]: {
          ...(teethStates[toothNum] || {}),
          roots: customAnatomy.roots,
          category: customAnatomy.category,
        },
      };
    }
    triggerSave(nextStates, nextExcluded, customAddedTeeth);
  };

  // Formula switcher (from Edit Mode toggle)
  const handleSelectFormula = (formulaId) => {
    setDentitionMode(formulaId);
    let nextExcluded = excludedTeeth;

    if (formulaId === 'permanent28') {
      nextExcluded = Array.from(new Set([...excludedTeeth, 18, 28, 38, 48]));
    } else if (formulaId === 'permanent') {
      nextExcluded = excludedTeeth.filter((t) => ![18, 28, 38, 48].includes(t));
    } else if (formulaId === 'primary') {
      nextExcluded = [];
    } else if (formulaId === 'edentulous') {
      nextExcluded = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28, 31, 32, 33, 34, 35, 36, 37, 38, 41, 42, 43, 44, 45, 46, 47, 48];
    } else if (formulaId === 'auto') {
      if (autoFormula === 'permanent28') {
        nextExcluded = Array.from(new Set([...excludedTeeth, 18, 28, 38, 48]));
      } else {
        nextExcluded = excludedTeeth.filter((t) => ![18, 28, 38, 48].includes(t));
      }
    }

    triggerSave(teethStates, nextExcluded, customAddedTeeth, formulaId);
  };

  // Add custom / supernumerary tooth place
  const handleAddCustomPlace = () => {
    const num = parseInt(newPlaceNum.trim(), 10);
    if (!num || Number.isNaN(num)) return;
    if (customAddedTeeth.includes(num)) return;

    const nextCustom = [...customAddedTeeth, num];
    const category = newPlaceRoots === 3 ? 'molar' : newPlaceRoots === 2 ? 'molar' : 'premolar';
    const updatedStates = {
      ...teethStates,
      [num]: {
        roots: newPlaceRoots,
        category,
        isUpper: newPlaceArch === 'upper',
        status: 'healthy',
      },
    };
    setNewPlaceNum('');
    triggerSave(updatedStates, excludedTeeth, nextCustom);
  };

  const handleRemoveCustomPlace = (num) => {
    const nextCustom = customAddedTeeth.filter((t) => t !== num);
    triggerSave(teethStates, excludedTeeth, nextCustom);
  };

  // Drag and drop handlers
  const handleDragStartPreset = (e, preset) => {
    const payload = { type: 'preset', ...preset };
    setDraggedItem(payload);
    e.dataTransfer.setData('application/json', JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDragStartRemovedTooth = (e, toothNum) => {
    const payload = { type: 'removedTooth', toothNum };
    setDraggedItem(payload);
    e.dataTransfer.setData('application/json', JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDropOnSlot = (targetNum, e) => {
    setDragOverSlot(null);
    try {
      const raw = e.dataTransfer.getData('application/json');
      const data = raw ? JSON.parse(raw) : draggedItem;
      if (!data) return;

      if (data.type === 'removedTooth') {
        handleActivatePlace(targetNum);
      } else if (data.type === 'preset') {
        handleActivatePlace(targetNum, { roots: data.roots, category: data.category });
      }
    } catch {
      handleActivatePlace(targetNum);
    }
    setDraggedItem(null);
  };

  // Statistics
  const statsCounts = useMemo(() => {
    const counts = { healthy: 0, caries: 0, treated: 0, devitalized: 0, crown: 0, implant: 0, to_extract: 0 };
    Object.values(teethStates).forEach((item) => {
      const st = item?.status;
      if (counts[st] !== undefined) counts[st]++;
    });
    return counts;
  }, [teethStates]);

  // Selected tooth treatments
  const toothTreatments = useMemo(() => {
    if (!selectedTooth) return [];
    return treatments.filter((t) => {
      if (!t.toothNumbers) return false;
      const parts = t.toothNumbers.split(/[,\s-]+/).map((s) => s.trim());
      return parts.includes(String(selectedTooth));
    });
  }, [selectedTooth, treatments]);

  // Active formula details for display
  const activeFormulaConfig = useMemo(() => {
    return DENTITION_FORMULAS.find((f) => f.id === activeMode) || DENTITION_FORMULAS[3];
  }, [activeMode]);

  // Render tooth slot
  const renderToothSlot = (num, isUpper) => {
    const isExcluded = excludedTeeth.includes(num);
    const isDragTarget = dragOverSlot === num;

    if (isExcluded) {
      return (
        <div
          key={num}
          onDragEnter={() => setDragOverSlot(num)}
          onDragLeave={() => setDragOverSlot(null)}
        >
          <EmptyToothSlot
            num={num}
            isUpper={isUpper}
            isDragTarget={isDragTarget}
            isEditMode={isEditMode}
            shelfTheme={shelfTheme}
            onDropTooth={handleDropOnSlot}
            onClickRestore={() => {
              if (isEditMode) {
                handleActivatePlace(num);
              } else {
                handleToothClick(num);
              }
            }}
          />
        </div>
      );
    }

    const { category, roots } = getToothData(num);
    const status = getStatus(num);

    return (
      <div
        key={num}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        }}
        onDragEnter={() => setDragOverSlot(num)}
        onDragLeave={() => setDragOverSlot(null)}
        onDrop={(e) => handleDropOnSlot(num, e)}
        style={{
          borderRadius: '8px',
          outline: isDragTarget ? '2px dashed #38bdf8' : 'none',
          outlineOffset: '2px',
        }}
      >
        <InteractiveTooth
          num={num}
          status={status}
          category={category}
          roots={roots}
          isUpper={isUpper}
          isSelected={selectedTooth === num}
          isEditMode={isEditMode}
          shelfTheme={shelfTheme}
          onClick={() => handleToothClick(num)}
          onRemove={handleRemovePlace}
        />
      </div>
    );
  };

  return (
    <div className="card" style={{ padding: '22px', marginBottom: '22px', border: '1px solid var(--border)', background: '#fff' }}>
      {/* --------------------------------------------------------------------- */}
      {/* CLEAN HEADER (Standard Clinical View)                                 */}
      {/* --------------------------------------------------------------------- */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '22px' }}>🦷</span>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--navy)', margin: 0 }}>
              Schéma Dentaire &amp; Odontogramme
            </h3>
            <span
              className="pill"
              style={{
                background: isEditMode ? '#fef3c7' : 'var(--brand-soft)',
                color: isEditMode ? '#92400e' : 'var(--navy)',
                fontWeight: 700,
                fontSize: '11.5px',
              }}
            >
              {isEditMode ? '🛠️ Mode Édition Actif' : `${activeFormulaConfig.icon} ${activeFormulaConfig.label}`}
            </span>
            {dentitionMode === 'auto' && !isEditMode && (
              <span className="pill" style={{ background: '#ecfdf5', color: '#047857', fontSize: '11px', fontWeight: 600 }}>
                ⚡ Auto-détecté ({patientAge !== null ? `${patientAge} ans` : 'Âge'})
              </span>
            )}
          </div>
          <p className="muted" style={{ fontSize: '12px', marginTop: '3px', margin: 0 }}>
            {isEditMode
              ? 'Mode personnalisation actif : basculez de formule, ajoutez des emplacements ou glissez des types de dents.'
              : `${activeFormulaConfig.desc} Cliquez sur une dent pour ouvrir l'inspecteur.`}
          </p>
        </div>

        {/* Top Controls: Shelf Theme + EDIT MODE BUTTON */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Theme switcher */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#f1f5f9', padding: '3px', borderRadius: '8px' }}>
            <button
              type="button"
              className="button button-ghost"
              style={{
                padding: '4px 9px',
                fontSize: '11px',
                fontWeight: 600,
                borderRadius: '6px',
                background: shelfTheme === 'teal' ? '#0d9488' : 'transparent',
                color: shelfTheme === 'teal' ? '#fff' : 'var(--foreground)',
              }}
              onClick={() => setShelfTheme('teal')}
              title="Étagère clinique vert canard / teal"
            >
              🌿 Étagère Teal
            </button>
            <button
              type="button"
              className="button button-ghost"
              style={{
                padding: '4px 9px',
                fontSize: '11px',
                fontWeight: 600,
                borderRadius: '6px',
                background: shelfTheme === 'neutral' ? 'var(--navy)' : 'transparent',
                color: shelfTheme === 'neutral' ? '#fff' : 'var(--foreground)',
              }}
              onClick={() => setShelfTheme('neutral')}
              title="Fond neutre clair"
            >
              ⚪ Fond Neutre
            </button>
          </div>

          {/* DEDICATED EDIT MODE BUTTON */}
          {!isEditMode ? (
            <button
              type="button"
              className="button"
              onClick={() => setIsEditMode(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                fontSize: '12px',
                fontWeight: 700,
                backgroundColor: 'var(--navy)',
                color: '#fff',
                padding: '6px 14px',
                borderRadius: '8px',
              }}
            >
              <span>✏️</span> Modifier l'arcade (Mode Édition)
            </button>
          ) : (
            <button
              type="button"
              className="button"
              onClick={() => setIsEditMode(false)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                fontSize: '12px',
                fontWeight: 700,
                backgroundColor: '#059669',
                color: '#fff',
                padding: '6px 14px',
                borderRadius: '8px',
                boxShadow: '0 2px 5px rgba(5, 150, 105, 0.3)',
              }}
            >
              <span>✓</span> Terminer l'édition
            </button>
          )}
        </div>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* EDIT MODE PANEL (ONLY VISIBLE IN EDIT MODE)                           */}
      {/* --------------------------------------------------------------------- */}
      {isEditMode && (
        <div
          style={{
            background: '#f8fafc',
            border: '2px solid #38bdf8',
            borderRadius: '10px',
            padding: '16px',
            marginBottom: '16px',
            boxShadow: '0 4px 12px rgba(2, 132, 199, 0.08)',
          }}
        >
          {/* Banner Title */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>🛠️</span>
              <strong style={{ fontSize: '13.5px', color: 'var(--navy)' }}>
                Panneau d'Édition Anatomique de l'Arcade
              </strong>
            </div>
            <span className="muted" style={{ fontSize: '11.5px' }}>
              Personnalisez les formules dentaires, ajoutez des emplacements ou glissez des racines.
            </span>
          </div>

          {/* 1. DENTITION FORMULAS TOGGLE */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: 'var(--navy)', marginBottom: '8px' }}>
              1. Formules &amp; Modes de dentition :
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
              {DENTITION_FORMULAS.map((f) => {
                const isActive = dentitionMode === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => handleSelectFormula(f.id)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: isActive ? '2px solid #0284c7' : '1px solid #cbd5e1',
                      background: isActive ? '#e0f2fe' : '#ffffff',
                      color: isActive ? '#0369a1' : 'var(--foreground)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '12px' }}>
                      <span>{f.icon}</span>
                      <span>{f.label}</span>
                    </div>
                    <span style={{ fontSize: '10px', opacity: 0.8, marginTop: '3px' }}>
                      {f.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. DRAGGABLE ANATOMICAL PALETTE */}
          <div style={{ marginBottom: '14px', borderTop: '1px dashed #cbd5e1', paddingTop: '12px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: 'var(--navy)', marginBottom: '8px' }}>
              2. Palette Anatomique (Glisser-Déposer pour définir racines et forme) :
            </label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {PALETTE_TOOTH_TYPES.map((pt) => (
                <div
                  key={pt.id}
                  draggable="true"
                  onDragStart={(e) => handleDragStartPreset(e, pt)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 12px',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    cursor: 'grab',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                    transition: 'all 0.15s ease',
                  }}
                  title={`Glisser sur un emplacement pour appliquer :\n${pt.label}`}
                >
                  <span style={{ fontSize: '14px' }}>🦷</span>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--navy)', lineHeight: 1.2 }}>
                      {pt.label}
                    </div>
                    <div className="muted" style={{ fontSize: '10px' }}>
                      {pt.subtitle}
                    </div>
                  </div>
                  <span style={{ fontSize: '10px', color: '#94a3b8' }}>⋮⋮</span>
                </div>
              ))}
            </div>
          </div>

          {/* 3. ADDING TOOTH PLACES & RESTORING EXCLUDED TEETH */}
          <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
            {/* Create custom tooth place */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '12px' }}>
              <strong style={{ color: 'var(--navy)' }}>Ajouter un emplacement de dent (FDI) :</strong>
              <input
                type="number"
                placeholder="N° FDI (ex: 19)"
                value={newPlaceNum}
                onChange={(e) => setNewPlaceNum(e.target.value)}
                style={{ width: '85px', padding: '4px 6px', fontSize: '12px' }}
              />
              <select
                value={newPlaceRoots}
                onChange={(e) => setNewPlaceRoots(parseInt(e.target.value, 10))}
                style={{ padding: '4px 6px', fontSize: '12px' }}
              >
                <option value={1}>1 Racine</option>
                <option value={2}>2 Racines</option>
                <option value={3}>3 Racines</option>
              </select>
              <select
                value={newPlaceArch}
                onChange={(e) => setNewPlaceArch(e.target.value)}
                style={{ padding: '4px 6px', fontSize: '12px' }}
              >
                <option value="upper">Maxillaire (Haut)</option>
                <option value="lower">Mandibulaire (Bas)</option>
              </select>
              <button
                type="button"
                className="button button-subtle"
                style={{ fontSize: '11.5px', padding: '4px 10px' }}
                onClick={handleAddCustomPlace}
              >
                + Créer l'emplacement
              </button>
            </div>

            {/* List of currently missing/excluded teeth */}
            {excludedTeeth.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#dc2626' }}>
                  Places absentes ({excludedTeeth.length}) :
                </span>
                {excludedTeeth.slice(0, 8).map((num) => (
                  <span
                    key={num}
                    draggable="true"
                    onDragStart={(e) => handleDragStartRemovedTooth(e, num)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '2px 6px',
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: '4px',
                      fontSize: '11px',
                      color: '#b91c1c',
                      fontWeight: 600,
                      cursor: 'grab',
                    }}
                    title="Glissez sur son emplacement ou cliquez pour restaurer"
                  >
                    <span>#{num}</span>
                    <button
                      type="button"
                      onClick={() => handleActivatePlace(num)}
                      style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '11px', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                      title="Activer cette place"
                    >
                      +
                    </button>
                  </span>
                ))}
                {excludedTeeth.length > 8 && (
                  <span className="muted" style={{ fontSize: '11px' }}>+{excludedTeeth.length - 8} autres</span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* ODONTOGRAM / DENTAL SHELF CONTAINER                                  */}
      {/* --------------------------------------------------------------------- */}
      <div
        style={{
          background:
            shelfTheme === 'teal'
              ? 'linear-gradient(180deg, #0d9488 0%, #115e59 100%)'
              : 'radial-gradient(ellipse at center, #ffffff 0%, #f8fafc 100%)',
          border: isEditMode
            ? '2px dashed #0284c7'
            : shelfTheme === 'teal'
            ? '2px solid #0f766e'
            : '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '24px 16px',
          marginBottom: '16px',
          overflowX: 'auto',
          boxShadow: shelfTheme === 'teal' ? 'inset 0 2px 6px rgba(0,0,0,0.2)' : 'none',
          position: 'relative',
        }}
      >
        {/* TOP QUADRANT LABELS */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '0 20px',
            marginBottom: '10px',
            fontSize: '11px',
            fontWeight: 800,
            color: shelfTheme === 'teal' ? 'rgba(255,255,255,0.85)' : 'var(--muted-foreground)',
            letterSpacing: '0.6px',
          }}
        >
          <span>DROITE (PATIENT) — CADRAN 1 / 4</span>
          <span style={{ color: shelfTheme === 'teal' ? '#ffffff' : 'var(--navy)', textTransform: 'uppercase' }}>
            ARCADE MAXILLAIRE (SUPÉRIEURE)
          </span>
          <span>GAUCHE (PATIENT) — CADRAN 2 / 3</span>
        </div>

        {/* =================================================================== */}
        {/* UPPER ARCH (MAXILLA)                                               */}
        {/* =================================================================== */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: '14px', marginBottom: '12px' }}>
          {/* Quadrant 1 (Upper Right) */}
          <div style={{ display: 'flex', gap: '3px', justifyContent: 'flex-end' }}>
            {(activeMode === 'primary' ? PRIMARY_UPPER_RIGHT : PERMANENT_UPPER_RIGHT).map((num) =>
              renderToothSlot(num, true)
            )}
          </div>

          {/* Central Midline separator */}
          <div
            style={{
              width: '2px',
              height: '90px',
              background: shelfTheme === 'teal' ? 'rgba(255,255,255,0.4)' : '#cbd5e1',
              position: 'relative',
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: '-16px',
                left: '50%',
                transform: 'translateX(-50%)',
                fontSize: '9px',
                fontWeight: 800,
                color: shelfTheme === 'teal' ? 'rgba(255,255,255,0.7)' : '#94a3b8',
              }}
            >
              |
            </span>
          </div>

          {/* Quadrant 2 (Upper Left) */}
          <div style={{ display: 'flex', gap: '3px', justifyContent: 'flex-start' }}>
            {(activeMode === 'primary' ? PRIMARY_UPPER_LEFT : PERMANENT_UPPER_LEFT).map((num) =>
              renderToothSlot(num, true)
            )}
          </div>
        </div>

        {/* MIXED DENTITION DECIDUOUS ROW */}
        {activeMode === 'mixed' && (
          <div
            style={{
              borderTop: '1px dashed rgba(255,255,255,0.3)',
              borderBottom: '1px dashed rgba(255,255,255,0.3)',
              padding: '12px 0',
              margin: '12px 0',
              background: shelfTheme === 'teal' ? 'rgba(0,0,0,0.15)' : 'rgba(254, 243, 199, 0.3)',
              borderRadius: '8px',
            }}
          >
            <div
              style={{
                textAlign: 'center',
                fontSize: '11px',
                fontWeight: 800,
                color: shelfTheme === 'teal' ? '#fed7aa' : '#b45309',
                marginBottom: '6px',
                letterSpacing: '0.5px',
              }}
            >
              DENTS TEMPORAIRES / LACTÉALES EN TRANSITION
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '20px' }}>
              <div style={{ display: 'flex', gap: '3px' }}>
                {PRIMARY_UPPER_RIGHT.map((num) => renderToothSlot(num, true))}
              </div>
              <div style={{ width: '2px', height: '80px', background: '#f59e0b', opacity: 0.5 }} />
              <div style={{ display: 'flex', gap: '3px' }}>
                {PRIMARY_UPPER_LEFT.map((num) => renderToothSlot(num, true))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '8px' }}>
              <div style={{ display: 'flex', gap: '3px' }}>
                {PRIMARY_LOWER_RIGHT.map((num) => renderToothSlot(num, false))}
              </div>
              <div style={{ width: '2px', height: '80px', background: '#f59e0b', opacity: 0.5 }} />
              <div style={{ display: 'flex', gap: '3px' }}>
                {PRIMARY_LOWER_LEFT.map((num) => renderToothSlot(num, false))}
              </div>
            </div>
          </div>
        )}

        {/* OCCLUSAL MID-PLANE SEPARATOR */}
        <div style={{ display: 'flex', alignItems: 'center', margin: '10px 0', opacity: 0.7 }}>
          <div style={{ flex: 1, borderTop: shelfTheme === 'teal' ? '1px dashed rgba(255,255,255,0.4)' : '1px dashed #94a3b8' }} />
          <span
            style={{
              padding: '0 14px',
              fontSize: '10px',
              color: shelfTheme === 'teal' ? '#ffffff' : 'var(--muted-foreground)',
              fontWeight: 700,
              letterSpacing: '1px',
            }}
          >
            PLAN D'OCCLUSION
          </span>
          <div style={{ flex: 1, borderTop: shelfTheme === 'teal' ? '1px dashed rgba(255,255,255,0.4)' : '1px dashed #94a3b8' }} />
        </div>

        {/* =================================================================== */}
        {/* LOWER ARCH (MANDIBLE)                                              */}
        {/* =================================================================== */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', gap: '14px', marginTop: '12px' }}>
          {/* Quadrant 4 (Lower Right) */}
          <div style={{ display: 'flex', gap: '3px', justifyContent: 'flex-end' }}>
            {(activeMode === 'primary' ? PRIMARY_LOWER_RIGHT : PERMANENT_LOWER_RIGHT).map((num) =>
              renderToothSlot(num, false)
            )}
          </div>

          {/* Central Midline separator */}
          <div
            style={{
              width: '2px',
              height: '90px',
              background: shelfTheme === 'teal' ? 'rgba(255,255,255,0.4)' : '#cbd5e1',
              position: 'relative',
            }}
          >
            <span
              style={{
                position: 'absolute',
                bottom: '-16px',
                left: '50%',
                transform: 'translateX(-50%)',
                fontSize: '9px',
                fontWeight: 800,
                color: shelfTheme === 'teal' ? 'rgba(255,255,255,0.7)' : '#94a3b8',
              }}
            >
              |
            </span>
          </div>

          {/* Quadrant 3 (Lower Left) */}
          <div style={{ display: 'flex', gap: '3px', justifyContent: 'flex-start' }}>
            {(activeMode === 'primary' ? PRIMARY_LOWER_LEFT : PERMANENT_LOWER_LEFT).map((num) =>
              renderToothSlot(num, false)
            )}
          </div>
        </div>

        {/* MANDIBLE BOTTOM LABEL */}
        <div
          style={{
            textAlign: 'center',
            marginTop: '12px',
            fontSize: '11px',
            fontWeight: 800,
            color: shelfTheme === 'teal' ? '#ffffff' : 'var(--navy)',
            textTransform: 'uppercase',
            letterSpacing: '0.6px',
          }}
        >
          ARCADE MANDIBULAIRE (INFÉRIEURE)
        </div>

        {/* SUPERNUMERARY / CUSTOM ADDED TEETH ROW */}
        {customAddedTeeth.length > 0 && (
          <div
            style={{
              marginTop: '16px',
              paddingTop: '12px',
              borderTop: shelfTheme === 'teal' ? '1px dashed rgba(255,255,255,0.3)' : '1px dashed #cbd5e1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
            }}
          >
            <span style={{ fontSize: '11.5px', fontWeight: 800, color: shelfTheme === 'teal' ? '#fff' : 'var(--navy)' }}>
              Emplacements personnalisés / Dents surnuméraires :
            </span>
            {customAddedTeeth.map((num) => (
              <div key={num} style={{ position: 'relative' }}>
                <InteractiveTooth
                  num={num}
                  status={getStatus(num)}
                  category={getToothData(num).category}
                  roots={getToothData(num).roots}
                  isUpper={teethStates[num]?.isUpper ?? (num < 30 || (num > 50 && num < 70))}
                  isSelected={selectedTooth === num}
                  isEditMode={isEditMode}
                  shelfTheme={shelfTheme}
                  onClick={() => handleToothClick(num)}
                  onRemove={handleRemoveCustomPlace}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* STATUS LEGEND & COUNTERS                                              */}
      {/* --------------------------------------------------------------------- */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: '14px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {CLINICAL_STATUSES.map((st) => (
            <div
              key={st.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '11.5px',
                background: st.bg,
                color: st.color,
                padding: '3px 8px',
                borderRadius: '6px',
                fontWeight: 600,
                border: `1px solid ${st.color}30`,
              }}
            >
              <span>{st.icon}</span>
              <span>{st.label}</span>
              {statsCounts[st.id] > 0 && (
                <span
                  style={{
                    background: st.color,
                    color: '#fff',
                    borderRadius: '10px',
                    padding: '0 5px',
                    fontSize: '10px',
                    fontWeight: 700,
                  }}
                >
                  {statsCounts[st.id]}
                </span>
              )}
            </div>
          ))}
        </div>

        <span className="muted" style={{ fontSize: '11px' }}>
          💡 {isEditMode ? 'En mode édition, activez/retirez les places ou glissez les types de racines.' : 'Cliquez sur une dent pour ouvrir l\'inspecteur chairside.'}
        </span>
      </div>

      {/* ===================================================================== */}
      {/* TOOTH INSPECTOR MODAL                                                 */}
      {/* ===================================================================== */}
      {selectedTooth && (
        <div className="modal-overlay" onClick={() => setSelectedTooth(null)}>
          <div
            className="modal card"
            style={{ maxWidth: '540px', width: '94%', padding: '24px' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      fontSize: '18px',
                      fontWeight: 800,
                      color: 'var(--navy)',
                      background: '#edf4fb',
                      padding: '2px 8px',
                      borderRadius: '6px',
                    }}
                  >
                    Dent #{selectedTooth}
                  </span>
                  <span className="pill" style={{ textTransform: 'capitalize' }}>
                    {getToothData(selectedTooth).category}
                  </span>
                  <span className="pill" style={{ background: '#fef3c7', color: '#b45309', fontWeight: 700 }}>
                    {getToothData(selectedTooth).roots} racine{getToothData(selectedTooth).roots > 1 ? 's' : ''}
                  </span>
                </div>
                <h4 style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--foreground)', marginTop: '5px', margin: '5px 0 0 0' }}>
                  {TOOTH_DEFAULTS[selectedTooth]?.name || `Dent #${selectedTooth}`}
                </h4>
              </div>

              <button
                type="button"
                className="button button-ghost"
                onClick={() => setSelectedTooth(null)}
              >
                ✕
              </button>
            </div>

            {/* Root Count Selector */}
            <div style={{ marginBottom: '16px', background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--navy)', marginBottom: '6px' }}>
                Anatomie radiculaire (Nombre de racines) :
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[1, 2, 3].map((r) => {
                  const currentRoots = getToothData(selectedTooth).roots;
                  const isActive = currentRoots === r;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => handleSetRoots(selectedTooth, r)}
                      style={{
                        flex: 1,
                        padding: '6px 8px',
                        fontSize: '12px',
                        fontWeight: isActive ? 700 : 500,
                        borderRadius: '6px',
                        border: isActive ? '2px solid var(--blue)' : '1px solid #cbd5e1',
                        background: isActive ? '#dbeafe' : '#ffffff',
                        color: isActive ? 'var(--blue)' : 'var(--foreground)',
                        cursor: 'pointer',
                      }}
                    >
                      {r} Racine{r > 1 ? 's' : ''}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Clinical Status Selector */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--navy)', marginBottom: '8px' }}>
                Statut clinique actuel de la dent :
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                {CLINICAL_STATUSES.map((st) => {
                  const isCurrent = getStatus(selectedTooth) === st.id;
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => handleSetStatus(selectedTooth, st.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: isCurrent ? `2px solid ${st.color}` : '1px solid #e2e8f0',
                        background: isCurrent ? st.bg : '#ffffff',
                        color: isCurrent ? st.color : 'var(--foreground)',
                        fontWeight: isCurrent ? 700 : 500,
                        fontSize: '12px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span style={{ fontSize: '14px' }}>{st.icon}</span>
                      <div>
                        <div>{st.label}</div>
                        <div style={{ fontSize: '10px', opacity: 0.75 }}>{st.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Observations / Notes */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--navy)', marginBottom: '6px' }}>
                Observations spécifiques à cette dent :
              </label>
              <textarea
                value={toothNoteDraft}
                onChange={(e) => setToothNoteDraft(e.target.value)}
                placeholder="ex: Fissure occlusale, poche parodontale 4mm, sensibilité percussion..."
                rows={2}
                style={{ width: '100%', fontSize: '12.5px' }}
              />
              <button
                type="button"
                className="button button-ghost"
                style={{ fontSize: '11.5px', padding: '3px 8px', marginTop: '4px' }}
                onClick={handleSaveToothNotes}
              >
                Enregistrer la note
              </button>
            </div>

            {/* Arch Presence Toggle (Remove / Retain) */}
            <div
              style={{
                padding: '8px 12px',
                background: '#f8fafc',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                marginBottom: '16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: '12px', color: 'var(--foreground)' }}>
                Présence sur l'arcade du patient :
              </span>
              <button
                type="button"
                className={`button ${excludedTeeth.includes(selectedTooth) ? 'button-danger' : 'button-subtle'}`}
                style={{ fontSize: '11px', padding: '3px 8px' }}
                onClick={() => {
                  if (excludedTeeth.includes(selectedTooth)) {
                    handleActivatePlace(selectedTooth);
                  } else {
                    handleRemovePlace(selectedTooth);
                    setSelectedTooth(null);
                  }
                }}
              >
                {excludedTeeth.includes(selectedTooth)
                  ? '↩ Réintégrer cette place'
                  : '✕ Retirer (Place absente)'}
              </button>
            </div>

            {/* Tooth Treatments History */}
            {toothTreatments.length > 0 && (
              <div style={{ marginBottom: '16px', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
                <h5 style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--navy)', marginBottom: '8px' }}>
                  Historique des soins réalisés sur cette dent ({toothTreatments.length}) :
                </h5>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '120px', overflowY: 'auto' }}>
                  {toothTreatments.map((tr) => (
                    <div
                      key={tr.id}
                      style={{
                        padding: '6px 10px',
                        background: '#f8fafc',
                        borderRadius: '4px',
                        fontSize: '12px',
                        display: 'flex',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <strong>{tr.actName}</strong>
                        {tr.notes && <div className="muted" style={{ fontSize: '11px' }}>{tr.notes}</div>}
                      </div>
                      <span className="muted" style={{ fontSize: '11px' }}>{tr.date}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
              <button
                type="button"
                className="button button-ghost"
                onClick={() => setSelectedTooth(null)}
              >
                Fermer
              </button>
              <button
                type="button"
                className="button"
                onClick={() => {
                  const tooth = selectedTooth;
                  setSelectedTooth(null);
                  onOpenTreatmentWithTooth && onOpenTreatmentWithTooth(tooth);
                }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <span>+</span> Enregistrer un soin pour #{selectedTooth}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

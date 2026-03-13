/**
 * Profanity Blocklist
 *
 * Dictionary of inappropriate words with severity levels:
 * - 'warn': Log but allow
 * - 'sanitize': Replace with asterisks
 * - 'block': Completely block the message
 */

import type { Blocklist } from './types.js';

export const blocklist: Blocklist = {
  // Severity levels determine action taken
  words: {
    // Sexual content - block
    'fuck': 'block',
    'shit': 'block',
    'bitch': 'block',
    'ass': 'sanitize',
    'asshole': 'block',
    'bastard': 'sanitize',
    'damn': 'warn',
    'hell': 'warn',
    'crap': 'warn',
    'dick': 'block',
    'cock': 'block',
    'pussy': 'block',
    'penis': 'sanitize',
    'vagina': 'sanitize',
    'sex': 'warn',
    'porn': 'block',
    'nude': 'sanitize',
    'naked': 'sanitize',

    // Slurs and hate speech - always block
    'nigger': 'block',
    'nigga': 'block',
    'faggot': 'block',
    'retard': 'block',
    'retarded': 'block',
    'gay': 'warn', // Context-dependent
    'homo': 'block',
    'tranny': 'block',

    // Violence - block
    'kill': 'sanitize',
    'murder': 'block',
    'rape': 'block',
    'abuse': 'warn',

    // Drugs - sanitize
    'cocaine': 'sanitize',
    'heroin': 'block',
    'meth': 'sanitize',
    'weed': 'warn',
    'marijuana': 'warn',
    'drug': 'warn',

    // Common variations and misspellings
    'fck': 'block',
    'fuk': 'block',
    'fuq': 'block',
    'shyt': 'block',
    'sht': 'block',
    'shiit': 'block',
    'shiiit': 'block',
    'fuuck': 'block',
    'fuuuck': 'block',
    'hel': 'warn',
    'heeel': 'warn',
    'btch': 'block',
    'azz': 'sanitize',
    'a55': 'sanitize',
    'dck': 'block',
    'dik': 'block',
  },

  // Common legitimate words that contain profanity substrings
  // These should NOT be flagged
  whitelist: [
    'hello',
    'shell',
    'shel',
    'password',
    'assassin',
    'assault',
    'assessment',
    'harassment',
    'ассоциация', // Russian for association
    'classic',
    'glass',
    'mass',
    'pass',
    'bass',
    'class',
    'grass',
    'harass',
    'embassy',
    'sassafras',
    'compass',
    'trespass',
    'bypass'
  ],

  // Patterns to detect (regex-based)
  patterns: [
    // Repeated characters
    /(.)\1{4,}/gi, // More than 4 repeated chars (e.g., 'aaaaaa')

    // All caps messages (often spam/abuse)
    /^[A-Z\s!@#$%^&*()]+$/, // All caps with 10+ chars
  ],

  // Configuration
  config: {
    // Should we check partial matches?
    checkPartialMatches: true,

    // Minimum word length for partial matching
    partialMatchMinLength: 4,

    // Should we normalize Unicode?
    normalizeUnicode: true,

    // Should we check leetspeak?
    checkLeetspeak: true,

    // Log all violations?
    logViolations: true
  }
};

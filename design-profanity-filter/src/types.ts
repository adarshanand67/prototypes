/**
 * Type definitions for the profanity filter system
 */

export type SeverityLevel = 'warn' | 'sanitize' | 'block';

export interface WordDictionary {
  [word: string]: SeverityLevel;
}

export interface BlocklistConfig {
  checkPartialMatches: boolean;
  partialMatchMinLength: number;
  normalizeUnicode: boolean;
  checkLeetspeak: boolean;
  logViolations: boolean;
}

export interface Blocklist {
  words: WordDictionary;
  whitelist: string[];
  patterns: RegExp[];
  config: BlocklistConfig;
}

export interface Violation {
  word: string;
  original: string;
  strategy: 'exact' | 'leetspeak' | 'obfuscation' | 'unicode' | 'partial';
  severity: SeverityLevel;
  position: number;
}

export interface FilterResult {
  clean: boolean;
  blocked: boolean;
  sanitized: string | null;
  violations: Violation[];
  severity: SeverityLevel | 'none';
}

export interface AnalysisResult {
  original: string;
  isClean: boolean;
  shouldBlock: boolean;
  sanitized: string | null;
  violationCount: number;
  violations: Violation[];
  severity: SeverityLevel | 'none';
}

export interface LeetspeakMap {
  [key: string]: string;
}

export interface HomoglyphMap {
  [key: string]: string;
}

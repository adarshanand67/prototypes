/**
 * Profanity Filter Engine
 *
 * Multi-strategy detection system for identifying and filtering profanity
 */
import type { Blocklist, FilterResult, AnalysisResult } from './types.js';
export declare class ProfanityFilter {
    private readonly blocklist;
    private readonly leetspeakMap;
    private readonly homoglyphs;
    constructor(blocklist: Blocklist);
    /**
     * Main filter method - checks message through all strategies
     */
    filter(message: string): FilterResult;
    /**
     * Strategy 1: Exact word matching
     */
    private detectExactMatch;
    /**
     * Strategy 2: Leetspeak detection
     * Converts leetspeak characters back to normal letters
     */
    private detectLeetspeak;
    /**
     * Strategy 3: Obfuscation detection
     * Detects words with inserted spaces, symbols, or repeated characters
     */
    private detectObfuscation;
    /**
     * Strategy 4: Unicode/homoglyph detection
     * Detects lookalike Unicode characters
     */
    private detectUnicode;
    /**
     * Strategy 5: Partial matching
     * Catches profanity embedded in longer words
     */
    private detectPartialMatch;
    /**
     * Check if profanity appears at word start (potential false positive)
     * E.g., "hell" at start of "hello" should not be flagged
     */
    private isAtWordStart;
    /**
     * Get the highest severity level from violations
     */
    private getHighestSeverity;
    /**
     * Sanitize message by replacing profanity with asterisks
     */
    private sanitizeMessage;
    /**
     * Check if message is clean (no profanity)
     */
    isClean(message: string): boolean;
    /**
     * Get detailed analysis of a message
     */
    analyze(message: string): AnalysisResult;
}
//# sourceMappingURL=profanity-filter.d.ts.map
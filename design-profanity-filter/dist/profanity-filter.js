/**
 * Profanity Filter Engine
 *
 * Multi-strategy detection system for identifying and filtering profanity
 */
export class ProfanityFilter {
    blocklist;
    leetspeakMap;
    homoglyphs;
    constructor(blocklist) {
        this.blocklist = blocklist;
        // Leetspeak character mappings
        this.leetspeakMap = {
            '@': 'a', '4': 'a', '∆': 'a',
            '8': 'b', '6': 'b',
            '(': 'c', '<': 'c', '{': 'c',
            '|)': 'd',
            '3': 'e', '€': 'e',
            '|=': 'f', 'ph': 'f',
            '9': 'g',
            '#': 'h', '|-|': 'h',
            '!': 'i', '|': 'i',
            '_|': 'j',
            '|<': 'k', '|{': 'k',
            '|_': 'l',
            '|v|': 'm', '/\\/\\': 'm',
            '|\\|': 'n',
            '0': 'o', '()': 'o',
            '|>': 'p', '|*': 'p',
            '()_': 'q',
            '|2': 'r',
            '$': 's', '5': 's', 'z': 's',
            '7': 't', '+': 't',
            '|_|': 'u', '\\/': 'v',
            '\\/\\/': 'w', 'vv': 'w',
            '><': 'x',
            '`/': 'y',
            '2': 'z'
        };
        // Unicode homoglyphs (lookalike characters)
        this.homoglyphs = {
            'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', // Cyrillic
            'х': 'x', 'у': 'y', 'ӏ': 'i',
            'ս': 'u', // Armenian
            'ａ': 'a', 'ｂ': 'b', 'ｃ': 'c', 'ｄ': 'd', 'ｅ': 'e', // Full-width
            'ｆ': 'f', 'ｇ': 'g', 'ｈ': 'h', 'ｉ': 'i', 'ｊ': 'j',
            'ｋ': 'k', 'ｌ': 'l', 'ｍ': 'm', 'ｎ': 'n', 'ｏ': 'o',
            'ｐ': 'p', 'ｑ': 'q', 'ｒ': 'r', 'ｓ': 's', 'ｔ': 't',
            'ｕ': 'u', 'ｖ': 'v', 'ｗ': 'w', 'ｘ': 'x', 'ｙ': 'y', 'ｚ': 'z'
        };
    }
    /**
     * Main filter method - checks message through all strategies
     */
    filter(message) {
        const result = {
            clean: true,
            blocked: false,
            sanitized: message,
            violations: [],
            severity: 'none'
        };
        if (!message || typeof message !== 'string') {
            return result;
        }
        // Run all detection strategies
        const detections = [
            this.detectExactMatch(message),
            this.detectLeetspeak(message),
            this.detectObfuscation(message),
            this.detectUnicode(message),
            this.detectPartialMatch(message)
        ];
        // Aggregate violations
        for (const detection of detections) {
            if (detection.violations.length > 0) {
                result.clean = false;
                result.violations.push(...detection.violations);
            }
        }
        // Determine severity and action
        if (result.violations.length > 0) {
            result.severity = this.getHighestSeverity(result.violations);
            if (result.severity === 'block') {
                result.blocked = true;
                result.sanitized = null;
            }
            else {
                result.sanitized = this.sanitizeMessage(message, result.violations);
            }
        }
        return result;
    }
    /**
     * Strategy 1: Exact word matching
     */
    detectExactMatch(message) {
        const violations = [];
        const normalized = message.toLowerCase();
        const words = normalized.split(/\s+/);
        for (const word of words) {
            // Remove punctuation from word boundaries
            const cleanWord = word.replace(/^[^\w]+|[^\w]+$/g, '');
            if (this.blocklist.words[cleanWord]) {
                violations.push({
                    word: cleanWord,
                    original: word,
                    strategy: 'exact',
                    severity: this.blocklist.words[cleanWord],
                    position: message.toLowerCase().indexOf(word)
                });
            }
        }
        return { violations };
    }
    /**
     * Strategy 2: Leetspeak detection
     * Converts leetspeak characters back to normal letters
     */
    detectLeetspeak(message) {
        const violations = [];
        let decoded = message.toLowerCase();
        // Apply leetspeak conversion (handle '1' as both 'i' and 'l')
        decoded = decoded
            .replace(/@/g, 'a')
            .replace(/4/g, 'a')
            .replace(/3/g, 'e')
            .replace(/0/g, 'o')
            .replace(/\$/g, 's')
            .replace(/5/g, 's')
            .replace(/7/g, 't')
            .replace(/\+/g, 't')
            .replace(/!/g, 'i')
            .replace(/\|/g, 'i');
        // Handle '1' as both 'i' and 'l' - check both possibilities
        const decoded1AsI = decoded.replace(/1/g, 'i');
        const decoded1AsL = decoded.replace(/1/g, 'l');
        // Check both versions
        const checkDecoded = (decodedText, originalMsg) => {
            const words = decodedText.split(/\s+/);
            words.forEach((word, idx) => {
                const cleanWord = word.replace(/^[^\w]+|[^\w]+$/g, '');
                if (this.blocklist.words[cleanWord]) {
                    const originalWords = originalMsg.split(/\s+/);
                    violations.push({
                        word: cleanWord,
                        original: originalWords[idx] || originalMsg,
                        strategy: 'leetspeak',
                        severity: this.blocklist.words[cleanWord],
                        position: idx
                    });
                }
            });
        };
        checkDecoded(decoded1AsI, message);
        checkDecoded(decoded1AsL, message);
        // Remove duplicates
        const seen = new Set();
        const uniqueViolations = violations.filter(v => {
            const key = `${v.word}-${v.original}`;
            if (seen.has(key))
                return false;
            seen.add(key);
            return true;
        });
        return { violations: uniqueViolations };
    }
    /**
     * Strategy 3: Obfuscation detection
     * Detects words with inserted spaces, symbols, or repeated characters
     */
    detectObfuscation(message) {
        const violations = [];
        const messageLower = message.toLowerCase();
        // Split into words and check each word individually
        const words = messageLower.split(/\s+/);
        words.forEach((word, idx) => {
            // Check if this word is whitelisted
            const normalizedWord = word.replace(/[^a-z]/g, '');
            const isWhitelisted = this.blocklist.whitelist &&
                this.blocklist.whitelist.some(w => normalizedWord === w.toLowerCase() ||
                    w.toLowerCase().includes(normalizedWord));
            if (isWhitelisted) {
                return;
            }
            // Try multiple strategies
            const strategies = [];
            // Strategy 1: Remove all non-alphanumeric, collapse to 1 char
            strategies.push(word
                .replace(/[^a-z0-9]/g, '')
                .replace(/(.)\1+/g, '$1'));
            // Strategy 2: Remove all non-alphanumeric, collapse 3+ to 2 chars
            strategies.push(word
                .replace(/[^a-z0-9]/g, '')
                .replace(/(.)\1{2,}/g, '$1$1'));
            // Strategy 3: Handle repeated symbols (e.g., "s**t" → try patterns like "s*t")
            if (/[*#@!+\-_]{2,}/.test(word)) {
                // Try matching against patterns
                Object.keys(this.blocklist.words).forEach(profanity => {
                    const pattern = profanity.split('').join('[*#@!+\\-_]*');
                    const regex = new RegExp(pattern, 'i');
                    if (regex.test(word)) {
                        strategies.push(profanity);
                    }
                });
            }
            // Strategy 4: Just remove all non-letters (keeps all letters)
            strategies.push(word.replace(/[^a-z]/g, ''));
            // Check each deobfuscated version
            strategies.forEach(deob => {
                Object.keys(this.blocklist.words).forEach(profanity => {
                    if (deob === profanity || (deob.length > profanity.length && deob.includes(profanity))) {
                        // Avoid duplicates
                        const alreadyAdded = violations.some(v => v.word === profanity && v.original === word);
                        if (!alreadyAdded) {
                            violations.push({
                                word: profanity,
                                original: word,
                                strategy: 'obfuscation',
                                severity: this.blocklist.words[profanity],
                                position: idx
                            });
                        }
                    }
                });
            });
        });
        return { violations };
    }
    /**
     * Strategy 4: Unicode/homoglyph detection
     * Detects lookalike Unicode characters
     */
    detectUnicode(message) {
        const violations = [];
        let normalized = message.toLowerCase();
        // Replace homoglyphs with ASCII equivalents
        Object.keys(this.homoglyphs).forEach(glyph => {
            const regex = new RegExp(glyph, 'g');
            normalized = normalized.replace(regex, this.homoglyphs[glyph]);
        });
        // Check normalized text for profanity
        const words = normalized.split(/\s+/);
        words.forEach((word, idx) => {
            const cleanWord = word.replace(/^[^\w]+|[^\w]+$/g, '');
            if (this.blocklist.words[cleanWord]) {
                violations.push({
                    word: cleanWord,
                    original: message.split(/\s+/)[idx],
                    strategy: 'unicode',
                    severity: this.blocklist.words[cleanWord],
                    position: idx
                });
            }
        });
        return { violations };
    }
    /**
     * Strategy 5: Partial matching
     * Catches profanity embedded in longer words
     */
    detectPartialMatch(message) {
        const violations = [];
        const normalized = message.toLowerCase().replace(/[^a-z]/g, '');
        // Check if the entire message is a whitelisted word
        const isWhitelistedMessage = this.blocklist.whitelist &&
            this.blocklist.whitelist.some(w => normalized === w.toLowerCase().replace(/[^a-z]/g, ''));
        if (isWhitelistedMessage) {
            return { violations };
        }
        Object.keys(this.blocklist.words).forEach(word => {
            if (word.length >= 4 && normalized.includes(word)) {
                // Check if it's a word boundary issue (e.g., "hell" in "hello")
                const wordIndex = normalized.indexOf(word);
                const isWordBoundary = this.isAtWordStart(normalized, word, wordIndex);
                if (!isWordBoundary) {
                    violations.push({
                        word: word,
                        original: message,
                        strategy: 'partial',
                        severity: this.blocklist.words[word],
                        position: wordIndex
                    });
                }
            }
        });
        return { violations };
    }
    /**
     * Check if profanity appears at word start (potential false positive)
     * E.g., "hell" at start of "hello" should not be flagged
     */
    isAtWordStart(text, profanity, position) {
        // If profanity is at position 0 and text is longer, it's likely a word prefix
        if (position === 0 && text.length > profanity.length) {
            // Common prefixes to ignore
            const commonSuffixes = ['o', 'y', 'ing', 'er', 'ed', 'ion', 'ish'];
            const remainder = text.substring(profanity.length);
            // If the remainder is a common suffix, it's likely a legitimate word
            if (commonSuffixes.some(suffix => remainder.startsWith(suffix))) {
                return true;
            }
        }
        return false;
    }
    /**
     * Get the highest severity level from violations
     */
    getHighestSeverity(violations) {
        const severityLevels = { 'warn': 1, 'sanitize': 2, 'block': 3 };
        let highest = 'warn';
        violations.forEach(v => {
            if (severityLevels[v.severity] > severityLevels[highest]) {
                highest = v.severity;
            }
        });
        return highest;
    }
    /**
     * Sanitize message by replacing profanity with asterisks
     */
    sanitizeMessage(message, violations) {
        let sanitized = message;
        // Replace each violation with asterisks
        violations.forEach(v => {
            if (v.original) {
                const regex = new RegExp(v.original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
                sanitized = sanitized.replace(regex, '*'.repeat(v.original.length));
            }
        });
        return sanitized;
    }
    /**
     * Check if message is clean (no profanity)
     */
    isClean(message) {
        return this.filter(message).clean;
    }
    /**
     * Get detailed analysis of a message
     */
    analyze(message) {
        const result = this.filter(message);
        return {
            original: message,
            isClean: result.clean,
            shouldBlock: result.blocked,
            sanitized: result.sanitized,
            violationCount: result.violations.length,
            violations: result.violations,
            severity: result.severity
        };
    }
}
//# sourceMappingURL=profanity-filter.js.map
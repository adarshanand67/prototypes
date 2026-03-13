/**
 * Comprehensive Test Suite for Profanity Filter
 *
 * Tests all detection strategies and edge cases
 */

const ProfanityFilter = require('./profanity-filter');
const blocklist = require('./blocklist');

// Initialize filter
const filter = new ProfanityFilter(blocklist);

// Test results
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

/**
 * Test helper function
 */
function test(description, message, expectedClean, expectedSeverity = null) {
  const result = filter.filter(message);
  const passed = result.clean === expectedClean &&
                 (!expectedSeverity || result.severity === expectedSeverity);

  results.tests.push({
    description,
    message,
    expectedClean,
    expectedSeverity,
    actualClean: result.clean,
    actualSeverity: result.severity,
    violations: result.violations,
    sanitized: result.sanitized,
    passed
  });

  if (passed) {
    results.passed++;
    console.log(`✅ PASS: ${description}`);
  } else {
    results.failed++;
    console.log(`❌ FAIL: ${description}`);
    console.log(`   Message: "${message}"`);
    console.log(`   Expected: clean=${expectedClean}, severity=${expectedSeverity}`);
    console.log(`   Got: clean=${result.clean}, severity=${result.severity}`);
    console.log(`   Violations:`, result.violations);
  }
}

console.log('='.repeat(80));
console.log('PROFANITY FILTER - COMPREHENSIVE TEST SUITE');
console.log('='.repeat(80));
console.log();

// ============================================================================
// TEST CATEGORY 1: Clean Messages (Should Pass)
// ============================================================================
console.log('📋 Category 1: Clean Messages');
console.log('-'.repeat(80));

test('Clean message #1', 'Hello, how are you?', true);
test('Clean message #2', 'This is a perfectly normal sentence.', true);
test('Clean message #3', 'I love programming!', true);
test('Clean message #4', 'The weather is nice today.', true);
test('Clean message #5', 'Let\'s meet at 5pm', true);
test('Clean message #6', 'assassin is a legitimate word', true); // Scunthorpe problem
test('Clean message #7', 'classic rock music', true); // Contains "ass"
test('Clean message #8', 'mass production', true);
test('Clean message #9', 'glass house', true);
test('Clean message #10', 'password authentication', true);

console.log();

// ============================================================================
// TEST CATEGORY 2: Exact Match Detection
// ============================================================================
console.log('📋 Category 2: Exact Match Detection');
console.log('-'.repeat(80));

test('Exact profanity #1', 'fuck', false, 'block');
test('Exact profanity #2', 'shit', false, 'block');
test('Exact profanity #3', 'This is shit', false, 'block');
test('Exact profanity #4', 'What the hell', false, 'warn');
test('Exact profanity #5', 'damn it', false, 'warn');
test('Exact profanity #6', 'you bitch', false, 'block');
test('Exact profanity #7', 'asshole', false, 'block');
test('Exact profanity #8', 'Multiple: fuck and shit', false, 'block');

console.log();

// ============================================================================
// TEST CATEGORY 3: Leetspeak Detection
// ============================================================================
console.log('📋 Category 3: Leetspeak Detection');
console.log('-'.repeat(80));

test('Leetspeak #1', 'a$$', false);
test('Leetspeak #2', 'a$$hole', false);
test('Leetspeak #3', 'sh1t', false);
test('Leetspeak #4', 'b1tch', false);
test('Leetspeak #5', 'fuk', false);
test('Leetspeak #6', 'h3ll', false);
test('Leetspeak #7', 'd@mn', false);
test('Leetspeak #8', 'a55hole', false);
test('Leetspeak #9', '5hit', false);
test('Leetspeak #10', 'Multiple: sh1t and a$$', false);

console.log();

// ============================================================================
// TEST CATEGORY 4: Obfuscation Detection
// ============================================================================
console.log('📋 Category 4: Obfuscation Detection (Spaces & Symbols)');
console.log('-'.repeat(80));

test('Obfuscation #1', 'f u c k', false);
test('Obfuscation #2', 's h i t', false);
test('Obfuscation #3', 'f*ck', false);
test('Obfuscation #4', 's**t', false);
test('Obfuscation #5', 'a-s-s', false);
test('Obfuscation #6', 'sh!t', false);
test('Obfuscation #7', 'f_u_c_k', false);
test('Obfuscation #8', 'b*tch', false);
test('Obfuscation #9', 's.h.i.t', false);
test('Obfuscation #10', 'f#ck', false);

console.log();

// ============================================================================
// TEST CATEGORY 5: Repeated Characters
// ============================================================================
console.log('📋 Category 5: Repeated Characters');
console.log('-'.repeat(80));

test('Repeated #1', 'shiiiit', false);
test('Repeated #2', 'fuuuuck', false);
test('Repeated #3', 'asssss', false);
test('Repeated #4', 'heeeell', false);
test('Repeated #5', 'bitchhhhh', false);
test('Repeated #6', 'shhhhhit', false);
test('Repeated #7', 'daaaaaamn', false);

console.log();

// ============================================================================
// TEST CATEGORY 6: Unicode/Homoglyph Detection
// ============================================================================
console.log('📋 Category 6: Unicode/Homoglyph Detection');
console.log('-'.repeat(80));

test('Unicode #1', 'аss (Cyrillic а)', false); // Cyrillic 'а' looks like Latin 'a'
test('Unicode #2', 'fսck (Armenian u)', false);
test('Unicode #3', 'ｆｕｃｋ (full-width)', false);
test('Unicode #4', 'ｓｈｉｔ (full-width)', false);

console.log();

// ============================================================================
// TEST CATEGORY 7: Partial Match Detection
// ============================================================================
console.log('📋 Category 7: Partial Match Detection');
console.log('-'.repeat(80));

test('Partial #1', 'fucking', false);
test('Partial #2', 'shitty', false);
test('Partial #3', 'badass', false);
test('Partial #4', 'bullshit', false);
test('Partial #5', 'dickhead', false);
test('Partial #6', 'bitchface', false);

console.log();

// ============================================================================
// TEST CATEGORY 8: Case Insensitivity
// ============================================================================
console.log('📋 Category 8: Case Insensitivity');
console.log('-'.repeat(80));

test('Case #1', 'FUCK', false);
test('Case #2', 'ShIt', false);
test('Case #3', 'BiTcH', false);
test('Case #4', 'AsS', false);
test('Case #5', 'DaMn', false);
test('Case #6', 'HeLl', false);

console.log();

// ============================================================================
// TEST CATEGORY 9: Multiple Profanities
// ============================================================================
console.log('📋 Category 9: Multiple Profanities');
console.log('-'.repeat(80));

test('Multiple #1', 'fuck shit damn', false, 'block');
test('Multiple #2', 'what the hell, you bitch', false, 'block');
test('Multiple #3', 'this is shit and ass', false, 'block');
test('Multiple #4', 'damn fuck hell', false, 'block');

console.log();

// ============================================================================
// TEST CATEGORY 10: Variations and Misspellings
// ============================================================================
console.log('📋 Category 10: Variations and Misspellings');
console.log('-'.repeat(80));

test('Variation #1', 'fck', false);
test('Variation #2', 'fuk', false);
test('Variation #3', 'fuq', false);
test('Variation #4', 'shyt', false);
test('Variation #5', 'sht', false);
test('Variation #6', 'btch', false);
test('Variation #7', 'azz', false);
test('Variation #8', 'dck', false);
test('Variation #9', 'dik', false);

console.log();

// ============================================================================
// TEST CATEGORY 11: Context Sensitivity (Difficult Cases)
// ============================================================================
console.log('📋 Category 11: Context Sensitivity');
console.log('-'.repeat(80));

test('Context #1', 'grass', true); // Contains "ass" but legitimate
test('Context #2', 'class', true);
test('Context #3', 'assessment', true);
test('Context #4', 'harassment', true);
test('Context #5', 'compass', true);
test('Context #6', 'bypass', true);

console.log();

// ============================================================================
// TEST CATEGORY 12: Edge Cases
// ============================================================================
console.log('📋 Category 12: Edge Cases');
console.log('-'.repeat(80));

test('Edge #1 (empty)', '', true);
test('Edge #2 (whitespace)', '   ', true);
test('Edge #3 (numbers)', '12345', true);
test('Edge #4 (symbols)', '@#$%^&*()', true);
test('Edge #5 (emoji)', '😀😂🎉', true);
test('Edge #6 (very long clean)', 'a'.repeat(1000), true);
test('Edge #7 (single letter)', 'a', true);

console.log();

// ============================================================================
// TEST CATEGORY 13: Real-World Examples
// ============================================================================
console.log('📋 Category 13: Real-World Examples');
console.log('-'.repeat(80));

test('Real #1', 'You are a fucking idiot!', false, 'block');
test('Real #2', 'Get the hell out of here!', false);
test('Real #3', 'This is some bullshit', false);
test('Real #4', 'What the actual fuck?', false, 'block');
test('Real #5', 'That\'s a load of crap', false);
test('Real #6', 'Shut the fuck up!', false, 'block');
test('Real #7', 'You stupid ass!', false);
test('Real #8', 'Go to hell!', false);

console.log();

// ============================================================================
// SUMMARY
// ============================================================================
console.log('='.repeat(80));
console.log('TEST SUMMARY');
console.log('='.repeat(80));
console.log(`Total Tests: ${results.passed + results.failed}`);
console.log(`✅ Passed: ${results.passed}`);
console.log(`❌ Failed: ${results.failed}`);
console.log(`Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(2)}%`);
console.log('='.repeat(80));

// Show failed tests details
if (results.failed > 0) {
  console.log();
  console.log('FAILED TESTS DETAILS:');
  console.log('-'.repeat(80));
  results.tests.filter(t => !t.passed).forEach(t => {
    console.log(`\n❌ ${t.description}`);
    console.log(`   Message: "${t.message}"`);
    console.log(`   Expected: clean=${t.expectedClean}, severity=${t.expectedSeverity}`);
    console.log(`   Got: clean=${t.actualClean}, severity=${t.actualSeverity}`);
    console.log(`   Violations: ${JSON.stringify(t.violations, null, 2)}`);
  });
}

console.log();

// Exit with error code if tests failed
process.exit(results.failed > 0 ? 1 : 0);

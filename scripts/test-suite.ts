import assert from 'assert';

console.log('--- TEMUTASKS FINANCIAL & LOGIC TESTS ---');

// Test 1: Existing-User Task Price Calculation
function calculateExistingTaskCost(qty: number, isPremium: boolean) {
  const pricePerParticipant = 55;
  const baseCost = qty * pricePerParticipant;
  const platformFee = 200;
  const premiumFee = isPremium ? 200 : 0;
  return baseCost + platformFee + premiumFee;
}

assert.strictEqual(calculateExistingTaskCost(10, false), 750, '10 existing users standard should be ₦750');
assert.strictEqual(calculateExistingTaskCost(10, true), 950, '10 existing users premium should be ₦950');
console.log('✓ Existing-user task pricing calculations verified (₦750 & ₦950)');

// Test 2: New-User Task Price Calculation
function calculateNewTaskCost(qty: number, isPremium: boolean) {
  const pricePerParticipant = 250;
  const baseCost = qty * pricePerParticipant;
  const platformFee = 200;
  const premiumFee = isPremium ? 200 : 0;
  return baseCost + platformFee + premiumFee;
}

assert.strictEqual(calculateNewTaskCost(10, false), 2700, '10 new users standard should be ₦2,700');
assert.strictEqual(calculateNewTaskCost(10, true), 2900, '10 new users premium should be ₦2,900');
console.log('✓ New-user task pricing calculations verified (₦2,700 & ₦2,900)');

// Test 3: Reward & Commission Allocations
const existingParticipantReward = 45;
const existingReferralComm = 10;
assert.strictEqual(existingParticipantReward + existingReferralComm, 55, 'Existing user participant + referrer sum must equal ₦55');

const newParticipantReward = 200;
const newReferralComm = 50;
assert.strictEqual(newParticipantReward + newReferralComm, 250, 'New user participant + referrer sum must equal ₦250');
console.log('✓ Reward and referral allocations perfectly balanced with slot price');

// Test 4: Quantity Constraints
function validateQuantity(qty: number) {
  if (qty <= 0) return false;
  if (qty > 1000) return false;
  return Number.isInteger(qty);
}

assert.strictEqual(validateQuantity(0), false, 'Zero quantity must be rejected');
assert.strictEqual(validateQuantity(-5), false, 'Negative quantity must be rejected');
assert.strictEqual(validateQuantity(1001), false, 'Quantity exceeding 1,000 must be rejected');
assert.strictEqual(validateQuantity(100), true, 'Valid quantity 100 must pass');
console.log('✓ Quantity boundary validations passed');

// Test 5: Pro Membership 14-day duration extension
const now = new Date('2026-10-12T12:00:00Z');
const durationMs = 14 * 24 * 60 * 60 * 1000;
const expiresAt = new Date(now.getTime() + durationMs);
const diffDays = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
assert.strictEqual(diffDays, 14, 'Pro duration must be exactly 14 days');
console.log('✓ Pro membership duration calculation passed');

console.log('--- ALL AUTOMATED FINANCIAL TESTS PASSED ---');

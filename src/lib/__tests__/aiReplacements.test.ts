/**
 * Test file for verifying AI replacement patterns in deepCleanSourceFile
 * This validates that proprietary AI services are correctly replaced with open-source alternatives
 */

import { deepCleanSourceFile } from '../clientProprietaryPatterns';

// Test file content with OpenAI imports
const openAITestCode = `
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function chat(message: string) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: message }],
  });
  return response.choices[0].message.content;
}
`;

// Test file content with Anthropic imports  
const anthropicTestCode = `
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function chat(message: string) {
  const response = await anthropic.messages.create({
    model: 'claude-3-opus-20240229',
    max_tokens: 1024,
    messages: [{ role: 'user', content: message }],
  });
  return response.content[0].text;
}
`;

// Test file content with Firebase imports
const firebaseTestCode = `
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
`;

// Test file content with multiple services
const mixedTestCode = `
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { Pinecone } from '@pinecone-database/pinecone';
import { useUser, SignIn, SignUp } from '@clerk/react';
import algoliasearch from 'algoliasearch';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const algolia = algoliasearch('APP_ID', 'API_KEY');
`;

// Run tests
export function runAIReplacementTests(): { passed: number; failed: number; results: string[] } {
  const results: string[] = [];
  let passed = 0;
  let failed = 0;

  // Test 1: OpenAI → Ollama
  const openAIResult = deepCleanSourceFile(openAITestCode, 'test-openai.ts');
  if (openAIResult.cleaned.includes('OLLAMA_BASE_URL') && 
      openAIResult.cleaned.includes('createChatCompletion') &&
      !openAIResult.cleaned.includes("from 'openai'")) {
    results.push('✅ OpenAI → Ollama: PASSED');
    passed++;
  } else {
    results.push('❌ OpenAI → Ollama: FAILED');
    failed++;
  }

  // Test 2: Anthropic → Ollama + Llama
  const anthropicResult = deepCleanSourceFile(anthropicTestCode, 'test-anthropic.ts');
  if (anthropicResult.cleaned.includes('OLLAMA_BASE_URL') && 
      anthropicResult.cleaned.includes('createMessage') &&
      anthropicResult.cleaned.includes('llama3.1:70b') &&
      !anthropicResult.cleaned.includes("from '@anthropic-ai/sdk'")) {
    results.push('✅ Anthropic → Ollama + Llama 3.1: PASSED');
    passed++;
  } else {
    results.push('❌ Anthropic → Ollama + Llama 3.1: FAILED');
    failed++;
  }

  // Test 3: Firebase → PocketBase
  const firebaseResult = deepCleanSourceFile(firebaseTestCode, 'test-firebase.ts');
  if (firebaseResult.cleaned.includes('PocketBase') && 
      firebaseResult.cleaned.includes('INOPAY:') &&
      !firebaseResult.cleaned.includes("from 'firebase/app'")) {
    results.push('✅ Firebase → PocketBase: PASSED');
    passed++;
  } else {
    results.push('❌ Firebase → PocketBase: FAILED');
    failed++;
  }

  // Test 4: Multiple services replacement
  const mixedResult = deepCleanSourceFile(mixedTestCode, 'test-mixed.ts');
  const mixedChecks = {
    ollama: mixedResult.cleaned.includes('OLLAMA_BASE_URL'),
    meilisearch: mixedResult.cleaned.includes('MeiliSearch'),
    supabaseAuth: mixedResult.cleaned.includes('Supabase Auth'),
    pgvector: mixedResult.cleaned.includes('pgvector'),
  };
  
  if (Object.values(mixedChecks).every(v => v)) {
    results.push('✅ Mixed services replacement: PASSED');
    passed++;
  } else {
    results.push(`❌ Mixed services replacement: FAILED (${JSON.stringify(mixedChecks)})`);
    failed++;
  }

  // Test 5: Changes are tracked
  if (openAIResult.changes.length > 0 && anthropicResult.changes.length > 0) {
    results.push('✅ Changes tracking: PASSED');
    passed++;
  } else {
    results.push('❌ Changes tracking: FAILED');
    failed++;
  }

  // Log results
  console.log('\n=== AI REPLACEMENT TESTS ===');
  results.forEach(r => console.log(r));
  console.log(`\nTotal: ${passed} passed, ${failed} failed`);
  console.log('=============================\n');

  return { passed, failed, results };
}

// Export test data for manual inspection
export const testCases = {
  openAITestCode,
  anthropicTestCode,
  firebaseTestCode,
  mixedTestCode,
};

// Single place where the app picks its AI implementation.
// Today: deterministic simulation (no API keys, no network). To integrate a
// real model later, implement `AIService` (see ./types) and return it here.
import { createSimulatedAI } from '@/services/ai/simulated';
import type { AIService } from '@/services/ai/types';

export const ai: AIService = createSimulatedAI();
export type { AIService } from '@/services/ai/types';

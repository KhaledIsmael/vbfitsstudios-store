import { supabase, adminSupabase } from './supabaseClient';

export interface ChatbotFaq {
  id: string;
  category: string;
  trigger_keywords: string[];
  question: string;
  answer: string;
  display_order: number;
  is_active: boolean;
}

export interface ChatbotLog {
  id?: string;
  session_id: string;
  user_message: string;
  matched_faq_id?: string | null;
  is_unmatched: boolean;
  is_human_handoff: boolean;
  created_at?: string;
}

/**
 * Gets a persistent anonymous session ID from localStorage.
 */
export function getChatSessionId(): string {
  let sessionId = localStorage.getItem('vbfits_chat_session_id');
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem('vbfits_chat_session_id', sessionId);
  }
  return sessionId;
}

/**
 * Fetches all active FAQs ordered by display_order.
 * Resilient: if the `category` column is missing from the DB,
 * it falls back gracefully and assigns a default category.
 */
export async function getChatbotFaqs(activeOnly: boolean = true): Promise<ChatbotFaq[]> {
  let query = supabase.from('chatbot_faqs').select('*');
  if (activeOnly) {
    query = query.eq('is_active', true);
  }
  const { data, error } = await query.order('display_order', { ascending: true });
  if (error) {
    console.error('Error fetching chatbot FAQs:', error);
    // If the error is about a missing column, retry without `category`
    if (error.message?.includes('column') || error.code === '42703') {
      const fallbackQuery = supabase
        .from('chatbot_faqs')
        .select('id, trigger_keywords, question, answer, display_order, is_active');
      if (activeOnly) {
        fallbackQuery.eq('is_active', true);
      }
      const { data: fallbackData, error: fallbackError } = await fallbackQuery.order('display_order', { ascending: true });
      if (fallbackError) {
        console.error('Fallback FAQ query also failed:', fallbackError);
        return [];
      }
      // Assign default category to each row
      return (fallbackData || []).map((row: any) => ({
        ...row,
        category: row.category || 'عام',
      })) as ChatbotFaq[];
    }
    return [];
  }
  // Ensure category field always has a value
  return (data || []).map((row: any) => ({
    ...row,
    category: row.category || 'عام',
  })) as ChatbotFaq[];
}

/**
 * Returns unique categories from a list of FAQs.
 */
export function getFaqCategories(faqs: ChatbotFaq[]): string[] {
  const seen = new Set<string>();
  const categories: string[] = [];
  for (const faq of faqs) {
    const cat = faq.category || 'عام';
    if (!seen.has(cat)) {
      seen.add(cat);
      categories.push(cat);
    }
  }
  return categories;
}

/**
 * Searches FAQs by keyword match against question, answer, and trigger_keywords.
 */
export function searchFaqs(faqs: ChatbotFaq[], query: string): ChatbotFaq[] {
  if (!query.trim()) return faqs;
  const lower = query.toLowerCase().trim();
  return faqs.filter((faq) => {
    const keywords = Array.isArray(faq.trigger_keywords) ? faq.trigger_keywords : [];
    return (
      faq.question.toLowerCase().includes(lower) ||
      faq.answer.toLowerCase().includes(lower) ||
      keywords.some((kw) => kw.toLowerCase().includes(lower))
    );
  });
}

/**
 * Finds the best FAQ match for a user message using keyword and fuzzy matching.
 */
export function findBestFaqMatch(faqs: ChatbotFaq[], userMessage: string): ChatbotFaq | null {
  const lower = userMessage.toLowerCase();

  // 1. Strict keyword match
  let match = faqs.find((faq) => {
    const keywords = Array.isArray(faq.trigger_keywords) ? faq.trigger_keywords : [];
    return keywords.some((kw) => lower.includes(kw.toLowerCase()));
  });
  if (match) return match;

  // 2. Fuzzy word match
  const words = lower.split(/\s+/).filter((w) => w.length > 2);
  let bestScore = 0;
  for (const faq of faqs) {
    const faqWords = faq.question.toLowerCase().split(/\s+/);
    const matchCount = words.filter((w) =>
      faqWords.some((fw) => fw.includes(w) || w.includes(fw))
    ).length;
    if (matchCount > bestScore && matchCount >= Math.min(2, words.length)) {
      bestScore = matchCount;
      match = faq;
    }
  }
  return match || null;
}

/**
 * Logs a chatbot interaction to the database.
 */
export async function logChatInteraction(
  userMessage: string,
  matchedFaqId: string | null = null,
  isUnmatched: boolean = false,
  isHumanHandoff: boolean = false
) {
  const sessionId = getChatSessionId();
  const { error } = await supabase.from('chatbot_logs').insert({
    session_id: sessionId,
    user_message: userMessage,
    matched_faq_id: matchedFaqId,
    is_unmatched: isUnmatched,
    is_human_handoff: isHumanHandoff,
  });
  if (error) console.error('Error logging chat interaction:', error);
}

/**
 * ADMIN: Upserts a FAQ (add or update)
 */
export async function upsertChatbotFaq(faq: Partial<ChatbotFaq>) {
  const { data, error } = await adminSupabase
    .from('chatbot_faqs')
    .upsert({ ...faq, updated_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw error;
  return data as ChatbotFaq;
}

/**
 * ADMIN: Delete a FAQ
 */
export async function deleteChatbotFaq(id: string) {
  const { error } = await adminSupabase.from('chatbot_faqs').delete().eq('id', id);
  if (error) throw error;
}

/**
 * ADMIN: Update display order of FAQs
 */
export async function updateFaqsOrder(faqs: ChatbotFaq[]) {
  const updates = faqs.map((faq, index) => ({
    id: faq.id,
    display_order: index,
  }));
  const { error } = await adminSupabase.from('chatbot_faqs').upsert(updates);
  if (error) throw error;
}

/**
 * ADMIN: Fetches recent conversation logs
 */
export async function getChatbotLogs(limit: number = 100): Promise<ChatbotLog[]> {
  const { data, error } = await adminSupabase
    .from('chatbot_logs')
    .select('*, chatbot_faqs(question)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('Error fetching chatbot logs:', error);
    return [];
  }
  return data as (ChatbotLog & { chatbot_faqs?: { question: string } })[];
}

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  getChatbotFaqs,
  getFaqCategories,
  searchFaqs,
  logChatInteraction,
  type ChatbotFaq,
} from '../../lib/chatbot';
import { BRAND_CONFIG } from '../../config/assets';
import { useAuth } from '../../context/AuthContext';
import { getUserOrders, type Order } from '../../lib/orders';



interface Message {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  isFallback?: boolean;
  orders?: Order[];
  isTyping?: boolean;
}

// ─── SVG Icon Components (no emoji policy) ────────────────────────────────────
const IconChat: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
);
const IconClose: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);
const IconSend: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
  </svg>
);
const IconSearch: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="m21 21-4.35-4.35" />
  </svg>
);
const IconWhatsApp: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);
const IconPackage: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
    <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
  </svg>
);
const IconRuler: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7l18 0M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7zM8 7v4M12 7v2M16 7v4" />
  </svg>
);
const IconTruck: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
    <rect x="1" y="3" width="15" height="13" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
    <circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" />
  </svg>
);
const IconRefresh: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
    <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
  </svg>
);
const IconCard: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" />
  </svg>
);
const IconShirt: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
    <path d="M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.34 2.23l.58 3.57a1 1 0 00.99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 002-2V10h2.15a1 1 0 00.99-.84l.58-3.57a2 2 0 00-1.34-2.23z" />
  </svg>
);
const IconDroplets: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
    <path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z" />
    <path d="M12.56 6.6A10.97 10.97 0 0014 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 01-11.91 4.97" />
  </svg>
);
const IconUser: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
);

// Category icon mapping
const CATEGORY_ICONS: Record<string, React.FC<{ className?: string }>> = {
  'المقاسات والمقاييس': IconRuler,
  'الشحن والتوصيل': IconTruck,
  'الإرجاع والاستبدال': IconRefresh,
  'الدفع والطلبات': IconCard,
  'المنتجات والتوفر': IconShirt,
  'العناية بالملابس': IconDroplets,
  'حسابي وطلباتي': IconUser,
  'default': IconPackage,
};

// ─── Mascot Robot SVG ─────────────────────────────────────────────────────────
const MascotRobot: React.FC<{ className?: string; isAnimated?: boolean }> = ({
  className = 'w-8 h-8',
  isAnimated = false,
}) => (
  <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Antenna */}
    <line x1="32" y1="4" x2="32" y2="12" stroke="#111" strokeWidth="2" strokeLinecap="round" />
    <circle cx="32" cy="4" r="2.5" fill="#111" className={isAnimated ? 'animate-pulse' : ''} />
    {/* Head */}
    <rect x="16" y="12" width="32" height="24" rx="6" fill="#111" />
    {/* Eyes */}
    <rect x="22" y="18" width="7" height="5" rx="2" fill="white" />
    <rect x="35" y="18" width="7" height="5" rx="2" fill="white" />
    <rect x={isAnimated ? "25" : "24"} y="19" width="3" height="3" rx="1" fill="#111" className="transition-all duration-300" />
    <rect x={isAnimated ? "38" : "37"} y="19" width="3" height="3" rx="1" fill="#111" className="transition-all duration-300" />
    {/* Mouth */}
    <rect x="23" y="27" width="18" height="3" rx="1.5" fill="#333" />
    <rect x="26" y="27" width="4" height="3" rx="1" fill="white" />
    <rect x="34" y="27" width="4" height="3" rx="1" fill="white" />
    {/* Neck */}
    <rect x="29" y="36" width="6" height="4" fill="#222" />
    {/* Body */}
    <rect x="14" y="40" width="36" height="20" rx="5" fill="#1a1a1a" />
    {/* Chest panel */}
    <rect x="22" y="44" width="20" height="10" rx="3" fill="#2a2a2a" />
    <circle cx="27" cy="49" r="2" fill="#555" />
    <circle cx="32" cy="49" r="2" fill="#555" />
    <circle cx="37" cy="49" r="2" fill="#555" />
    {/* Arms */}
    <rect x="4" y="41" width="10" height="16" rx="5" fill="#1a1a1a" />
    <rect x="50" y="41" width="10" height="16" rx="5" fill="#1a1a1a" />
  </svg>
);

// ─── Typing Indicator ─────────────────────────────────────────────────────────
const TypingIndicator: React.FC = () => (
  <div className="flex items-center gap-1 px-4 py-3">
    <div className="flex gap-1 items-center">
      <span
        className="w-2 h-2 rounded-full bg-gray-400 inline-block"
        style={{ animation: 'typing-bounce 1.2s ease-in-out infinite', animationDelay: '0ms' }}
      />
      <span
        className="w-2 h-2 rounded-full bg-gray-400 inline-block"
        style={{ animation: 'typing-bounce 1.2s ease-in-out infinite', animationDelay: '200ms' }}
      />
      <span
        className="w-2 h-2 rounded-full bg-gray-400 inline-block"
        style={{ animation: 'typing-bounce 1.2s ease-in-out infinite', animationDelay: '400ms' }}
      />
    </div>
  </div>
);

// ─── Order Card ───────────────────────────────────────────────────────────────
const OrderCard: React.FC<{ order: Order; onClick?: (o: Order) => void }> = ({ order, onClick }) => (
  <button
    onClick={() => onClick && onClick(order)}
    className="w-full block border border-gray-200 rounded-lg p-3 mt-2 hover:border-black transition-colors bg-white text-left"
  >
    <div className="flex justify-between items-start">
      <div>
        <p className="text-xs font-bold text-black uppercase tracking-wide">{order.id}</p>
        <p className="text-[10px] text-gray-500 mt-0.5">
          {new Date(order.date).toLocaleDateString('ar-EG')}
        </p>
      </div>
      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded uppercase tracking-wide ${
        order.status === 'delivered' ? 'bg-green-50 text-green-700' :
        order.status === 'shipped' ? 'bg-blue-50 text-blue-700' :
        'bg-gray-100 text-gray-600'
      }`}>
        {order.status}
      </span>
    </div>
    <p className="text-xs text-gray-700 mt-1">{order.total.toFixed(2)} {order.currency}</p>
  </button>
);

// ─── Main Widget ──────────────────────────────────────────────────────────────
export const FloatingChatWidget: React.FC = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [faqs, setFaqs] = useState<ChatbotFaq[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [view, setView] = useState<'home' | 'chat' | 'faq'>('home');
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load FAQs on mount
  useEffect(() => {
    getChatbotFaqs().then((data) => {
      setFaqs(data);
      setCategories(getFaqCategories(data));
    });
  }, []);

  // Scroll to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isThinking]);

  // Focus removed since input is removed

  const addMessage = useCallback((
    sender: 'user' | 'bot',
    text: string,
    options?: { isFallback?: boolean; orders?: Order[] }
  ) => {
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), sender, text, ...options },
    ]);
    if (sender === 'bot' && !isOpen) setHasNewMessage(true);
  }, [isOpen]);

  const typewriterReply = useCallback(async (text: string, options?: { isFallback?: boolean; orders?: Order[] }) => {
    setIsThinking(true);
    // Simulate thinking delay
    await new Promise((r) => setTimeout(r, 900 + Math.random() * 600));
    setIsThinking(false);
    addMessage('bot', text, options);
  }, [addMessage]);

  const handleOpen = () => {
    setIsOpen(true);
    setHasNewMessage(false);
    if (messages.length === 0) {
      setMessages([{
        id: 'welcome',
        sender: 'bot',
        text: 'مرحباً بك في VB Fits Studios. كيف يمكنني مساعدتك اليوم؟',
      }]);
    }
  };

  const handleFaqSelect = (faq: ChatbotFaq) => {
    setView('chat');
    addMessage('user', faq.question);
    logChatInteraction(faq.question, faq.id, false, false);

    const keywords = Array.isArray(faq.trigger_keywords) ? faq.trigger_keywords : [];
    const isTracking = keywords.some(k =>
      k.toLowerCase().includes('track') || k.toLowerCase().includes('تتبع')
    );

    if (isTracking) {
      handleTrackOrder(faq.answer);
    } else {
      typewriterReply(faq.answer);
    }
  };

  const handleTrackOrder = async (faqAnswer?: string) => {
    if (faqAnswer) await typewriterReply(faqAnswer);
    if (user) {
      setIsThinking(true);
      await new Promise((r) => setTimeout(r, 1000));
      const orders = await getUserOrders(user.id, user.email, user.phone);
      setIsThinking(false);
      if (orders && orders.length > 0) {
        addMessage('bot', 'وجدت هذه الطلبات في حسابك. اختر طلباً لعرض التفاصيل:', { orders: orders.slice(0, 3) });
      } else {
        await typewriterReply('لا توجد طلبات حديثة في حسابك.', { isFallback: true });
      }
    } else {
      await typewriterReply('عذراً، تتبع الطلبات متاح فقط للأعضاء المسجلين. يرجى تسجيل الدخول من قائمة الحساب، أو التحدث مع الدعم.');
    }
  };

  const handleOrderClick = async (order: Order) => {
    addMessage('user', `تفاصيل الطلب ${order.id}`);
    setIsThinking(true);
    await new Promise((r) => setTimeout(r, 800));
    setIsThinking(false);
    
    // Construct rich response
    const itemsList = order.items.map(i => `- ${i.name} (المقاس: ${i.size}) x${i.quantity}`).join('\n');
    const estimatedDelivery = order.status === 'delivered' 
      ? `تم التوصيل في ${new Date(order.deliveredAt || order.date).toLocaleDateString('ar-EG')}`
      : 'التوصيل المتوقع خلال 3-5 أيام عمل';
      
    const details = `📦 تفاصيل الطلب ${order.id}\n\nحالة الطلب: ${order.status}\nرقم التتبع: ${order.trackingNumber || 'غير متوفر بعد'}\n\nالمنتجات:\n${itemsList}\n\nالشحن: ${estimatedDelivery}\nالإجمالي: ${order.total.toFixed(2)} ${order.currency}`;
    
    addMessage('bot', details);
  };

  const whatsappUrl = `https://wa.me/${BRAND_CONFIG.whatsapp.phoneNumber}?text=${encodeURIComponent('مرحباً VB Fits Studios، أحتاج إلى مساعدة.')}`;

  const handleTalkToSupport = () => {
    setView('chat');
    addMessage('user', 'تحدث مع الدعم');
    typewriterReply('يمكنك التواصل مع فريق الدعم مباشرة عبر واتساب بالضغط على الرابط أدناه:', { isFallback: true });
  };

  const filteredFaqs = searchFaqs(
    activeCategory ? faqs.filter((f) => f.category === activeCategory) : faqs,
    searchQuery
  );

  const CategoryIcon = activeCategory ? (CATEGORY_ICONS[activeCategory] || CATEGORY_ICONS['default']) : CATEGORY_ICONS['default'];

  return (
    <>
      {/* ─── Keyframe styles ─────────────────────────── */}
      <style>{`
        @keyframes typing-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-6px); opacity: 1; }
        }
        @keyframes widget-slide-in {
          from { opacity: 0; transform: translateY(20px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes pulse-ring {
          0%   { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes message-in-bot {
          from { opacity: 0; transform: translateX(-12px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes message-in-user {
          from { opacity: 0; transform: translateX(12px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .chat-widget { animation: widget-slide-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) both; }
        .msg-bot { animation: message-in-bot 0.25s ease both; }
        .msg-user { animation: message-in-user 0.25s ease both; }
        .pulse-ring {
          position: absolute; inset: -4px; border-radius: 50%;
          border: 2px solid #111;
          animation: pulse-ring 2s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
        }
        .category-chip {
          transition: all 0.18s ease;
          white-space: nowrap;
        }
        .faq-item {
          transition: background 0.15s ease, border-color 0.15s ease;
        }
        .faq-item:hover { background: #f9f9f9; border-color: #111; }
      `}</style>

      {/* ─── Floating Trigger Button ──────────────────── */}
      <div className="fixed bottom-6 left-6 z-[90]">
        {!isOpen && (
          <button
            onClick={handleOpen}
            className="relative w-14 h-14 bg-black text-white rounded-full flex items-center justify-center shadow-2xl hover:scale-105 transition-transform duration-200"
            aria-label="فتح المساعد"
          >
            {/* Pulse rings */}
            <span className="pulse-ring" style={{ animationDelay: '0ms' }} />
            <span className="pulse-ring" style={{ animationDelay: '600ms' }} />
            <MascotRobot className="w-7 h-7" />
            {hasNewMessage && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-white" />
            )}
          </button>
        )}
      </div>

      {/* ─── Chat Drawer ──────────────────────────────── */}
      {isOpen && (
        <div
          className="chat-widget fixed bottom-6 left-6 z-[91] w-[360px] max-w-[calc(100vw-24px)] bg-white border border-gray-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          style={{ height: '560px', maxHeight: 'calc(100vh - 96px)' }}
        >
          {/* ── Header ── */}
          <div className="flex items-center gap-3 px-4 py-3.5 bg-black text-white flex-shrink-0">
            <div className="relative">
              <MascotRobot className="w-9 h-9" isAnimated />
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-black" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold tracking-wide">VB Assistant</p>
              <p className="text-[10px] text-gray-400">متصل الآن — عادةً يرد خلال ثوان</p>
            </div>
            <div className="flex items-center gap-1">
              {view !== 'home' && (
                <button
                  onClick={() => setView('home')}
                  className="flex items-center gap-1 p-1.5 rounded-lg hover:bg-white/10 transition-colors text-gray-300 hover:text-white"
                  aria-label="الرئيسية"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="text-[10px] font-semibold tracking-wider">رجوع</span>
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                aria-label="إغلاق"
              >
                <IconClose className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ── Home View ── */}
          {view === 'home' && (
            <div className="flex-1 overflow-y-auto">
              {/* Hero */}
              <div className="px-5 pt-5 pb-4 border-b border-gray-100">
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">مرحباً</p>
                <h2 className="text-lg font-bold text-black leading-snug">كيف يمكنني<br />مساعدتك اليوم؟</h2>
                <p className="text-xs text-gray-400 mt-1">اختر من الأسئلة الشائعة أو تحدث معنا مباشرةً</p>
              </div>

              {/* Quick Actions */}
              <div className="px-4 py-3 border-b border-gray-100 flex flex-col gap-2">
                <button
                  onClick={() => { setView('chat'); setTimeout(() => handleTrackOrder(), 200); }}
                  className="flex items-center gap-3 w-full p-3 border border-gray-200 rounded-xl text-left hover:border-black hover:bg-gray-50 transition-all"
                >
                  <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center flex-shrink-0">
                    <IconPackage className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-black">تتبع طلبي</p>
                    <p className="text-[10px] text-gray-400">اعرف حالة طلبك الآن</p>
                  </div>
                </button>
                <button
                  onClick={() => setView('faq')}
                  className="flex items-center gap-3 w-full p-3 border border-gray-200 rounded-xl text-left hover:border-black hover:bg-gray-50 transition-all"
                >
                  <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <IconChat className="w-4 h-4 text-black" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-black">الأسئلة الشائعة</p>
                    <p className="text-[10px] text-gray-400">تصفح الإجابات الجاهزة</p>
                  </div>
                </button>
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 w-full p-3 border border-gray-200 rounded-xl text-left hover:border-black hover:bg-gray-50 transition-all"
                >
                  <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <IconWhatsApp className="w-4 h-4 text-black" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-black">تحدث مع الدعم</p>
                    <p className="text-[10px] text-gray-400">تواصل معنا عبر واتساب</p>
                  </div>
                </a>
              </div>

              {/* Recent FAQs preview */}
              <div className="px-4 py-3">
                <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-2">أسئلة متكررة</p>
                {faqs.slice(0, 4).map((faq) => (
                  <button
                    key={faq.id}
                    onClick={() => handleFaqSelect(faq)}
                    className="faq-item w-full text-right px-3 py-2.5 rounded-lg border border-transparent text-xs text-black hover:border-gray-200 block mb-1"
                  >
                    {faq.question}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── FAQ Browse View ── */}
          {view === 'faq' && (
            <div className="flex-1 flex flex-col overflow-hidden">


              {/* Category chips */}
              {!searchQuery && (
                <div className="flex gap-2 px-4 py-2 overflow-x-auto border-b border-gray-100 flex-shrink-0" style={{ scrollbarWidth: 'none' }}>
                  <button
                    onClick={() => setActiveCategory(null)}
                    className={`category-chip px-3 py-1.5 rounded-full text-[10px] font-semibold border flex-shrink-0 ${
                      activeCategory === null
                        ? 'bg-black text-white border-black'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    الكل
                  </button>
                  {categories.map((cat) => {
                    const Icon = CATEGORY_ICONS[cat] || CATEGORY_ICONS['default'];
                    return (
                      <button
                        key={cat}
                        onClick={() => setActiveCategory(cat === activeCategory ? null : cat)}
                        className={`category-chip px-3 py-1.5 rounded-full text-[10px] font-semibold border flex-shrink-0 flex items-center gap-1.5 ${
                          activeCategory === cat
                            ? 'bg-black text-white border-black'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                        }`}
                      >
                        <Icon className="w-3 h-3" />
                        {cat}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* FAQ list */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5">
                {filteredFaqs.length === 0 && (
                  <div className="text-center py-8 text-gray-400 text-xs">
                    لا توجد أسئلة في هذا التصنيف حالياً.
                  </div>
                )}
                {filteredFaqs.map((faq) => (
                  <button
                    key={faq.id}
                    onClick={() => handleFaqSelect(faq)}
                    className="faq-item w-full text-right px-4 py-3 rounded-xl border border-gray-100 text-xs text-black block"
                  >
                    <span className="text-[10px] text-gray-400 block mb-0.5">{faq.category}</span>
                    {faq.question}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Chat View ── */}
          {view === 'chat' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.sender === 'bot' && (
                      <div className="w-7 h-7 rounded-full bg-black flex-shrink-0 flex items-center justify-center mr-2 mt-0.5">
                        <MascotRobot className="w-5 h-5" />
                      </div>
                    )}
                    <div className={`max-w-[80%] ${msg.sender === 'user' ? 'msg-user' : 'msg-bot'}`}>
                      <div className={`px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed whitespace-pre-line ${
                        msg.sender === 'user'
                          ? 'bg-black text-white rounded-br-md'
                          : 'bg-gray-100 text-black rounded-bl-md'
                      }`}>
                        {msg.text}
                      </div>
                      {/* Order cards */}
                      {msg.orders?.map((order) => (
                        <OrderCard key={order.id} order={order} onClick={handleOrderClick} />
                      ))}
                      {/* Fallback action */}
                      {msg.isFallback && (
                        <a
                          href={whatsappUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 mt-1.5 text-[10px] font-semibold text-green-700 hover:text-green-800 transition-colors"
                        >
                          <IconWhatsApp className="w-3 h-3" />
                          تحدث مع خدمة العملاء
                        </a>
                      )}
                    </div>
                  </div>
                ))}
                {/* Typing indicator */}
                {isThinking && (
                  <div className="flex justify-start items-end gap-2">
                    <div className="w-7 h-7 rounded-full bg-black flex-shrink-0 flex items-center justify-center">
                      <MascotRobot className="w-5 h-5" />
                    </div>
                    <div className="bg-gray-100 rounded-2xl rounded-bl-md">
                      <TypingIndicator />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* FAQ chips in chat */}
              {messages.length <= 2 && faqs.length > 0 && (
                <div className="px-4 pb-2 flex flex-wrap gap-1.5">
                  {faqs.slice(0, 3).map((faq) => (
                    <button
                      key={faq.id}
                      onClick={() => handleFaqSelect(faq)}
                      className="text-[10px] px-2.5 py-1.5 border border-gray-200 rounded-full text-gray-600 hover:border-black hover:text-black transition-colors"
                    >
                      {faq.question.length > 30 ? faq.question.slice(0, 30) + '...' : faq.question}
                    </button>
                  ))}
                </div>
              )}

              {/* Quick Options in Chat */}
              <div className="px-3 py-3 border-t border-gray-100 flex flex-wrap gap-2 justify-center bg-gray-50 flex-shrink-0">
                <button
                  onClick={() => setView('faq')}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-lg text-[10px] font-semibold text-black hover:border-black transition-colors shadow-sm"
                >
                  <IconSearch className="w-3.5 h-3.5" />
                  تصفح الأسئلة الشائعة
                </button>
                <button
                  onClick={handleTalkToSupport}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-lg text-[10px] font-semibold text-black hover:border-black transition-colors shadow-sm"
                >
                  <IconWhatsApp className="w-3.5 h-3.5" />
                  تحدث مع الدعم
                </button>
              </div>
            </div>
          )}

          {/* ── Footer: WhatsApp CTA (always visible) ── */}
          <div className="flex-shrink-0 border-t border-gray-100 px-4 py-2.5 flex items-center justify-between">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[10px] font-semibold text-green-700 hover:text-green-900 transition-colors"
            >
              <IconWhatsApp className="w-3.5 h-3.5" />
              تحدث مع فريق الدعم
            </a>
            <span className="text-[9px] text-gray-300">VB Fits Studios</span>
          </div>
        </div>
      )}
    </>
  );
};

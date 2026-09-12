import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Globe2, Heart, Loader2, MessageCircle, Send, Sparkles, Users, X } from "lucide-react";
import { ensureAnonymousAuth, supabase, type Conversation, type Message, type SessionProfile } from "@/lib/supabase";

type Language = "vi" | "en";
type Step = "welcome" | "gender" | "name" | "year" | "location" | "matching" | "chat";
type LegalPage = "privacy" | "terms" | null;
type Form = { gender: string; name: string; year: string; country: string; city: string };

const copy = {
  vi: {
    hello: "Random Stranger Chat",
    intro: "Một cuộc trò chuyện bất ngờ đang chờ bạn.",
    start: "Thử xem nào",
    gender: "Bạn là ai hôm nay?",
    name: "Tên bạn là gì?",
    year: "Bạn sinh năm nào?",
    yearHint: "Để tụi mình tìm người phù hợp theo lứa tuổi của bạn",
    location: "Bạn đang ở đâu?",
    locationHint: "Để tụi mình tìm người gần khu vực của bạn",
    continue: "Tiếp tục",
    back: "Quay lại",
    matching: "Đang tìm một người lạ",
    matchingHint: "Giữ cửa sổ này mở — chúng mình đang kết nối bạn với thế giới.",
    matched: "Bạn đã gặp một người lạ",
    send: "Gửi",
    placeholder: "Viết điều đầu tiên bạn muốn nói…",
    next: "Người khác",
    end: "Kết thúc",
    empty: "Hãy bắt đầu bằng một lời chào.",
    anonymous: "Ẩn danh",
    noName: "Tên của bạn",
  },
  en: {
    hello: "Random Stranger Chat",
    intro: "A surprising conversation is waiting for you.",
    start: "Try it out",
    gender: "Who are you today?",
    name: "What's your name?",
    year: "What year were you born?",
    yearHint: "So we can find someone in a similar age range",
    location: "Where are you?",
    locationHint: "So we can find someone near your part of the world",
    continue: "Continue",
    back: "Back",
    matching: "Finding a stranger",
    matchingHint: "Keep this window open — we're connecting you with the world.",
    matched: "You met a stranger",
    send: "Send",
    placeholder: "Write the first thing you want to say…",
    next: "Next stranger",
    end: "End",
    empty: "Start with a hello.",
    anonymous: "Anonymous",
    noName: "Your name",
  },
};

const countries = [
  ["US", "United States"], ["GB", "United Kingdom"], ["CA", "Canada"], ["AU", "Australia"],
  ["SG", "Singapore"], ["JP", "Japan"], ["KR", "South Korea"], ["IN", "India"],
  ["DE", "Germany"], ["FR", "France"], ["BR", "Brazil"], ["VN", "Vietnam"],
];

function Flag({ code }: { code: string }) {
  return <span className="text-[1.05rem]" aria-hidden>{code === "VN" ? "🇻🇳" : code === "US" ? "🇺🇸" : code === "GB" ? "🇬🇧" : code === "JP" ? "🇯🇵" : code === "KR" ? "🇰🇷" : code === "SG" ? "🇸🇬" : code === "AU" ? "🇦🇺" : code === "CA" ? "🇨🇦" : code === "IN" ? "🇮🇳" : code === "DE" ? "🇩🇪" : code === "FR" ? "🇫🇷" : code === "BR" ? "🇧🇷" : "🌎"}</span>;
}

function Logo({ compact = false }: { compact?: boolean }) {
  return <div className={`flex items-center gap-3 ${compact ? "" : "flex-col gap-4"}`}>
    <div className="logo-mark"><MessageCircle size={compact ? 24 : 38} strokeWidth={1.8} /><span /></div>
    <span className={`brand ${compact ? "text-xl" : "text-3xl"}`}>Random Stranger Chat</span>
  </div>;
}

export default function Home() {
  const [lang, setLang] = useState<Language>(() => (navigator.language.toLowerCase().startsWith("vi") ? "vi" : "en"));
  const [step, setStep] = useState<Step>("welcome");
  const [form, setForm] = useState<Form>({ gender: "", name: "", year: "", country: "US", city: "" });
  const [session, setSession] = useState<SessionProfile | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [botMode, setBotMode] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [legalPage, setLegalPage] = useState<LegalPage>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const stepRef = useRef<Step>(step);
  const botModeRef = useRef(false);
  const c = copy[lang];
  const years = useMemo(() => Array.from({ length: 70 }, (_, i) => String(new Date().getFullYear() - i - 16)), []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = lang === "vi" ? "Random Stranger Chat — Trò chuyện với người lạ" : "Random Stranger Chat — Talk to Strangers Online";
  }, [lang]);
  useEffect(() => { stepRef.current = step; }, [step]);

  useEffect(() => () => { channelRef.current?.unsubscribe(); }, []);

  const updateForm = (key: keyof Form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const canContinue = step === "gender" ? !!form.gender : step === "name" ? form.name.trim().length > 0 : step === "year" ? !!form.year : !!form.city.trim();

  const createSessionAndMatch = async () => {
    setBusy(true); setError("");
    let user;
    try { user = await ensureAnonymousAuth(); } catch (authError) { setError(authError instanceof Error ? authError.message : "Could not start a secure session"); setBusy(false); return; }
    const { data: profile, error: insertError } = await supabase.from("anonymous_sessions").upsert({
      id: user.id, display_name: form.name.trim(), gender: form.gender, birth_year: Number(form.year), country_code: form.country, city: form.city.trim(), language: lang,
    }).select().single();
    if (insertError || !profile) { setError(insertError?.message || "Could not start a session"); setBusy(false); return; }
    setSession(profile as SessionProfile);
    const { data: matchRows, error: matchError } = await supabase.rpc("join_match", { p_language: lang, p_country_code: form.country });
    const match = matchRows?.[0];
    if (matchError) { setError(matchError.message); setBusy(false); return; }
    if (match?.matched && match.conversation_id) { const { data: matched } = await supabase.from("conversations").select().eq("id", match.conversation_id).single(); if (matched) { setConversation(matched as Conversation); setStep("chat"); subscribeToChat(matched.id, profile.id); } }
    else { setStep("matching"); subscribeToMatch(profile.id); }
    setBusy(false);
  };

  const subscribeToMatch = (sessionId: string) => {
    channelRef.current?.unsubscribe();
    const channel = supabase.channel(`match-${sessionId}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "conversations", filter: `participant_a=eq.${sessionId}` }, (payload) => {
      const match = payload.new as Conversation; setConversation(match); setStep("chat"); subscribeToChat(match.id, sessionId);
    }).subscribe();
    channelRef.current = channel;
    const poll = window.setInterval(async () => {
      if (stepRef.current !== "matching") { window.clearInterval(poll); return; }
      const { data } = await supabase.from("conversations").select("*").or(`participant_a.eq.${sessionId},participant_b.eq.${sessionId}`).is("ended_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (data) { window.clearInterval(poll); setConversation(data as Conversation); setStep("chat"); subscribeToChat(data.id, sessionId); }
    }, 2500);
    window.setTimeout(() => { if (stepRef.current === "matching") void startBotFallback(sessionId); }, 5500);
  };

  const startBotFallback = async (sessionId: string) => {
    const { data: humanMatch } = await supabase.from("conversations").select("*").or(`participant_a.eq.${sessionId},participant_b.eq.${sessionId}`).is("ended_at", null).limit(1).maybeSingle();
    if (humanMatch || stepRef.current !== "matching") return;
    await supabase.from("match_queue").upsert({ session_id: sessionId, language: lang, country_code: session?.country_code || form.country });
    botModeRef.current = true; setBotMode(true); setConversation({ id: `bot-${sessionId}`, participant_a: sessionId, participant_b: sessionId, created_at: new Date().toISOString(), ended_at: null }); setStep("chat");
    setMessages([{ id: `bot-intro-${sessionId}`, conversation_id: `bot-${sessionId}`, sender_session_id: `bot`, body: lang === "vi" ? "Xin chào! Mình là AI Companion của StrangerChat — hiện chưa có người thật online. Bạn muốn trò chuyện về điều gì?" : "Hi! I’m StrangerChat’s AI Companion — there isn’t a real stranger online yet. What would you like to talk about?", created_at: new Date().toISOString() }]);
    subscribeToHumanUpgrade(sessionId);
  };

  const subscribeToHumanUpgrade = (sessionId: string) => {
    const upgradePoll = window.setInterval(async () => {
      if (!botModeRef.current || stepRef.current !== "chat") { window.clearInterval(upgradePoll); return; }
      const { data } = await supabase.from("conversations").select("*").or(`participant_a.eq.${sessionId},participant_b.eq.${sessionId}`).is("ended_at", null).limit(1).maybeSingle();
      if (data) { window.clearInterval(upgradePoll); botModeRef.current = false; setBotMode(false); setMessages([]); setConversation(data as Conversation); subscribeToChat(data.id, sessionId); }
    }, 2500);
  };

  const subscribeToChat = async (conversationId: string, sessionId: string) => {
    channelRef.current?.unsubscribe();
    const { data } = await supabase.from("messages").select("*").eq("conversation_id", conversationId).order("created_at", { ascending: true });
    setMessages((data || []) as Message[]);
    channelRef.current = supabase.channel(`conversation-${conversationId}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` }, (payload) => {
      setMessages((current) => current.some((message) => message.id === payload.new.id) ? current : [...current, payload.new as Message]);
    }).subscribe();
    await supabase.from("anonymous_sessions").update({ last_seen_at: new Date().toISOString() }).eq("id", sessionId);
  };

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault(); if (!draft.trim() || !conversation || !session) return;
    const body = draft.trim(); setDraft("");
    if (botMode) {
      const userMessage: Message = { id: `user-${crypto.randomUUID()}`, conversation_id: conversation.id, sender_session_id: session.id, body, created_at: new Date().toISOString() };
      setMessages((current) => [...current, userMessage]);
      const history = [...messages, userMessage].map((message) => ({ role: message.sender_session_id === session.id ? "user" : "assistant", text: message.body }));
      const { data, error: botError } = await supabase.functions.invoke("stranger-bot", { body: { language: lang, history } });
      if (!botError && data?.text && stepRef.current === "chat") setMessages((current) => [...current, { id: `bot-${crypto.randomUUID()}`, conversation_id: conversation.id, sender_session_id: "bot", body: data.text, created_at: new Date().toISOString() }]);
      return;
    }
    const { data } = await supabase.from("messages").insert({ conversation_id: conversation.id, sender_session_id: session.id, body }).select().single();
    if (data) setMessages((current) => current.some((message) => message.id === data.id) ? current : [...current, data as Message]);
  };

  const leaveChat = async (next: boolean) => {
    // messages reference conversations with ON DELETE CASCADE, so deleting the
    // conversation permanently removes every message in that room.
    if (conversation) await supabase.rpc("leave_conversation", { p_conversation_id: conversation.id });
    if (session) await supabase.from("match_queue").delete().eq("session_id", session.id);
    channelRef.current?.unsubscribe(); setConversation(null); setMessages([]);
    if (next && session) { botModeRef.current = false; setBotMode(false); setStep("matching"); await supabase.rpc("join_match", { p_language: lang, p_country_code: session.country_code }); subscribeToMatch(session.id); }
    else { botModeRef.current = false; setBotMode(false); setSession(null); setStep("welcome"); }
  };

  const submitStep = () => {
    if (!canContinue) return;
    if (step === "location") void createSessionAndMatch();
    else setStep(step === "gender" ? "name" : step === "name" ? "year" : "location");
  };

  if (step === "chat") return <ChatView c={c} lang={lang} session={session} botMode={botMode} messages={messages} draft={draft} setDraft={setDraft} sendMessage={sendMessage} leaveChat={leaveChat} onLegal={setLegalPage} />;
  if (step === "matching") return <main className="shell"><header className="topbar"><Logo compact /><LanguageToggle lang={lang} setLang={setLang} /></header><AdSlot label={lang === "vi" ? "Vị trí quảng cáo" : "Advertisement"} variant="top" /><section className="center-stage"><div className="matching-orb"><div className="orb-ring ring-one" /><div className="orb-ring ring-two" /><div className="orb-core"><Sparkles size={29} /></div></div><h1>{c.matching}</h1><p>{c.matchingHint}</p><div className="matching-dots"><i /><i /><i /></div><button className="text-button" onClick={() => leaveChat(false)}>{c.end}</button></section><LegalFooter lang={lang} onLegal={setLegalPage} />{legalPage && <LegalModal lang={lang} page={legalPage} onClose={() => setLegalPage(null)} />}</main>;

  return <main className="shell"><header className="topbar"><Logo compact /><LanguageToggle lang={lang} setLang={setLang} /></header><AdSlot label={lang === "vi" ? "Vị trí quảng cáo" : "Advertisement"} variant="top" /><section className="center-stage wizard-stage">
    {step === "welcome" && <><Logo /><div className="eyebrow"><Globe2 size={14} /> One world, many stories</div><h1>{c.intro}</h1><p className="welcome-copy">{lang === "vi" ? "Gặp một người bạn chưa từng biết, ở bất cứ đâu trên thế giới." : "Meet someone you've never known, anywhere in the world."}</p><button className="primary-button" onClick={() => setStep("gender")}>{c.start}<span>→</span></button><div className="tiny-note"><Users size={14} /> {lang === "vi" ? "Không cần hồ sơ công khai" : "No public profile needed"}</div></>}
    {step !== "welcome" && <><div className="step-count">0{step === "gender" ? 1 : step === "name" ? 2 : step === "year" ? 3 : 4} <span>/ 04</span></div>{step === "gender" && <><h1>{c.gender}</h1><div className="choice-grid"><Choice icon="♀" label={lang === "vi" ? "Nữ" : "Woman"} active={form.gender === "female"} onClick={() => updateForm("gender", "female")} /><Choice icon="♂" label={lang === "vi" ? "Nam" : "Man"} active={form.gender === "male"} onClick={() => updateForm("gender", "male")} /><Choice icon="✦" label={lang === "vi" ? "Khác" : "Other"} active={form.gender === "other"} onClick={() => updateForm("gender", "other")} /></div></>}{step === "name" && <><h1>{c.name}</h1><input autoFocus className="large-input" value={form.name} onChange={(e) => updateForm("name", e.target.value)} placeholder={c.noName} maxLength={40} /></>}{step === "year" && <><h1>{c.year}</h1><p className="hint">{c.yearHint}</p><select className="large-input select-input" value={form.year} onChange={(e) => updateForm("year", e.target.value)}><option value="">{lang === "vi" ? "Chọn năm sinh" : "Select birth year"}</option>{years.map((year) => <option key={year} value={year}>{year}</option>)}</select></>}{step === "location" && <><h1>{c.location}</h1><p className="hint">{c.locationHint}</p><div className="location-fields"><select className="large-input select-input" value={form.country} onChange={(e) => updateForm("country", e.target.value)}>{countries.map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select><input autoFocus className="large-input" value={form.city} onChange={(e) => updateForm("city", e.target.value)} placeholder={lang === "vi" ? "Thành phố" : "City"} /></div></>}{error && <p className="error-text">{error}</p>}<div className="wizard-actions"><button className="text-button" onClick={() => setStep(step === "gender" ? "welcome" : step === "name" ? "gender" : step === "year" ? "name" : "year")}>{c.back}</button><button className="primary-button small" disabled={!canContinue || busy} onClick={submitStep}>{busy ? <Loader2 className="spin" size={17} /> : c.continue}<span>→</span></button></div></>}
  </section><AdSlot label={lang === "vi" ? "Vị trí quảng cáo" : "Advertisement"} variant="bottom" /><LegalFooter lang={lang} onLegal={setLegalPage} />{legalPage && <LegalModal lang={lang} page={legalPage} onClose={() => setLegalPage(null)} />}</main>;
}

function AdSlot({ label, variant }: { label: string; variant: "top" | "bottom" | "chat" }) { return <div className={`ad-slot ad-${variant}`} aria-label={label}><span>{label}</span></div>; }

function LegalFooter({ lang, onLegal }: { lang: Language; onLegal: (page: LegalPage) => void }) { return <footer className="footer"><span>© 2026 Random Stranger Chat</span><span>{lang === "vi" ? "Trò chuyện tử tế · Tôn trọng sự riêng tư" : "Be kind · Respect privacy"}</span><nav className="legal-links"><button onClick={() => onLegal("privacy")}>{lang === "vi" ? "Chính sách bảo mật" : "Privacy Policy"}</button><button onClick={() => onLegal("terms")}>{lang === "vi" ? "Điều khoản sử dụng" : "Terms of Use"}</button></nav></footer>; }

function LegalModal({ lang, page, onClose }: { lang: Language; page: Exclude<LegalPage, null>; onClose: () => void }) { const privacy = page === "privacy"; return <div className="legal-backdrop" role="dialog" aria-modal="true" aria-label={privacy ? "Privacy Policy" : "Terms of Use"}><article className="legal-modal"><button className="legal-close" onClick={onClose} aria-label="Close">×</button><div className="eyebrow">Random Stranger Chat</div><h2>{privacy ? (lang === "vi" ? "Chính sách bảo mật" : "Privacy Policy") : (lang === "vi" ? "Điều khoản sử dụng" : "Terms of Use")}</h2>{privacy ? <><p>{lang === "vi" ? "Chúng tôi chỉ sử dụng thông tin cần thiết để ghép đôi và duy trì cuộc trò chuyện. Không chia sẻ thông tin cá nhân của bạn với người khác trong hồ sơ công khai." : "We use only the information needed to match you and maintain a conversation. Your personal details are not shown in a public profile."}</p><p>{lang === "vi" ? "Tin nhắn và dữ liệu phiên có thể được lưu tạm thời để vận hành dịch vụ, chống spam và xử lý báo cáo. Bạn không nên chia sẻ số điện thoại, mật khẩu hoặc thông tin nhạy cảm." : "Messages and session data may be stored temporarily to operate the service, prevent spam, and handle reports. Do not share phone numbers, passwords, or sensitive information."}</p></> : <><p>{lang === "vi" ? "Bạn đồng ý sử dụng dịch vụ một cách văn minh, không quấy rối, lừa đảo, đe dọa hoặc chia sẻ nội dung bất hợp pháp." : "You agree to use the service respectfully and not to harass, scam, threaten, or share illegal content."}</p><p>{lang === "vi" ? "Dịch vụ dành cho người dùng đủ độ tuổi theo pháp luật nơi bạn sống. Hãy kết thúc và báo cáo cuộc trò chuyện nếu cảm thấy không an toàn." : "The service is for users who meet the minimum age required where they live. End and report a conversation if you feel unsafe."}</p></>}<button className="primary-button small legal-ok" onClick={onClose}>{lang === "vi" ? "Đã hiểu" : "Got it"}</button></article></div>; }

function Choice({ icon, label, active, onClick }: { icon: string; label: string; active: boolean; onClick: () => void }) { return <button className={`choice-card ${active ? "active" : ""}`} onClick={onClick}><span className="choice-icon">{icon}</span><span>{label}</span>{active && <span className="choice-check">✓</span>}</button>; }
function LanguageToggle({ lang, setLang }: { lang: Language; setLang: (language: Language) => void }) { return <div className="language-toggle"><button className={lang === "vi" ? "active" : ""} onClick={() => setLang("vi")}><Flag code="VN" /> VI</button><button className={lang === "en" ? "active" : ""} onClick={() => setLang("en")}><Flag code="US" /> EN</button></div>; }
function ChatView({ c, lang, session, botMode, messages, draft, setDraft, sendMessage, leaveChat, onLegal }: { c: typeof copy.vi; lang: Language; session: SessionProfile | null; botMode: boolean; messages: Message[]; draft: string; setDraft: (value: string) => void; sendMessage: (event: FormEvent) => void; leaveChat: (next: boolean) => void; onLegal: (page: LegalPage) => void }) { return <main className="chat-shell"><header className="chat-topbar"><Logo compact /><div className="chat-status"><span className="status-dot" /> {c.matched}</div><LanguageToggle lang={lang} setLang={() => undefined} /></header><AdSlot label={lang === "vi" ? "Vị trí quảng cáo" : "Advertisement"} variant="chat" /><section className="chat-card"><div className="chat-card-head"><div className="stranger-avatar"><Heart size={19} /></div><div><strong>{botMode ? "AI Companion" : c.anonymous}</strong><span>{botMode ? (lang === "vi" ? "Trợ lý AI — sẽ chuyển sang người thật khi có người online" : "AI companion — we’ll switch you to a real person when available") : (lang === "vi" ? "Một người ở đâu đó trên thế giới" : "Someone, somewhere in the world")}</span></div><button className="close-button" onClick={() => leaveChat(false)} aria-label={c.end}><X size={18} /></button></div><div className="chat-retention-notice">{lang === "vi" ? "Tin nhắn sẽ bị xóa vĩnh viễn khi bạn thoát hoặc chọn người khác." : "Messages are permanently deleted when you leave or choose another stranger."}</div><div className="messages"><div className="conversation-intro"><div className="intro-line" /><p>{c.empty}</p><div className="intro-line" /></div>{messages.map((message) => <div key={message.id} className={`message-row ${message.sender_session_id === session?.id ? "mine" : "theirs"}`}><div className="message-bubble">{message.body}</div><time>{new Date(message.created_at).toLocaleTimeString(lang === "vi" ? "vi-VN" : "en-US", { hour: "2-digit", minute: "2-digit" })}</time></div>)}</div><form className="composer" onSubmit={sendMessage}><input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={c.placeholder} maxLength={2000} /><button type="submit" aria-label={c.send}><Send size={18} /></button></form></section><div className="chat-actions"><button className="secondary-button" onClick={() => leaveChat(true)}>{c.next}<span>↗</span></button><button className="text-button" onClick={() => leaveChat(false)}>{c.end}</button></div><AdSlot label={lang === "vi" ? "Vị trí quảng cáo" : "Advertisement"} variant="bottom" /><LegalFooter lang={lang} onLegal={onLegal} /></main>; }
